import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { AuthChallenge, AuthChallengePurpose } from "../models/AuthChallenge.js";
import { QrAuthSession, IQrAuthSession } from "../models/QrAuthSession.js";
import { User, IUser, IUserWallet } from "../models/User.js";
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ConflictError,
  ForbiddenError,
} from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { ENV } from "../config/env.js";
import {
  walletService,
  SupportedWalletType,
  SupportedWalletNetwork,
} from "./wallet/walletService.js";

export interface WalletOnboardingTokenPayload {
  purpose: "wallet_onboarding";
  walletAddress: string;
  walletType: SupportedWalletType;
  network: SupportedWalletNetwork;
  publicKey?: string;
}

export class AlgorandAuthService {
  /**
   * Synchronizes legacy `user.walletAddress` with `user.wallets[]` for backward compatibility.
   */
  syncUserWalletFields(user: IUser): void {
    if (!Array.isArray(user.wallets)) {
      user.wallets = [];
    }

    // Migrate legacy walletAddress into wallets[] only if no wallet with that address exists in wallets[]
    if (user.walletAddress) {
      const normalizedLegacy = user.walletAddress.trim();
      const existsInArray = user.wallets.some(
        (w) => w.address.toLowerCase() === normalizedLegacy.toLowerCase()
      );
      if (!existsInArray) {
        user.wallets.push({
          address: normalizedLegacy.toUpperCase(),
          walletType: "pera",
          network: "algorand",
          verified: true,
          linkedAt: user.createdAt || new Date(),
        });
      }
    }

    // Keep user.walletAddress pointing to the primary verified Algorand wallet (or first verified wallet)
    const verifiedAlgorand = user.wallets.find(
      (w) => w.verified && w.network === "algorand"
    );
    const anyVerified = user.wallets.find((w) => w.verified);
    user.walletAddress = verifiedAlgorand?.address || anyVerified?.address || undefined;
  }

  /**
   * Checks whether any other Evalora account already owns this verified wallet.
   */
  async findVerifiedWalletOwner(
    normalizedAddress: string,
    network: SupportedWalletNetwork,
    excludeUserId?: string
  ): Promise<IUser | null> {
    const orConditions: any[] = [
      {
        wallets: {
          $elemMatch: {
            address: normalizedAddress,
            network,
            verified: true,
          },
        },
      },
    ];

    if (network === "algorand") {
      orConditions.push({ walletAddress: normalizedAddress });
    }

    const query: any = { $or: orConditions };
    if (excludeUserId && mongoose.Types.ObjectId.isValid(excludeUserId)) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeUserId) };
    }

    return User.findOne(query);
  }

  /**
   * Generates a single-use, cryptographically unpredictable challenge for wallet authentication,
   * registration, or account linking across supported wallet providers.
   */
  async generateChallenge(
    walletAddress: string,
    purpose: "LOGIN" | "LINK_WALLET" | "REGISTER_WALLET" = "LOGIN",
    userId?: string,
    walletType?: string,
    network?: string
  ): Promise<{
    challenge: string;
    nonce: string;
    walletAddress: string;
    walletType: SupportedWalletType;
    network: SupportedWalletNetwork;
    issuedAt: Date;
    expiresAt: Date;
    purpose: "LOGIN" | "LINK_WALLET" | "REGISTER_WALLET";
  }> {
    const {
      normalizedAddress,
      walletType: resolvedType,
      network: resolvedNetwork,
      provider,
    } = walletService.validateAndNormalizeAddress(walletAddress, walletType, network);

    const dbPurpose: AuthChallengePurpose =
      purpose === "LINK_WALLET"
        ? "wallet_link"
        : purpose === "REGISTER_WALLET"
          ? "wallet_register"
          : "wallet_auth";

    // Invalidate previous unconsumed challenges for this wallet + purpose
    await AuthChallenge.deleteMany({
      walletAddress: normalizedAddress,
      purpose: dbPurpose,
      consumedAt: { $exists: false },
    });

    // Cryptographically unpredictable 256-bit hex nonce + UUID
    const randomHex = crypto.randomBytes(16).toString("hex");
    const nonce = `${crypto.randomUUID()}-${randomHex}`;
    const issuedAt = new Date();
    const ttlSeconds =
      ENV.WALLET_AUTH_CHALLENGE_TTL ||
      (ENV.WALLET_CHALLENGE_EXPIRY_MINUTES || 5) * 60;
    const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000);

    const challenge = provider.formatChallenge({
      walletAddress: normalizedAddress,
      walletType: resolvedType,
      network: resolvedNetwork,
      nonce,
      issuedAt,
      expiresAt,
      purpose,
    });

    await AuthChallenge.create({
      walletAddress: normalizedAddress,
      walletType: resolvedType,
      network: resolvedNetwork,
      purpose: dbPurpose,
      nonce: challenge,
      nonceId: nonce,
      userId:
        userId && mongoose.Types.ObjectId.isValid(userId)
          ? new mongoose.Types.ObjectId(userId)
          : undefined,
      expiresAt,
      lastSentAt: issuedAt,
    });

    logger.info(
      purpose === "LOGIN" ? "WALLET_LOGIN_STARTED" : "WALLET_CONNECT_STARTED",
      {
        details: {
          walletAddress: normalizedAddress,
          walletType: resolvedType,
          network: resolvedNetwork,
          purpose,
        },
      }
    );

    return {
      challenge,
      nonce,
      walletAddress: normalizedAddress,
      walletType: resolvedType,
      network: resolvedNetwork,
      issuedAt,
      expiresAt,
      purpose,
    };
  }

  /**
   * Internal helper that validates and atomically consumes a single-use wallet challenge.
   */
  async verifyAndConsumeChallenge(params: {
    walletAddress: string;
    walletType?: string;
    network?: string;
    signature: string;
    challenge: string;
    publicKey?: string;
    allowedPurposes?: AuthChallengePurpose[];
  }): Promise<{
    normalizedAddress: string;
    walletType: SupportedWalletType;
    network: SupportedWalletNetwork;
  }> {
    const {
      walletAddress,
      walletType,
      network,
      signature,
      challenge,
      publicKey,
      allowedPurposes = ["wallet_auth", "wallet_link", "wallet_register"],
    } = params;

    const {
      normalizedAddress,
      walletType: resolvedType,
      network: resolvedNetwork,
      provider,
    } = walletService.validateAndNormalizeAddress(walletAddress, walletType, network);

    if (!signature || !challenge) {
      throw new ValidationError("Wallet signature and challenge message are required.");
    }

    // Ensure the challenge text explicitly references this wallet address
    if (!challenge.toLowerCase().includes(normalizedAddress.toLowerCase())) {
      logger.warn("WALLET_LOGIN_FAILED", {
        details: {
          walletAddress: normalizedAddress,
          reason: "CHALLENGE_ADDRESS_MISMATCH",
        },
      });
      throw new UnauthorizedError(
        "Challenge message does not match the provided wallet address."
      );
    }

    const storedChallenge = await AuthChallenge.findOne({
      walletAddress: normalizedAddress,
      purpose: { $in: allowedPurposes },
      nonce: challenge,
      consumedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });

    if (!storedChallenge) {
      logger.warn("WALLET_LOGIN_FAILED", {
        details: {
          walletAddress: normalizedAddress,
          reason: "CHALLENGE_INVALID_OR_EXPIRED",
        },
      });
      throw new UnauthorizedError(
        "Invalid, expired, or already used wallet authentication challenge."
      );
    }

    // Verify network matches challenge if storedChallenge recorded a network
    if (
      storedChallenge.network &&
      storedChallenge.network !== resolvedNetwork
    ) {
      logger.warn("WALLET_LOGIN_FAILED", {
        details: {
          walletAddress: normalizedAddress,
          expectedNetwork: storedChallenge.network,
          actualNetwork: resolvedNetwork,
          reason: "NETWORK_MISMATCH",
        },
      });
      throw new UnauthorizedError(
        `Challenge was issued for network "${storedChallenge.network}", not "${resolvedNetwork}".`
      );
    }

    if (storedChallenge.attempts >= (ENV.OTP_MAX_ATTEMPTS || 5)) {
      throw new UnauthorizedError(
        "Maximum verification attempts exceeded for this challenge."
      );
    }

    const isSignatureValid = provider.verifySignature({
      walletAddress: normalizedAddress,
      walletType: resolvedType,
      network: resolvedNetwork,
      challenge,
      signature,
      publicKey,
    });

    if (!isSignatureValid) {
      storedChallenge.attempts += 1;
      await storedChallenge.save();
      logger.warn("WALLET_LOGIN_FAILED", {
        details: {
          walletAddress: normalizedAddress,
          walletType: resolvedType,
          network: resolvedNetwork,
          reason: "INVALID_SIGNATURE",
        },
      });
      throw new UnauthorizedError(
        "Cryptographic wallet signature verification failed."
      );
    }

    // Atomic single-use nonce consumption to prevent concurrent replay attacks
    const consumed = await AuthChallenge.findOneAndUpdate(
      {
        _id: storedChallenge._id,
        consumedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      },
      {
        $set: { consumedAt: new Date() },
      },
      { new: true }
    );

    if (!consumed) {
      throw new UnauthorizedError("Challenge has already been consumed.");
    }

    logger.info("WALLET_OWNERSHIP_VERIFIED", {
      details: {
        walletAddress: normalizedAddress,
        walletType: resolvedType,
        network: resolvedNetwork,
      },
    });

    return {
      normalizedAddress,
      walletType: resolvedType,
      network: resolvedNetwork,
    };
  }

  /**
   * Issues a short-lived signed token allowing a newly verified wallet user
   * to complete profile setup (Name, Email, Phone) without re-signing.
   */
  createOnboardingToken(payload: Omit<WalletOnboardingTokenPayload, "purpose">): string {
    return jwt.sign(
      {
        ...payload,
        purpose: "wallet_onboarding",
      },
      ENV.JWT_SECRET,
      { expiresIn: "15m" }
    );
  }

  /**
   * Verifies the cryptographic signature and authenticates or onboards the wallet user.
   */
  async verifyChallengeSignature(params: {
    walletAddress: string;
    walletType?: string;
    network?: string;
    signature: string;
    challenge: string;
    publicKey?: string;
    name?: string;
    email?: string;
    phone?: string;
    requireProfileSetup?: boolean;
  }): Promise<{
    user?: IUser;
    isNewUser: boolean;
    requiresProfileSetup?: boolean;
    onboardingToken?: string;
    walletAddress: string;
    walletType: SupportedWalletType;
    network: SupportedWalletNetwork;
  }> {
    const { normalizedAddress, walletType, network } =
      await this.verifyAndConsumeChallenge({
        walletAddress: params.walletAddress,
        walletType: params.walletType,
        network: params.network,
        signature: params.signature,
        challenge: params.challenge,
        publicKey: params.publicKey,
        allowedPurposes: ["wallet_auth"],
      });

    // 1. Check if a user already owns this verified wallet
    let user = await this.findVerifiedWalletOwner(normalizedAddress, network);
    let isNewUser = false;

    // 1b. If this is the designated administrator wallet, securely associate with the seeded admin account
    if (!user && normalizedAddress === ENV.EVALORA_ADMIN_WALLET) {
      const adminRecord = await User.findOne({ email: ENV.EVALORA_ADMIN_EMAIL });
      if (adminRecord) {
        user = adminRecord;
      }
    }

    // 2. If not yet verified, check if a user entered this wallet manually during registration (verified: false)
    if (!user) {
      const pendingUser = await User.findOne({
        wallets: {
          $elemMatch: {
            address: normalizedAddress,
            network,
            verified: false,
          },
        },
      });
      if (pendingUser) {
        user = pendingUser;
      }
    }

    if (user) {
      if (user.status === "suspended") {
        throw new AppError("This account is suspended.", 403, "ACCOUNT_SUSPENDED");
      }

      // Ensure wallet entry in user.wallets is marked verified and update lastUsedAt
      this.syncUserWalletFields(user);
      const existingIdx = user.wallets.findIndex(
        (w) => w.address === normalizedAddress && w.network === network
      );
      if (existingIdx >= 0) {
        user.wallets[existingIdx].verified = true;
        user.wallets[existingIdx].lastUsedAt = new Date();
        if (params.publicKey) {
          user.wallets[existingIdx].publicKey = params.publicKey;
        }
      } else {
        user.wallets.push({
          address: normalizedAddress,
          walletType,
          network,
          verified: true,
          linkedAt: new Date(),
          lastUsedAt: new Date(),
          publicKey: params.publicKey,
        });
      }
      this.syncUserWalletFields(user);
      user.authProviders = Array.from(
        new Set([...(user.authProviders || ["password"]), "wallet"])
      ) as any;
      await user.save();

      // Remove any unverified claim for this same wallet on other accounts
      await User.updateMany(
        {
          _id: { $ne: user._id },
          "wallets.address": normalizedAddress,
          "wallets.network": network,
          "wallets.verified": false,
        },
        {
          $pull: {
            wallets: {
              address: normalizedAddress,
              network,
              verified: false,
            },
          },
        }
      );

      logger.info("WALLET_LOGIN_SUCCESS", {
        userId: user._id.toString(),
        email: user.email,
        details: {
          walletAddress: normalizedAddress,
          walletType,
          network,
          isNewUser: false,
        },
      });

      return {
        user,
        isNewUser: false,
        walletAddress: normalizedAddress,
        walletType,
        network,
      };
    }

    // 3. New Wallet User Flow (Section 24)
    if (params.requireProfileSetup && !params.name && !params.email) {
      const onboardingToken = this.createOnboardingToken({
        walletAddress: normalizedAddress,
        walletType,
        network,
        publicKey: params.publicKey,
      });
      return {
        isNewUser: true,
        requiresProfileSetup: true,
        onboardingToken,
        walletAddress: normalizedAddress,
        walletType,
        network,
      };
    }

    const normalizedEmail = params.email
      ? params.email.toLowerCase().trim()
      : `${normalizedAddress.toLowerCase()}@wallet.evalora.io`;

    // Do not create a second account if the email already belongs to an existing user
    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    if (existingEmailUser) {
      throw new ConflictError(
        "An account with this email already exists. Please sign in with your email and link your wallet from Settings."
      );
    }

    const shortAddr = normalizedAddress.slice(0, 6);
    const displayName = params.name?.trim() || `Algo Student (${shortAddr})`;

    user = await User.create({
      name: displayName,
      email: normalizedEmail,
      phone: params.phone?.trim() || undefined,
      walletAddress: normalizedAddress,
      wallets: [
        {
          address: normalizedAddress,
          walletType,
          network,
          verified: true,
          linkedAt: new Date(),
          lastUsedAt: new Date(),
          publicKey: params.publicKey,
        },
      ],
      role: "student",
      emailVerified: true,
      authProviders: ["wallet"],
      freeAttempts: { total: 10, used: 0 },
      paidAttempts: { total: 0, used: 0 },
      plan: "free",
      status: "active",
    });
    isNewUser = true;

    logger.info("WALLET_LOGIN_SUCCESS", {
      userId: user._id.toString(),
      email: user.email,
      details: {
        walletAddress: normalizedAddress,
        walletType,
        network,
        isNewUser: true,
      },
    });

    return {
      user,
      isNewUser,
      walletAddress: normalizedAddress,
      walletType,
      network,
    };
  }

  /**
   * Issues a short-lived signed token allowing a newly verified email OTP user
   * to complete profile setup (Name, Phone, optional Pera Wallet).
   */
  createEmailOnboardingToken(email: string): string {
    return jwt.sign(
      {
        email: email.toLowerCase().trim(),
        purpose: "email_onboarding",
      },
      ENV.JWT_SECRET,
      { expiresIn: "15m" }
    );
  }

  /**
   * Completes onboarding for a new user who authenticated via Pera Wallet, QR login, or Email OTP
   * and submitted their profile setup details (Name, Email, Phone, optional Pera Wallet).
   */
  async completeWalletOnboarding(params: {
    onboardingToken: string;
    name: string;
    email?: string;
    phone?: string;
    walletAddress?: string;
    walletType?: string;
    network?: string;
    challenge?: string;
    signature?: string;
    publicKey?: string;
  }): Promise<{ user: IUser; isNewUser: boolean }> {
    if (!params.onboardingToken || !params.name?.trim()) {
      throw new ValidationError(
        "Onboarding token and full name are required."
      );
    }

    let decoded: any;
    try {
      decoded = jwt.verify(params.onboardingToken, ENV.JWT_SECRET);
    } catch {
      throw new UnauthorizedError("Invalid or expired onboarding session.");
    }

    // Case 1: New Email OTP User completing profile setup (Section 10 Case B)
    if (decoded.purpose === "email_onboarding" && decoded.email) {
      const normalizedEmail = String(decoded.email).toLowerCase().trim();
      const existingEmailUser = await User.findOne({ email: normalizedEmail });
      if (existingEmailUser) {
        throw new ConflictError("An account with this email already exists.");
      }

      const preparedWallet = await this.prepareRegistrationWallet({
        walletAddress: params.walletAddress,
        walletType: params.walletType || "pera",
        network: params.network || "algorand",
        challenge: params.challenge,
        signature: params.signature,
        publicKey: params.publicKey,
      });

      const authProviders: Array<"password" | "google" | "otp" | "wallet"> = ["otp"];
      if (preparedWallet?.verified) {
        authProviders.push("wallet");
      }

      const user = await User.create({
        name: params.name.trim(),
        email: normalizedEmail,
        phone: params.phone?.trim() || undefined,
        walletAddress: preparedWallet?.verified ? preparedWallet.address : undefined,
        wallets: preparedWallet ? [preparedWallet] : [],
        role: "student",
        emailVerified: true,
        authProviders,
        freeAttempts: { total: 10, used: 0 },
        paidAttempts: { total: 0, used: 0 },
        plan: "free",
        status: "active",
      });

      logger.info("USER_REGISTERED", {
        userId: user._id.toString(),
        email: user.email,
        details: {
          authMethod: "otp",
          hasWallet: Boolean(preparedWallet),
          walletVerified: Boolean(preparedWallet?.verified),
        },
      });

      return { user, isNewUser: true };
    }

    // Case 2: New Pera Wallet User completing profile setup (Section 24)
    if (decoded.purpose !== "wallet_onboarding" || !decoded.walletAddress) {
      throw new UnauthorizedError("Invalid wallet onboarding token purpose.");
    }

    if (!params.email?.trim()) {
      throw new ValidationError(
        "Onboarding token, name, and email address are required."
      );
    }

    const existingWalletOwner = await this.findVerifiedWalletOwner(
      decoded.walletAddress,
      decoded.network
    );
    if (existingWalletOwner) {
      throw new ConflictError("Wallet already linked to another account.");
    }

    const normalizedEmail = params.email.toLowerCase().trim();
    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    if (existingEmailUser) {
      throw new ConflictError(
        "An account with this email already exists. Please sign in with your email and link your wallet from Settings."
      );
    }

    const user = await User.create({
      name: params.name.trim(),
      email: normalizedEmail,
      phone: params.phone?.trim() || undefined,
      walletAddress: decoded.walletAddress,
      wallets: [
        {
          address: decoded.walletAddress,
          walletType: decoded.walletType,
          network: decoded.network,
          verified: true,
          linkedAt: new Date(),
          lastUsedAt: new Date(),
          publicKey: decoded.publicKey,
        },
      ],
      role: "student",
      emailVerified: true,
      authProviders: ["wallet"],
      freeAttempts: { total: 10, used: 0 },
      paidAttempts: { total: 0, used: 0 },
      plan: "free",
      status: "active",
    });

    logger.info("WALLET_LOGIN_SUCCESS", {
      userId: user._id.toString(),
      email: user.email,
      details: {
        walletAddress: decoded.walletAddress,
        walletType: decoded.walletType,
        network: decoded.network,
        isNewUser: true,
        onboardingCompleted: true,
      },
    });

    return { user, isNewUser: true };
  }

  /**
   * Validates optional wallet data provided during Email/OTP account registration (Sections 4, 5, 6):
   * - If signature + challenge are provided: cryptographically verifies ownership and returns `verified: true`.
   * - If only walletAddress is provided (manual entry): validates format, checks that no other user already
   *   verified this wallet (409 Conflict), and returns `verified: false` (pending ownership verification).
   */
  async prepareRegistrationWallet(params: {
    walletAddress?: string;
    walletType?: string;
    network?: string;
    challenge?: string;
    signature?: string;
    publicKey?: string;
  }): Promise<IUserWallet | null> {
    if (!params.walletAddress || !params.walletAddress.trim()) {
      return null;
    }

    const { normalizedAddress, walletType, network } =
      walletService.validateAndNormalizeAddress(
        params.walletAddress,
        params.walletType,
        params.network
      );

    // Check if another Evalora account already has verified ownership of this wallet
    const existingOwner = await this.findVerifiedWalletOwner(
      normalizedAddress,
      network
    );
    if (existingOwner) {
      throw new ConflictError("Wallet already linked to another account.");
    }

    // Connected Wallet with cryptographic signature during registration (Section 6)
    if (params.signature && params.challenge) {
      await this.verifyAndConsumeChallenge({
        walletAddress: normalizedAddress,
        walletType,
        network,
        signature: params.signature,
        challenge: params.challenge,
        publicKey: params.publicKey,
        allowedPurposes: ["wallet_register", "wallet_auth", "wallet_link"],
      });

      return {
        address: normalizedAddress,
        walletType,
        network,
        verified: true,
        linkedAt: new Date(),
        lastUsedAt: new Date(),
        publicKey: params.publicKey,
      };
    }

    // Manual Wallet Address without signature during registration (Section 5)
    // Stored as verified: false until cryptographic ownership signature is completed
    return {
      address: normalizedAddress,
      walletType,
      network,
      verified: false,
      linkedAt: new Date(),
    };
  }

  /**
   * Links and verifies a wallet on an existing authenticated Evalora account.
   * Supports multiple wallets per user while enforcing strict 1-to-1 verified ownership across accounts.
   */
  async linkWalletToUser(params: {
    userId: string;
    walletAddress: string;
    walletType?: string;
    network?: string;
    signature: string;
    challenge: string;
    publicKey?: string;
  }): Promise<IUser> {
    const { normalizedAddress, walletType, network } =
      walletService.validateAndNormalizeAddress(
        params.walletAddress,
        params.walletType,
        params.network
      );

    const currentUser = await User.findById(params.userId);
    if (!currentUser) {
      throw new UnauthorizedError("Authenticated user account not found.");
    }

    // Check if another account already verified this wallet
    const existingOwner = await this.findVerifiedWalletOwner(
      normalizedAddress,
      network,
      currentUser._id.toString()
    );
    if (existingOwner) {
      throw new ConflictError(
        "Wallet already linked to another account."
      );
    }

    // Verify ownership signature & consume single-use nonce
    await this.verifyAndConsumeChallenge({
      walletAddress: normalizedAddress,
      walletType,
      network,
      signature: params.signature,
      challenge: params.challenge,
      publicKey: params.publicKey,
      allowedPurposes: ["wallet_link", "wallet_auth", "wallet_register"],
    });

    this.syncUserWalletFields(currentUser);

    const existingWalletIdx = currentUser.wallets.findIndex(
      (w) => w.address === normalizedAddress && w.network === network
    );

    if (existingWalletIdx >= 0) {
      currentUser.wallets[existingWalletIdx].verified = true;
      currentUser.wallets[existingWalletIdx].walletType = walletType;
      currentUser.wallets[existingWalletIdx].lastUsedAt = new Date();
      if (params.publicKey) {
        currentUser.wallets[existingWalletIdx].publicKey = params.publicKey;
      }
    } else {
      currentUser.wallets.push({
        address: normalizedAddress,
        walletType,
        network,
        verified: true,
        linkedAt: new Date(),
        lastUsedAt: new Date(),
        publicKey: params.publicKey,
      });
    }

    this.syncUserWalletFields(currentUser);
    currentUser.authProviders = Array.from(
      new Set([...(currentUser.authProviders || ["password"]), "wallet"])
    ) as any;

    try {
      await currentUser.save();
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictError(
          "Wallet already linked to another account."
        );
      }
      throw err;
    }

    // Clean up any unverified claims for this wallet on other accounts
    await User.updateMany(
      {
        _id: { $ne: currentUser._id },
        "wallets.address": normalizedAddress,
        "wallets.network": network,
        "wallets.verified": false,
      },
      {
        $pull: {
          wallets: {
            address: normalizedAddress,
            network,
            verified: false,
          },
        },
      }
    );

    logger.info("WALLET_LINKED", {
      userId: currentUser._id.toString(),
      email: currentUser.email,
      details: { walletAddress: normalizedAddress, walletType, network },
    });

    return currentUser;
  }

  /**
   * Unlinks a wallet from an authenticated user's account.
   * Prevents account lockout if the wallet is the user's only verified login method.
   */
  async unlinkWalletFromUser(
    userId: string,
    targetAddress?: string,
    targetNetwork?: string
  ): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new UnauthorizedError("Authenticated user account not found.");
    }

    this.syncUserWalletFields(user);

    if (!user.walletAddress && user.wallets.length === 0) {
      throw new ValidationError(
        "No wallet is currently linked to this account."
      );
    }

    const addressToRemove = targetAddress
      ? targetAddress.trim()
      : user.walletAddress || user.wallets[0]?.address;

    if (!addressToRemove) {
      throw new ValidationError("No wallet specified to unlink.");
    }

    const remainingWallets = user.wallets.filter((w) => {
      const sameAddr =
        w.address.toLowerCase() === addressToRemove.toLowerCase();
      const sameNet = targetNetwork
        ? w.network === targetNetwork.toLowerCase().trim()
        : true;
      return !(sameAddr && sameNet);
    });

    const hasRemainingVerifiedWallet = remainingWallets.some((w) => w.verified);
    const isWalletSyntheticEmail = user.email.endsWith("@wallet.evalora.io");
    const hasAlternateAuth =
      Boolean(user.passwordHash) ||
      Boolean(user.googleId) ||
      !isWalletSyntheticEmail ||
      hasRemainingVerifiedWallet;

    if (!hasAlternateAuth) {
      throw new ValidationError(
        "You cannot remove your only login method. Add and verify another authentication method first."
      );
    }

    const previousWallet = addressToRemove;
    user.wallets = remainingWallets;

    const nextVerifiedAlgorand = remainingWallets.find(
      (w) => w.verified && w.network === "algorand"
    );
    const nextVerifiedAny = remainingWallets.find((w) => w.verified);
    user.walletAddress =
      nextVerifiedAlgorand?.address || nextVerifiedAny?.address || undefined;

    if (!hasRemainingVerifiedWallet) {
      const remainingProviders = (user.authProviders || []).filter(
        (p) => p !== "wallet"
      );
      user.authProviders = (
        remainingProviders.length > 0 ? remainingProviders : ["password"]
      ) as any;
    }

    await user.save();

    if (!user.walletAddress) {
      await User.updateOne({ _id: user._id }, { $unset: { walletAddress: 1 } });
    }

    logger.info("WALLET_UNLINKED", {
      userId: user._id.toString(),
      email: user.email,
      details: { previousWallet },
    });

    return (await User.findById(userId)) as IUser;
  }

  // =========================================================================
  // DESKTOP QR LOGIN SUBSYSTEM (SECTIONS 9, 10, 11, 12)
  // =========================================================================

  /**
   * Creates a short-lived, single-use QR login session for desktop browsers.
   * The QR payload contains ONLY the session identifier, nonce, network, and verification endpoint —
   * NEVER private keys, seed phrases, passwords, or permanent tokens.
   */
  async createQrSession(params?: {
    walletType?: string;
    network?: string;
  }): Promise<{
    sessionId: string;
    nonce: string;
    challenge: string;
    qrUri: string;
    qrPayload: {
      protocol: string;
      version: string;
      sessionId: string;
      nonce: string;
      purpose: "LOGIN";
      walletProvider: SupportedWalletType;
      walletType: SupportedWalletType;
      network: SupportedWalletNetwork;
      expiresAt: string;
      verifyUrl: string;
      mobileApproveUrl: string;
      deepLinkUrl: string;
    };
    status: "PENDING";
    createdAt: Date;
    expiresAt: Date;
  }> {
    const { walletType, network } = walletService.resolveProviderAndNetwork(
      params?.walletType,
      params?.network
    );

    const sessionId = `qr_${crypto.randomUUID()}_${crypto
      .randomBytes(8)
      .toString("hex")}`;
    const nonce = `${crypto.randomUUID()}-${crypto
      .randomBytes(16)
      .toString("hex")}`;
    const createdAt = new Date();
    const ttlSeconds = ENV.QR_SESSION_TTL || 180;
    const expiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000);

    const challenge = [
      "Evalora QR Authentication Challenge",
      `SessionId: ${sessionId}`,
      `Nonce: ${nonce}`,
      `Purpose: LOGIN`,
      `Network: ${network}`,
      `Issued: ${createdAt.toISOString()}`,
      `Expires: ${expiresAt.toISOString()}`,
    ].join("\n");

    await QrAuthSession.create({
      sessionId,
      nonce,
      challenge,
      status: "PENDING",
      purpose: "LOGIN",
      walletProvider: walletType,
      walletType,
      network,
      createdAt,
      expiresAt,
      attempts: 0,
    });

    const baseClientUrl = ENV.CLIENT_URL.replace(/\/+$/, "");
    const verifyUrl = `${baseClientUrl}/login?qrSession=${encodeURIComponent(
      sessionId
    )}`;
    const mobileApproveUrl = `${baseClientUrl}/wallet-qr-approve?sessionId=${encodeURIComponent(
      sessionId
    )}&wallet=${encodeURIComponent(walletType)}&network=${encodeURIComponent(
      network
    )}`;

    const hostWithoutProtocol = mobileApproveUrl.replace(/^https?:\/\//i, "");
    let deepLinkUrl = mobileApproveUrl;
    if (walletType === "metamask") {
      deepLinkUrl = `https://metamask.app.link/dapp/${hostWithoutProtocol}`;
    } else if (walletType === "petra") {
      deepLinkUrl = `https://petra.app/explore?link=${encodeURIComponent(
        mobileApproveUrl
      )}`;
    } else {
      deepLinkUrl = `perawallet://app/discover-browser?url=${encodeURIComponent(
        mobileApproveUrl
      )}`;
    }

    const qrPayload = {
      protocol: "evalora-wallet-auth",
      version: "1.0",
      sessionId,
      nonce,
      purpose: "LOGIN" as const,
      walletProvider: walletType,
      walletType,
      network,
      expiresAt: expiresAt.toISOString(),
      verifyUrl,
      mobileApproveUrl,
      deepLinkUrl,
    };

    const qrUri = `evalora://wallet-auth?sessionId=${encodeURIComponent(
      sessionId
    )}&nonce=${encodeURIComponent(nonce)}&network=${encodeURIComponent(
      network
    )}&walletType=${encodeURIComponent(walletType)}&expiresAt=${encodeURIComponent(
      expiresAt.toISOString()
    )}`;

    logger.info("QR_AUTH_CREATED", {
      details: { sessionId, walletType, network, expiresAt },
    });

    return {
      sessionId,
      nonce,
      challenge,
      qrUri,
      qrPayload,
      status: "PENDING",
      createdAt,
      expiresAt,
    };
  }

  /**
   * Helper to check and transition expired QR sessions.
   */
  private async loadAndCheckQrSession(sessionId: string): Promise<IQrAuthSession> {
    if (!sessionId || typeof sessionId !== "string") {
      throw new ValidationError("QR sessionId is required.");
    }

    const session = await QrAuthSession.findOne({ sessionId: sessionId.trim() });
    if (!session) {
      throw new ValidationError("QR authentication session not found.");
    }

    if (
      session.expiresAt.getTime() <= Date.now() &&
      ["PENDING", "SCANNED", "AWAITING_APPROVAL", "SIGNING"].includes(session.status)
    ) {
      session.status = "EXPIRED";
      await session.save();
      logger.info("QR_AUTH_EXPIRED", {
        details: { sessionId: session.sessionId },
      });
    }

    return session;
  }

  /**
   * Marks a QR session as SCANNED when a mobile wallet scans the QR code,
   * optionally binding the scanning wallet's address so no other wallet can hijack it.
   */
  async scanQrSession(
    sessionId: string,
    params?: {
      walletAddress?: string;
      walletType?: string;
      network?: string;
    }
  ): Promise<{
    sessionId: string;
    status: string;
    nonce: string;
    challenge: string;
    walletAddress?: string;
    walletType?: string;
    network?: string;
    expiresAt: Date;
  }> {
    const session = await this.loadAndCheckQrSession(sessionId);

    if (session.status === "EXPIRED") {
      throw new UnauthorizedError(
        "This QR code has expired. Generate a new QR code."
      );
    }

    if (session.status === "CANCELLED") {
      throw new UnauthorizedError("This QR authentication session was cancelled.");
    }

    if (session.status === "REJECTED") {
      throw new UnauthorizedError("Wallet authentication was rejected. Try again.");
    }

    if (session.status === "VERIFIED") {
      throw new ConflictError("This QR session has already been used.");
    }

    if (params?.walletAddress) {
      const {
        normalizedAddress,
        walletType: resolvedType,
        network: resolvedNetwork,
        provider,
      } = walletService.validateAndNormalizeAddress(
        params.walletAddress,
        params.walletType || session.walletType,
        params.network || session.network
      );

      if (session.network && session.network !== resolvedNetwork) {
        throw new ValidationError(
          `Wrong wallet network. This QR session requires "${session.network}", but wallet is on "${resolvedNetwork}".`
        );
      }

      // Prevent another wallet from hijacking an already-scanned session
      if (
        session.walletAddress &&
        session.walletAddress !== normalizedAddress
      ) {
        throw new ForbiddenError(
          "This QR session is already bound to another wallet address."
        );
      }

      session.walletAddress = normalizedAddress;
      session.walletType = resolvedType;
      session.network = resolvedNetwork;
      session.status = "SIGNING";

      // Bind walletAddress into the challenge text if not already bound
      if (!session.challenge.toLowerCase().includes(normalizedAddress.toLowerCase())) {
        session.challenge = provider.formatChallenge({
          walletAddress: normalizedAddress,
          walletType: resolvedType,
          network: resolvedNetwork,
          nonce: session.nonce,
          issuedAt: session.createdAt,
          expiresAt: session.expiresAt,
          purpose: "LOGIN",
          sessionId: session.sessionId,
        });
      }
    } else {
      session.status = "SCANNED";
    }

    await session.save();

    logger.info("QR_AUTH_SCANNED", {
      details: {
        sessionId: session.sessionId,
        walletAddress: session.walletAddress,
        status: session.status,
      },
    });

    return {
      sessionId: session.sessionId,
      status: session.status,
      nonce: session.nonce,
      challenge: session.challenge,
      walletAddress: session.walletAddress,
      walletType: session.walletType,
      network: session.network,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Processes mobile wallet approval (signature verification) or rejection for a QR login session.
   */
  async verifyQrSession(
    sessionId: string,
    params: {
      walletAddress?: string;
      walletType?: string;
      network?: string;
      signature?: string;
      publicKey?: string;
      nonce?: string;
      rejected?: boolean;
      requireProfileSetup?: boolean;
    }
  ): Promise<{
    sessionId: string;
    status: string;
    walletAddress?: string;
    isNewUser?: boolean;
    requiresProfileSetup?: boolean;
  }> {
    const session = await this.loadAndCheckQrSession(sessionId);

    if (session.status === "EXPIRED") {
      throw new UnauthorizedError(
        "This QR code has expired. Generate a new QR code."
      );
    }

    if (session.status === "CANCELLED") {
      throw new UnauthorizedError("This QR authentication session was cancelled.");
    }

    if (session.status === "VERIFIED" || session.claimedAt) {
      throw new ConflictError("This QR session has already been used.");
    }

    if (session.status === "REJECTED") {
      throw new UnauthorizedError("Wallet authentication was rejected. Try again.");
    }

    // Handle explicit rejection from mobile wallet
    if (params.rejected) {
      session.status = "REJECTED";
      session.failureReason = "Wallet authentication was rejected. Try again.";
      await session.save();
      logger.info("QR_AUTH_REJECTED", {
        details: { sessionId: session.sessionId, reason: "USER_REJECTED_QR" },
      });
      logger.info("WALLET_LOGIN_FAILED", {
        details: { sessionId: session.sessionId, reason: "USER_REJECTED_QR" },
      });
      return {
        sessionId: session.sessionId,
        status: "REJECTED",
      };
    }

    if (!params.walletAddress || !params.signature) {
      throw new ValidationError(
        "walletAddress and signature are required to approve QR login."
      );
    }

    if (params.nonce && params.nonce !== session.nonce) {
      throw new UnauthorizedError("QR session nonce mismatch.");
    }

    const {
      normalizedAddress,
      walletType: resolvedType,
      network: resolvedNetwork,
      provider,
    } = walletService.validateAndNormalizeAddress(
      params.walletAddress,
      params.walletType || session.walletType,
      params.network || session.network
    );

    if (session.network && session.network !== resolvedNetwork) {
      throw new ValidationError(
        `Wrong wallet network. Expected "${session.network}", received "${resolvedNetwork}".`
      );
    }

    // Prevent another wallet from hijacking a scanned session
    if (session.walletAddress && session.walletAddress !== normalizedAddress) {
      throw new ForbiddenError(
        "This QR session is already bound to another wallet address."
      );
    }

    if (session.attempts >= (ENV.OTP_MAX_ATTEMPTS || 5)) {
      session.status = "REJECTED";
      await session.save();
      throw new UnauthorizedError(
        "Maximum verification attempts exceeded for this QR session."
      );
    }

    // Support verifying either the pre-bound challenge or the challenge with Wallet line
    let isValidSig = provider.verifySignature({
      walletAddress: normalizedAddress,
      walletType: resolvedType,
      network: resolvedNetwork,
      challenge: session.challenge,
      signature: params.signature,
      publicKey: params.publicKey,
    });

    if (!isValidSig) {
      const formattedChallenge = provider.formatChallenge({
        walletAddress: normalizedAddress,
        walletType: resolvedType,
        network: resolvedNetwork,
        nonce: session.nonce,
        issuedAt: session.createdAt,
        expiresAt: session.expiresAt,
        purpose: "LOGIN",
        sessionId: session.sessionId,
      });
      isValidSig = provider.verifySignature({
        walletAddress: normalizedAddress,
        walletType: resolvedType,
        network: resolvedNetwork,
        challenge: formattedChallenge,
        signature: params.signature,
        publicKey: params.publicKey,
      });
      if (isValidSig) {
        session.challenge = formattedChallenge;
      }
    }

    if (!isValidSig) {
      session.attempts += 1;
      await session.save();
      logger.warn("WALLET_LOGIN_FAILED", {
        details: {
          sessionId: session.sessionId,
          walletAddress: normalizedAddress,
          reason: "INVALID_QR_SIGNATURE",
        },
      });
      throw new UnauthorizedError(
        "Cryptographic wallet signature verification failed."
      );
    }

    // Find or onboard the user for this verified wallet
    let user = await this.findVerifiedWalletOwner(
      normalizedAddress,
      resolvedNetwork
    );
    let isNewUser = false;

    if (!user) {
      // Check if an unverified manual wallet exists on a single account
      const pendingUser = await User.findOne({
        wallets: {
          $elemMatch: {
            address: normalizedAddress,
            network: resolvedNetwork,
            verified: false,
          },
        },
      });
      if (pendingUser) {
        user = pendingUser;
      }
    }

    let onboardingToken: string | undefined;
    let requiresProfileSetup = false;

    if (user) {
      if (user.status === "suspended") {
        throw new AppError("This account is suspended.", 403, "ACCOUNT_SUSPENDED");
      }
      this.syncUserWalletFields(user);
      const idx = user.wallets.findIndex(
        (w) => w.address === normalizedAddress && w.network === resolvedNetwork
      );
      if (idx >= 0) {
        user.wallets[idx].verified = true;
        user.wallets[idx].lastUsedAt = new Date();
      } else {
        user.wallets.push({
          address: normalizedAddress,
          walletType: resolvedType,
          network: resolvedNetwork,
          verified: true,
          linkedAt: new Date(),
          lastUsedAt: new Date(),
          publicKey: params.publicKey,
        });
      }
      this.syncUserWalletFields(user);
      user.authProviders = Array.from(
        new Set([...(user.authProviders || ["password"]), "wallet"])
      ) as any;
      await user.save();
    } else if (params.requireProfileSetup) {
      isNewUser = true;
      requiresProfileSetup = true;
      onboardingToken = this.createOnboardingToken({
        walletAddress: normalizedAddress,
        walletType: resolvedType,
        network: resolvedNetwork,
        publicKey: params.publicKey,
      });
    } else {
      const shortAddr = normalizedAddress.slice(0, 6);
      user = await User.create({
        name: `Wallet Student (${shortAddr})`,
        email: `${normalizedAddress.toLowerCase()}@wallet.evalora.io`,
        walletAddress: normalizedAddress,
        wallets: [
          {
            address: normalizedAddress,
            walletType: resolvedType,
            network: resolvedNetwork,
            verified: true,
            linkedAt: new Date(),
            lastUsedAt: new Date(),
            publicKey: params.publicKey,
          },
        ],
        role: "student",
        emailVerified: true,
        authProviders: ["wallet"],
        freeAttempts: { total: 10, used: 0 },
        paidAttempts: { total: 0, used: 0 },
        plan: "free",
        status: "active",
      });
      isNewUser = true;
    }

    const now = new Date();

    // Atomic single-use transition to VERIFIED
    const updatedSession = await QrAuthSession.findOneAndUpdate(
      {
        _id: session._id,
        status: { $in: ["PENDING", "SCANNED", "AWAITING_APPROVAL", "SIGNING"] },
        expiresAt: { $gt: now },
      },
      {
        $set: {
          status: "VERIFIED",
          walletAddress: normalizedAddress,
          walletProvider: resolvedType,
          walletType: resolvedType,
          network: resolvedNetwork,
          verifiedUserId: user?._id,
          onboardingToken,
          isNewUser,
          requiresProfileSetup,
          verifiedAt: now,
        },
      },
      { new: true }
    );

    if (!updatedSession) {
      throw new ConflictError("QR session has already been processed or expired.");
    }

    logger.info("QR_AUTH_APPROVED", {
      userId: user?._id?.toString(),
      details: {
        sessionId: session.sessionId,
        walletAddress: normalizedAddress,
        walletType: resolvedType,
        network: resolvedNetwork,
      },
    });

    logger.info("QR_AUTH_VERIFIED", {
      userId: user?._id?.toString(),
      details: {
        sessionId: session.sessionId,
        walletAddress: normalizedAddress,
        walletType: resolvedType,
        network: resolvedNetwork,
      },
    });

    logger.info("WALLET_LOGIN_SUCCESS", {
      userId: user?._id?.toString(),
      details: {
        sessionId: session.sessionId,
        walletAddress: normalizedAddress,
        authMethod: "qr_wallet",
      },
    });

    return {
      sessionId: updatedSession.sessionId,
      status: "VERIFIED",
      walletAddress: normalizedAddress,
      isNewUser,
      requiresProfileSetup,
    };
  }

  /**
   * Polls the QR session status from the desktop browser.
   * When VERIFIED, atomically marks the session as claimed (`claimedAt` / `consumedAt`) so the QR session
   * can only be exchanged for an authenticated desktop session once.
   */
  async pollQrSessionStatus(sessionId: string): Promise<{
    sessionId: string;
    status: string;
    expiresAt: Date;
    walletAddress?: string;
    walletType?: string;
    network?: string;
    user?: IUser;
    isNewUser?: boolean;
    requiresProfileSetup?: boolean;
    onboardingToken?: string;
    failureReason?: string;
  }> {
    const session = await this.loadAndCheckQrSession(sessionId);

    if (session.status !== "VERIFIED") {
      return {
        sessionId: session.sessionId,
        status: session.status,
        expiresAt: session.expiresAt,
        walletAddress: session.walletAddress,
        walletType: session.walletType,
        network: session.network,
        failureReason: session.failureReason,
      };
    }

    const now = new Date();
    // Atomic single-use claim on VERIFIED session
    const claimed = await QrAuthSession.findOneAndUpdate(
      {
        _id: session._id,
        status: "VERIFIED",
        claimedAt: { $exists: false },
      },
      {
        $set: { claimedAt: now, consumedAt: now },
      },
      { new: true }
    );

    if (!claimed) {
      throw new ConflictError(
        "This QR authentication session has already been used."
      );
    }

    let user: IUser | undefined;
    if (claimed.verifiedUserId) {
      user = (await User.findById(claimed.verifiedUserId)) || undefined;
    }

    return {
      sessionId: claimed.sessionId,
      status: "VERIFIED",
      expiresAt: claimed.expiresAt,
      walletAddress: claimed.walletAddress,
      walletType: claimed.walletType,
      network: claimed.network,
      user,
      isNewUser: claimed.isNewUser,
      requiresProfileSetup: claimed.requiresProfileSetup,
      onboardingToken: claimed.onboardingToken,
    };
  }

  /**
   * Cancels an active QR login session and makes it permanently invalid.
   */
  async cancelQrSession(sessionId: string): Promise<{
    sessionId: string;
    status: "CANCELLED";
  }> {
    const session = await this.loadAndCheckQrSession(sessionId);

    if (session.status === "VERIFIED" || session.claimedAt) {
      throw new ConflictError("Cannot cancel a QR session that is already verified.");
    }

    session.status = "CANCELLED";
    await session.save();

    return {
      sessionId: session.sessionId,
      status: "CANCELLED",
    };
  }
}

export const algorandAuthService = new AlgorandAuthService();

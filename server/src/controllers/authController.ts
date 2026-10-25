import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, IUser } from "../models/User.js";
import { College } from "../models/College.js";
import { Department } from "../models/Department.js";
import { ENV } from "../config/env.js";
import { algorandAuthService } from "../services/algorandAuthService.js";
import { logger } from "../utils/logger.js";

function signToken(user: IUser): string {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      collegeId: user.collegeId ? user.collegeId.toString() : null,
      tokenVersion: user.authTokenVersion || 0,
    },
    ENV.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

function setAuthCookie(res: Response, token: string): void {
  res.cookie("token", token, {
    httpOnly: true,
    secure: ENV.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function googleOAuthConfigured(): boolean {
  return Boolean(
    ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_SECRET && ENV.GOOGLE_CALLBACK_URL,
  );
}

function redirectWithAuthResult(
  res: Response,
  params: Record<string, string>,
): void {
  const redirect = new URL("/login", ENV.CLIENT_URL);
  Object.entries(params).forEach(([key, value]) =>
    redirect.searchParams.set(key, value),
  );
  res.redirect(redirect.toString());
}

function publicUser(user: IUser): Record<string, unknown> {
  const wallets = Array.isArray(user.wallets) ? [...user.wallets] : [];
  if (
    user.walletAddress &&
    !wallets.some(
      (w) => w.address.toUpperCase() === user.walletAddress!.toUpperCase()
    )
  ) {
    wallets.push({
      address: user.walletAddress,
      walletType: "pera",
      network: "algorand",
      verified: true,
      linkedAt: user.createdAt || new Date(),
    });
  }

  const primaryAlgoWallet =
    wallets.find((w) => w.network === "algorand" && w.verified) ||
    wallets.find((w) => w.network === "algorand") ||
    wallets[0];

  const wallet = primaryAlgoWallet
    ? {
        address: primaryAlgoWallet.address,
        provider: "pera",
        network: "algorand",
        verified: Boolean(primaryAlgoWallet.verified),
        linkedAt: primaryAlgoWallet.linkedAt,
        lastUsedAt: primaryAlgoWallet.lastUsedAt,
      }
    : null;

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    collegeId: user.collegeId,
    departmentId: user.departmentId,
    studentId: user.studentId,
    employeeId: user.employeeId,
    walletAddress: user.walletAddress,
    wallet,
    wallets,
    authProviders: user.authProviders || ["password"],
    freeAttempts: user.freeAttempts || { total: 10, used: 0 },
    paidAttempts: user.paidAttempts || { total: 0, used: 0 },
    plan: user.plan || "free",
    avatar: user.avatar,
  };
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
      return;
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).populate("collegeId", "name code status");
    if (!user) {
      res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
      return;
    }

    if (user.status === "suspended") {
      res.status(403).json({
        success: false,
        message: "Account is suspended. Please contact administrator.",
      });
      return;
    }

    // Check college status if user belongs to a college
    if (
      user.collegeId &&
      typeof user.collegeId === "object" &&
      (user.collegeId as any).status === "suspended"
    ) {
      res.status(403).json({
        success: false,
        message: "Your institution account is temporarily suspended.",
      });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
      return;
    }

    const token = signToken(user);

    setAuthCookie(res, token);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        collegeId: user.collegeId,
        departmentId: user.departmentId,
        studentId: user.studentId,
        employeeId: user.employeeId,
        avatar: user.avatar,
      },
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ success: false, message: error.message || "Login failed" });
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const {
      name,
      email,
      password,
      phone,
      walletAddress,
      walletType,
      network,
      challenge,
      signature,
      publicKey,
    } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
      return;
    }

    const preparedWallet = await algorandAuthService.prepareRegistrationWallet({
      walletAddress,
      walletType,
      network,
      challenge,
      signature,
      publicKey,
    });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const authProviders: Array<"password" | "google" | "wallet"> = [
      "password",
    ];
    if (preparedWallet?.verified) {
      authProviders.push("wallet");
    }

    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: typeof phone === "string" && phone.trim() ? phone.trim() : undefined,
      passwordHash,
      role: "student",
      collegeId: null,
      emailVerified: true,
      status: "active",
      authProviders,
      walletAddress: preparedWallet?.verified ? preparedWallet.address : undefined,
      wallets: preparedWallet ? [preparedWallet] : [],
    });

    const token = signToken(newUser);
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token,
      user: publicUser(newUser),
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Registration failed",
      code: error.code || "REGISTRATION_ERROR",
    });
  }
}

export async function registerCollege(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const {
      collegeName,
      collegeCode,
      contactEmail,
      adminName,
      adminPassword,
      domain,
      phone,
      address,
    } = req.body;

    if (
      !collegeName ||
      !collegeCode ||
      !contactEmail ||
      !adminName ||
      !adminPassword
    ) {
      res.status(400).json({
        success: false,
        message: "Missing required college or administrator details",
      });
      return;
    }

    const existingCollege = await College.findOne({
      code: collegeCode.toUpperCase().trim(),
    });
    if (existingCollege) {
      res.status(409).json({
        success: false,
        message: "A college with this code already exists",
      });
      return;
    }

    const existingAdmin = await User.findOne({
      email: contactEmail.toLowerCase().trim(),
    });
    if (existingAdmin) {
      res.status(409).json({
        success: false,
        message: "An account with this administrator email already exists",
      });
      return;
    }

    // 1. Create College
    const college = await College.create({
      name: collegeName.trim(),
      code: collegeCode.toUpperCase().trim(),
      domain: domain ? domain.trim().toLowerCase() : undefined,
      contactEmail: contactEmail.trim().toLowerCase(),
      phone: phone?.trim(),
      address: address?.trim(),
      status: "active",
      settings: {
        allowRegistration: true,
        requireDepartment: true,
        defaultDurationMinutes: 60,
        antiCheatDefaults: {
          tabSwitchLimit: 3,
          fullscreenRequired: true,
          copyPasteRestricted: true,
        },
      },
    });

    // 2. Create Default Departments
    const cseDept = await Department.create({
      collegeId: college._id,
      name: "Computer Science & Engineering",
      code: "CSE",
      description: "Department of Computer Science & Engineering",
    });

    await Department.create({
      collegeId: college._id,
      name: "Information Technology",
      code: "IT",
      description: "Department of Information Technology",
    });

    // 3. Create College Admin User
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    const adminUser = await User.create({
      name: adminName.trim(),
      email: contactEmail.toLowerCase().trim(),
      passwordHash,
      role: "college_admin",
      collegeId: college._id,
      departmentId: cseDept._id,
      status: "active",
    });

    const token = signToken(adminUser);

    res.status(201).json({
      success: true,
      message:
        "College institution and administrator account created successfully",
      token,
      college,
      user: {
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        collegeId: adminUser.collegeId,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "College registration failed",
    });
  }
}

export async function getCurrentUser(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }

    const user = await User.findById(req.user._id)
      .select("-passwordHash")
      .populate("collegeId", "name code status settings")
      .populate("departmentId", "name code");

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    algorandAuthService.syncUserWalletFields(user);
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getGoogleOAuthStatus(
  req: Request,
  res: Response,
): Promise<void> {
  res.json({ success: true, configured: googleOAuthConfigured() });
}

export async function startGoogleOAuth(
  req: Request,
  res: Response,
): Promise<void> {
  if (!googleOAuthConfigured()) {
    redirectWithAuthResult(res, {
      oauthError:
        "Google OAuth is not configured. Ask an administrator to set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL.",
    });
    return;
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", ENV.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", ENV.GOOGLE_CALLBACK_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");

  res.redirect(url.toString());
}

export async function handleGoogleOAuthCallback(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!googleOAuthConfigured()) {
      redirectWithAuthResult(res, {
        oauthError: "Google OAuth is not configured.",
      });
      return;
    }

    const { code } = req.query;
    if (!code || typeof code !== "string") {
      redirectWithAuthResult(res, {
        oauthError: "Google did not return an authorization code.",
      });
      return;
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: ENV.GOOGLE_CLIENT_ID,
        client_secret: ENV.GOOGLE_CLIENT_SECRET,
        redirect_uri: ENV.GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      redirectWithAuthResult(res, {
        oauthError: "Google sign in failed during token exchange.",
      });
      return;
    }

    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokens.access_token) {
      redirectWithAuthResult(res, {
        oauthError: "Google sign in did not return an access token.",
      });
      return;
    }

    const profileResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );

    if (!profileResponse.ok) {
      redirectWithAuthResult(res, {
        oauthError: "Unable to verify Google profile.",
      });
      return;
    }

    const profile = (await profileResponse.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      picture?: string;
    };

    if (!profile.sub || !profile.email || !profile.email_verified) {
      redirectWithAuthResult(res, {
        oauthError: "Google account email must be verified.",
      });
      return;
    }

    const user = await User.findOne({
      email: profile.email.toLowerCase().trim(),
    }).populate("collegeId", "name code status");
    if (!user) {
      redirectWithAuthResult(res, {
        oauthError:
          "No Evalora account exists for this verified Google email. Create an account first, then sign in with Google.",
      });
      return;
    }

    if (user.status === "suspended") {
      redirectWithAuthResult(res, {
        oauthError: "Account is suspended. Please contact an administrator.",
      });
      return;
    }

    user.googleId = profile.sub;
    user.avatar = user.avatar || profile.picture;
    user.authProviders = Array.from(
      new Set([...(user.authProviders || ["password"]), "google"]),
    );
    await user.save();

    const token = signToken(user);
    setAuthCookie(res, token);
    redirectWithAuthResult(res, { token });
  } catch {
    redirectWithAuthResult(res, {
      oauthError: "Google sign in failed. Please try again.",
    });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.substring(7)
    : req.cookies?.token;
  if (token) {
    try {
      const decoded = jwt.decode(token) as { userId?: string } | null;
      if (decoded?.userId) {
        await User.findByIdAndUpdate(decoded.userId, { $inc: { authTokenVersion: 1 } });
      }
    } catch {
      // Always clear the client cookie even if the token cannot be decoded.
    }
  }
  res.clearCookie("token");
  res.json({ success: true, message: "Logged out successfully" });
}

export async function requestWalletChallenge(req: Request, res: Response): Promise<void> {
  try {
    const { walletAddress, walletType, network, purpose } = req.body;
    if (!walletAddress) {
      res.status(400).json({
        success: false,
        message: "Wallet address is required.",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const upperPurpose =
      typeof purpose === "string" ? purpose.toUpperCase().trim() : "LOGIN";
    const normalizedPurpose: "LOGIN" | "LINK_WALLET" | "REGISTER_WALLET" =
      upperPurpose === "LINK_WALLET"
        ? "LINK_WALLET"
        : upperPurpose === "REGISTER_WALLET"
          ? "REGISTER_WALLET"
          : "LOGIN";

    const result = await algorandAuthService.generateChallenge(
      walletAddress,
      normalizedPurpose,
      req.user?._id,
      walletType,
      network
    );
    res.json({
      success: true,
      challenge: result.challenge,
      nonce: result.nonce,
      walletAddress: result.walletAddress,
      walletType: result.walletType,
      network: result.network,
      issuedAt: result.issuedAt,
      expiresAt: result.expiresAt,
      purpose: result.purpose,
    });
  } catch (error: any) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to generate wallet challenge.",
      code: error.code || "VALIDATION_ERROR",
    });
  }
}

export async function verifyWalletSignature(req: Request, res: Response): Promise<void> {
  try {
    const {
      walletAddress,
      walletType,
      network,
      signature,
      challenge,
      publicKey,
      name,
      email,
      phone,
      requireProfileSetup,
    } = req.body;
    if (!walletAddress || !signature || !challenge) {
      res.status(400).json({
        success: false,
        message: "walletAddress, signature, and challenge are required.",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const result = await algorandAuthService.verifyChallengeSignature({
      walletAddress,
      walletType,
      network,
      signature,
      challenge,
      publicKey,
      name,
      email,
      phone,
      requireProfileSetup: Boolean(requireProfileSetup),
    });

    if (result.requiresProfileSetup || !result.user) {
      res.json({
        success: true,
        message: "Wallet verified. Complete profile setup to create your account.",
        requiresProfileSetup: true,
        isNewUser: true,
        onboardingToken: result.onboardingToken,
        walletAddress: result.walletAddress,
        walletType: result.walletType,
        network: result.network,
      });
      return;
    }

    const token = signToken(result.user);
    setAuthCookie(res, token);

    res.json({
      success: true,
      message: result.isNewUser
        ? "Account created via wallet."
        : "Authenticated successfully.",
      token,
      user: publicUser(result.user),
      isNewUser: result.isNewUser,
    });
  } catch (error: any) {
    res.status(error.statusCode || 401).json({
      success: false,
      message: error.message || "Wallet authentication failed.",
      code: error.code || "UNAUTHORIZED",
    });
  }
}

export async function completeWalletOnboarding(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      onboardingToken,
      name,
      email,
      phone,
      walletAddress,
      walletType,
      network,
      challenge,
      signature,
      publicKey,
    } = req.body;
    const result = await algorandAuthService.completeWalletOnboarding({
      onboardingToken,
      name,
      email,
      phone,
      walletAddress,
      walletType,
      network,
      challenge,
      signature,
      publicKey,
    });

    const token = signToken(result.user);
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      message: "Evalora account created successfully.",
      token,
      user: publicUser(result.user),
      isNewUser: true,
    });
  } catch (error: any) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to complete wallet onboarding.",
      code: error.code || "ONBOARDING_ERROR",
    });
  }
}

export async function linkWallet(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required to link a wallet.",
        code: "UNAUTHORIZED",
      });
      return;
    }

    const { walletAddress, walletType, network, signature, challenge, publicKey } =
      req.body;
    if (!walletAddress || !signature || !challenge) {
      res.status(400).json({
        success: false,
        message: "walletAddress, signature, and challenge are required.",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const updatedUser = await algorandAuthService.linkWalletToUser({
      userId,
      walletAddress,
      walletType,
      network,
      signature,
      challenge,
      publicKey,
    });

    res.json({
      success: true,
      message: "Wallet verified and linked to your account successfully.",
      user: publicUser(updatedUser),
    });
  } catch (error: any) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to link wallet.",
      code: error.code || "WALLET_LINK_ERROR",
    });
  }
}

export async function unlinkWallet(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required to unlink a wallet.",
        code: "UNAUTHORIZED",
      });
      return;
    }

    const { walletAddress, network } = req.body || {};
    const updatedUser = await algorandAuthService.unlinkWalletFromUser(
      userId,
      walletAddress,
      network
    );

    res.json({
      success: true,
      message: "Wallet unlinked from your account.",
      user: publicUser(updatedUser),
    });
  } catch (error: any) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to unlink wallet.",
      code: error.code || "WALLET_UNLINK_ERROR",
    });
  }
}

// =========================================================================
// DESKTOP QR WALLET LOGIN CONTROLLERS
// =========================================================================

export async function createQrAuthSession(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { walletType, network } = req.body || {};
    const session = await algorandAuthService.createQrSession({
      walletType,
      network,
    });
    res.status(201).json({
      success: true,
      ...session,
    });
  } catch (error: any) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to create QR authentication session.",
      code: error.code || "QR_SESSION_ERROR",
    });
  }
}

export async function scanQrAuthSession(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { sessionId } = req.params;
    const { walletAddress, walletType, network } = req.body || {};
    const result = await algorandAuthService.scanQrSession(sessionId, {
      walletAddress,
      walletType,
      network,
    });
    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to scan QR authentication session.",
      code: error.code || "QR_SCAN_ERROR",
    });
  }
}

export async function verifyQrAuthSession(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { sessionId } = req.params;
    const {
      walletAddress,
      walletType,
      network,
      signature,
      publicKey,
      nonce,
      rejected,
      requireProfileSetup,
    } = req.body || {};

    const result = await algorandAuthService.verifyQrSession(sessionId, {
      walletAddress,
      walletType,
      network,
      signature,
      publicKey,
      nonce,
      rejected: Boolean(rejected),
      requireProfileSetup: Boolean(requireProfileSetup),
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 401).json({
      success: false,
      message: error.message || "QR wallet verification failed.",
      code: error.code || "QR_VERIFY_ERROR",
    });
  }
}

export async function getQrAuthStatus(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { sessionId } = req.params;
    const result = await algorandAuthService.pollQrSessionStatus(sessionId);

    if (result.status === "VERIFIED" && result.user) {
      const token = signToken(result.user);
      setAuthCookie(res, token);
      res.json({
        success: true,
        sessionId: result.sessionId,
        status: "VERIFIED",
        token,
        user: publicUser(result.user),
        isNewUser: result.isNewUser,
        walletAddress: result.walletAddress,
        walletType: result.walletType,
        network: result.network,
      });
      return;
    }

    res.json({
      success: true,
      sessionId: result.sessionId,
      status: result.status,
      expiresAt: result.expiresAt,
      walletAddress: result.walletAddress,
      walletType: result.walletType,
      network: result.network,
      requiresProfileSetup: result.requiresProfileSetup,
      onboardingToken: result.onboardingToken,
      failureReason: result.failureReason,
    });
  } catch (error: any) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Unable to check QR session status.",
      code: error.code || "QR_STATUS_ERROR",
    });
  }
}

export async function cancelQrAuthSession(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { sessionId } = req.params;
    const result = await algorandAuthService.cancelQrSession(sessionId);
    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Unable to cancel QR session.",
      code: error.code || "QR_CANCEL_ERROR",
    });
  }
}



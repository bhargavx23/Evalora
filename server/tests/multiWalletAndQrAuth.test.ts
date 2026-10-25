import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import mongoose from "mongoose";
import algosdk from "algosdk";
import { Wallet as EthersWallet } from "ethers";
import app from "../src/server.js";
import { connectDB } from "../src/config/db.js";
import { User } from "../src/models/User.js";
import { AuthChallenge } from "../src/models/AuthChallenge.js";
import { QrAuthSession } from "../src/models/QrAuthSession.js";
import { emailService } from "../src/services/emailService.js";
import {
  deriveEvmAddressFromPublicKey,
  deriveAptosAddressFromPublicKey,
} from "../src/services/wallet/walletService.js";

/**
 * Signs an Algorand challenge using real Ed25519 `algosdk.signBytes`.
 */
function signAlgoChallenge(challenge: string, account: algosdk.Account): string {
  const messageBytes = new Uint8Array(Buffer.from(challenge, "utf8"));
  const sig = algosdk.signBytes(messageBytes, account.sk);
  return Buffer.from(sig).toString("base64");
}

/**
 * Generates a real secp256k1 keypair and EVM address for MetaMask testing.
 */
function generateEvmTestWallet() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "secp256k1",
  });
  const pubDer = publicKey.export({ format: "der", type: "spki" }) as Buffer;
  const pubHex = pubDer.toString("hex");
  const address = deriveEvmAddressFromPublicKey(pubDer);

  const sign = (challenge: string): string => {
    const sig = crypto.sign("sha256", Buffer.from(challenge, "utf8"), privateKey);
    return `evm_pk:${pubHex}:${sig.toString("hex")}`;
  };

  return { address, publicKeyHex: pubHex, sign };
}

/**
 * Generates a real Ed25519 keypair and Aptos address for Petra wallet testing.
 */
function generateAptosTestWallet() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pubDer = publicKey.export({ format: "der", type: "spki" }) as Buffer;
  const pubHex = pubDer.toString("hex");
  const address = deriveAptosAddressFromPublicKey(pubDer);

  const sign = (challenge: string): string => {
    const sig = crypto.sign(null, Buffer.from(challenge, "utf8"), privateKey);
    return `aptos_pk:${pubHex}:${sig.toString("hex")}`;
  };

  return { address, publicKeyHex: pubHex, sign };
}

describe("Evalora Multi-Wallet Authentication & Desktop QR Wallet Login", () => {
  const algoWallet1 = algosdk.generateAccount();
  const algoAddr1 = algoWallet1.addr.toString();

  const algoWallet2 = algosdk.generateAccount();
  const algoAddr2 = algoWallet2.addr.toString();

  const algoWalletQr = algosdk.generateAccount();
  const algoAddrQr = algoWalletQr.addr.toString();

  const algoWalletOnly = algosdk.generateAccount();
  const algoAddrOnly = algoWalletOnly.addr.toString();

  const evmWallet1 = generateEvmTestWallet();
  const evmWallet2 = generateEvmTestWallet();
  const realMetaMaskWallet = EthersWallet.createRandom();
  const realMetaMaskAddr = realMetaMaskWallet.address.toLowerCase();
  const petraWallet1 = generateAptosTestWallet();

  const testEmails = [
    "mw.manual@evalora.io",
    "mw.connected@evalora.io",
    "mw.conflict@evalora.io",
    "mw.onboarded@evalora.io",
    "mw.existing@evalora.io",
  ];

  const cleanupTestData = async () => {
    const addresses = [
      algoAddr1,
      algoAddr2,
      algoAddrQr,
      algoAddrOnly,
      evmWallet1.address,
      evmWallet2.address,
      realMetaMaskAddr,
      petraWallet1.address,
    ];
    await AuthChallenge.deleteMany({
      $or: [
        { walletAddress: { $in: addresses } },
        { email: { $in: testEmails } },
      ],
    });
    await QrAuthSession.deleteMany({ walletAddress: { $in: addresses } });
    await User.deleteMany({
      $or: [
        { email: { $in: testEmails } },
        { walletAddress: { $in: addresses } },
        { "wallets.address": { $in: addresses } },
      ],
    });
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }
    vi.spyOn(emailService, "sendVerificationOTP").mockResolvedValue();
    await cleanupTestData();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await cleanupTestData();
  });

  // =========================================================================
  // 1. MULTI-WALLET OWNERSHIP VERIFICATION (PERA, METAMASK, PETRA)
  // =========================================================================
  describe("1. Multi-Wallet Ownership & Cryptographic Verification", () => {
    it("authenticates MetaMask (Ethereum) and Petra (Aptos) wallets via cryptographic signatures and rejects wrong network or unsupported providers", async () => {
      // A. Reject unsupported wallet provider
      const unsupportedRes = await request(app)
        .post("/api/wallet/challenge")
        .send({
          walletAddress: evmWallet1.address,
          walletType: "phantom_unknown",
          network: "solana",
        });
      expect(unsupportedRes.status).toBe(400);
      expect(unsupportedRes.body.success).toBe(false);

      // B. Reject mismatched provider + network (e.g., MetaMask on Algorand network)
      const wrongNetRes = await request(app)
        .post("/api/wallet/challenge")
        .send({
          walletAddress: evmWallet1.address,
          walletType: "metamask",
          network: "algorand",
        });
      expect(wrongNetRes.status).toBe(400);
      expect(wrongNetRes.body.success).toBe(false);

      // C. Valid MetaMask (Ethereum) challenge + secp256k1 signature + new user onboarding
      const mmChalRes = await request(app)
        .post("/api/wallet/challenge")
        .send({
          walletAddress: evmWallet1.address,
          walletType: "metamask",
          network: "ethereum",
          purpose: "LOGIN",
        });
      expect(mmChalRes.status).toBe(200);
      expect(mmChalRes.body.walletType).toBe("metamask");
      expect(mmChalRes.body.network).toBe("ethereum");

      const mmSig = evmWallet1.sign(mmChalRes.body.challenge);

      // Request verification with requireProfileSetup: true (Section 24 New Wallet User flow)
      const mmVerifyRes = await request(app)
        .post("/api/wallet/verify")
        .send({
          walletAddress: evmWallet1.address,
          walletType: "metamask",
          network: "ethereum",
          challenge: mmChalRes.body.challenge,
          signature: mmSig,
          requireProfileSetup: true,
        });

      expect(mmVerifyRes.status).toBe(200);
      expect(mmVerifyRes.body.requiresProfileSetup).toBe(true);
      expect(mmVerifyRes.body.onboardingToken).toBeDefined();

      // Complete profile setup for new wallet user
      const onboardRes = await request(app)
        .post("/api/wallet/complete-onboarding")
        .send({
          onboardingToken: mmVerifyRes.body.onboardingToken,
          name: "MetaMask Student",
          email: "mw.onboarded@evalora.io",
          phone: "+91 9876543210",
        });

      expect(onboardRes.status).toBe(201);
      expect(onboardRes.body.success).toBe(true);
      expect(onboardRes.body.token).toBeDefined();
      expect(onboardRes.body.user.wallets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            address: evmWallet1.address,
            walletType: "metamask",
            network: "ethereum",
            verified: true,
          }),
        ])
      );

      // D. Reject malformed/forged signature on Petra (Aptos)
      const petraChalRes = await request(app)
        .post("/api/wallet/challenge")
        .send({
          walletAddress: petraWallet1.address,
          walletType: "petra",
          network: "aptos",
        });
      expect(petraChalRes.status).toBe(200);

      const badPetraVerify = await request(app)
        .post("/api/wallet/verify")
        .send({
          walletAddress: petraWallet1.address,
          walletType: "petra",
          network: "aptos",
          challenge: petraChalRes.body.challenge,
          signature: "0xdeadbeef1234",
        });
      expect(badPetraVerify.status).toBe(401);

      // E. Valid Petra (Aptos) Ed25519 signature succeeds
      const validPetraSig = petraWallet1.sign(petraChalRes.body.challenge);
      const okPetraVerify = await request(app)
        .post("/api/wallet/verify")
        .send({
          walletAddress: petraWallet1.address,
          walletType: "petra",
          network: "aptos",
          challenge: petraChalRes.body.challenge,
          signature: validPetraSig,
        });
      expect(okPetraVerify.status).toBe(200);
      expect(okPetraVerify.body.token).toBeDefined();

      // F. Real MetaMask EIP-191 personal_sign 65-byte ECDSA secp256k1 signature (via ethers.Wallet.signMessage)
      const ethersChalRes = await request(app)
        .post("/api/wallet/challenge")
        .send({
          walletAddress: realMetaMaskAddr,
          walletType: "metamask",
          network: "ethereum",
          purpose: "LOGIN",
        });
      expect(ethersChalRes.status).toBe(200);

      const realEip191Signature = await realMetaMaskWallet.signMessage(
        ethersChalRes.body.challenge
      );

      const ethersVerifyRes = await request(app)
        .post("/api/wallet/verify")
        .send({
          walletAddress: realMetaMaskAddr,
          walletType: "metamask",
          network: "ethereum",
          challenge: ethersChalRes.body.challenge,
          signature: realEip191Signature,
        });
      expect(ethersVerifyRes.status).toBe(200);
      expect(ethersVerifyRes.body.token).toBeDefined();
      expect(ethersVerifyRes.body.user.walletAddress).toBe(realMetaMaskAddr);
    });
  });

  // =========================================================================
  // 2. REGISTRATION WITH MANUAL (UNVERIFIED) VS CONNECTED (VERIFIED) WALLET
  // =========================================================================
  describe("2. Registration with Manual vs Connected Wallet & Conflict Protection", () => {
    it("stores manually entered wallet address as verified: false during registration and upgrades to verified: true only after cryptographic signature", async () => {
      // 1. Register with a manually entered Algorand address (no signature)
      const regRes = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Manual Wallet Student",
          email: "mw.manual@evalora.io",
          password: "Password123!",
          phone: "+91 9123456780",
          walletAddress: algoAddr1,
          walletType: "pera",
          network: "algorand",
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);
      // Must NOT be treated as verified ownership yet!
      expect(regRes.body.user.walletAddress).toBeUndefined();
      expect(regRes.body.user.wallets).toHaveLength(1);
      expect(regRes.body.user.wallets[0]).toMatchObject({
        address: algoAddr1,
        walletType: "pera",
        network: "algorand",
        verified: false,
      });

      // Mark user emailVerified so they can log in and verify ownership
      await User.updateOne(
        { email: "mw.manual@evalora.io" },
        { $set: { emailVerified: true } }
      );

      // 2. Now prove cryptographic ownership of algoAddr1 via wallet login -> upgrades verified: false to verified: true!
      const chalRes = await request(app)
        .post("/api/wallet/challenge")
        .send({ walletAddress: algoAddr1, walletType: "pera", network: "algorand" });

      const sig1 = signAlgoChallenge(chalRes.body.challenge, algoWallet1);
      const verifyRes = await request(app)
        .post("/api/wallet/verify")
        .send({
          walletAddress: algoAddr1,
          walletType: "pera",
          network: "algorand",
          challenge: chalRes.body.challenge,
          signature: sig1,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.user.email).toBe("mw.manual@evalora.io");
      expect(verifyRes.body.user.walletAddress).toBe(algoAddr1);
      expect(verifyRes.body.user.wallets[0].verified).toBe(true);

      // 3. Another user attempting to register with the now-verified algoAddr1 must receive 409 Conflict!
      const conflictRegRes = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Conflict Student",
          email: "mw.conflict@evalora.io",
          password: "Password123!",
          walletAddress: algoAddr1,
          walletType: "pera",
          network: "algorand",
        });

      expect(conflictRegRes.status).toBe(409);
      expect(conflictRegRes.body.message).toContain(
        "Wallet already linked to another account"
      );
    });

    it("registers an account with a connected & signed wallet immediately marked verified: true", async () => {
      const chalRes = await request(app)
        .post("/api/wallet/challenge")
        .send({
          walletAddress: algoAddr2,
          walletType: "pera",
          network: "algorand",
          purpose: "REGISTER_WALLET",
        });

      const sig2 = signAlgoChallenge(chalRes.body.challenge, algoWallet2);

      const regRes = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Connected Wallet Student",
          email: "mw.connected@evalora.io",
          password: "Password123!",
          walletAddress: algoAddr2,
          walletType: "pera",
          network: "algorand",
          challenge: chalRes.body.challenge,
          signature: sig2,
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.user.walletAddress).toBe(algoAddr2);
      expect(regRes.body.user.wallets[0]).toMatchObject({
        address: algoAddr2,
        walletType: "pera",
        network: "algorand",
        verified: true,
      });
    });
  });

  // =========================================================================
  // 3. MULTIPLE WALLETS PER USER & LOCKOUT-SAFE UNLINKING
  // =========================================================================
  describe("3. Multiple Wallets Per User & Lockout Prevention", () => {
    it("allows linking multiple wallets across networks to one account and prevents unlinking a user's only login method", async () => {
      // Log in as mw.onboarded@evalora.io (who already has MetaMask evmWallet1 linked)
      const chalLogin = await request(app)
        .post("/api/wallet/challenge")
        .send({
          walletAddress: evmWallet1.address,
          walletType: "metamask",
          network: "ethereum",
        });
      const loginRes = await request(app)
        .post("/api/wallet/verify")
        .send({
          walletAddress: evmWallet1.address,
          walletType: "metamask",
          network: "ethereum",
          challenge: chalLogin.body.challenge,
          signature: evmWallet1.sign(chalLogin.body.challenge),
        });
      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Link a second wallet (EVM wallet 2) to the same user
      const linkChal = await request(app)
        .post("/api/wallet/challenge")
        .set("Authorization", `Bearer ${token}`)
        .send({
          walletAddress: evmWallet2.address,
          walletType: "metamask",
          network: "ethereum",
          purpose: "LINK_WALLET",
        });
      const linkRes = await request(app)
        .post("/api/wallet/link")
        .set("Authorization", `Bearer ${token}`)
        .send({
          walletAddress: evmWallet2.address,
          walletType: "metamask",
          network: "ethereum",
          challenge: linkChal.body.challenge,
          signature: evmWallet2.sign(linkChal.body.challenge),
        });

      expect(linkRes.status).toBe(200);
      expect(linkRes.body.user.wallets).toHaveLength(2);

      // Unlink evmWallet2 -> succeeds because evmWallet1 + email remain
      const unlinkRes = await request(app)
        .post("/api/wallet/unlink")
        .set("Authorization", `Bearer ${token}`)
        .send({
          walletAddress: evmWallet2.address,
          network: "ethereum",
        });
      expect(unlinkRes.status).toBe(200);
      expect(unlinkRes.body.user.wallets).toHaveLength(1);

      // Now create a wallet-only user (synthetic email, no password) and verify lockout prevention
      const onlyChal = await request(app)
        .post("/api/wallet/challenge")
        .send({ walletAddress: algoAddrOnly });
      const onlyVerify = await request(app)
        .post("/api/wallet/verify")
        .send({
          walletAddress: algoAddrOnly,
          challenge: onlyChal.body.challenge,
          signature: signAlgoChallenge(onlyChal.body.challenge, algoWalletOnly),
        });
      expect(onlyVerify.status).toBe(200);

      const lockoutUnlink = await request(app)
        .post("/api/wallet/unlink")
        .set("Authorization", `Bearer ${onlyVerify.body.token}`);
      expect(lockoutUnlink.status).toBe(400);
      expect(lockoutUnlink.body.message).toContain(
        "You cannot remove your only login method"
      );
    });
  });

  // =========================================================================
  // 4. DESKTOP QR LOGIN USING MOBILE WALLET (SECTIONS 9, 10, 11, 12, 27)
  // =========================================================================
  describe("4. Desktop QR Login Session Lifecycle & Security", () => {
    it("completes full QR login flow (PENDING -> SCANNED/SIGNING -> VERIFIED -> Desktop Claim) and blocks replay/second use", async () => {
      // 1. Desktop creates QR session
      const createRes = await request(app)
        .post("/api/wallet/qr/create")
        .send({ walletType: "pera", network: "algorand" });

      expect(createRes.status).toBe(201);
      expect(createRes.body.status).toBe("PENDING");
      expect(createRes.body.sessionId).toBeDefined();
      expect(createRes.body.nonce).toBeDefined();
      expect(createRes.body.qrUri).toContain("evalora://wallet-auth");
      // Security rule: QR payload must never contain private keys or seed phrases
      expect(JSON.stringify(createRes.body)).not.toMatch(
        /privateKey|seedPhrase|mnemonic|secret/i
      );

      const sessionId = createRes.body.sessionId;

      // 2. Desktop polls status -> PENDING
      const poll1 = await request(app).get(
        `/api/wallet/qr/${sessionId}/status`
      );
      expect(poll1.status).toBe(200);
      expect(poll1.body.status).toBe("PENDING");

      // 3. Mobile wallet scans QR -> binds algoAddrQr to prevent hijacking
      const scanRes = await request(app)
        .post(`/api/wallet/qr/${sessionId}/scan`)
        .send({
          walletAddress: algoAddrQr,
          walletType: "pera",
          network: "algorand",
        });
      expect(scanRes.status).toBe(200);
      expect(scanRes.body.status).toBe("SIGNING");

      // 4. Another wallet (algoAddr1) tries to hijack the scanned QR session -> 403 Forbidden!
      const hijackSig = signAlgoChallenge(scanRes.body.challenge, algoWallet1);
      const hijackRes = await request(app)
        .post(`/api/wallet/qr/${sessionId}/verify`)
        .send({
          walletAddress: algoAddr1,
          walletType: "pera",
          network: "algorand",
          signature: hijackSig,
        });
      expect(hijackRes.status).toBe(403);

      // 5. Mobile wallet signs with valid key (algoWalletQr) and approves
      const validMobileSig = signAlgoChallenge(
        scanRes.body.challenge,
        algoWalletQr
      );
      const approveRes = await request(app)
        .post(`/api/wallet/qr/${sessionId}/verify`)
        .send({
          walletAddress: algoAddrQr,
          walletType: "pera",
          network: "algorand",
          signature: validMobileSig,
        });
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.status).toBe("VERIFIED");

      // 6. Replay attack on mobile approve endpoint -> 409 Conflict
      const replayApproveRes = await request(app)
        .post(`/api/wallet/qr/${sessionId}/verify`)
        .send({
          walletAddress: algoAddrQr,
          walletType: "pera",
          network: "algorand",
          signature: validMobileSig,
        });
      expect(replayApproveRes.status).toBe(409);

      // 7. Desktop polls status -> receives VERIFIED + JWT token once
      const desktopClaimRes = await request(app).get(
        `/api/wallet/qr/${sessionId}/status`
      );
      expect(desktopClaimRes.status).toBe(200);
      expect(desktopClaimRes.body.status).toBe("VERIFIED");
      expect(desktopClaimRes.body.token).toBeDefined();
      expect(desktopClaimRes.body.user.walletAddress).toBe(algoAddrQr);

      // 8. Second desktop claim / replay of the same QR session -> 409 Conflict!
      const secondClaimRes = await request(app).get(
        `/api/wallet/qr/${sessionId}/status`
      );
      expect(secondClaimRes.status).toBe(409);
    });

    it("handles QR rejection, QR cancellation, QR expiration, and concurrent QR sessions cleanly", async () => {
      // Concurrent sessions A (will be rejected), B (will be cancelled), C (will expire)
      const [sessA, sessB, sessC] = await Promise.all([
        request(app).post("/api/wallet/qr/create").send({ walletType: "pera" }),
        request(app).post("/api/wallet/qr/create").send({ walletType: "pera" }),
        request(app).post("/api/wallet/qr/create").send({ walletType: "pera" }),
      ]);

      const idA = sessA.body.sessionId;
      const idB = sessB.body.sessionId;
      const idC = sessC.body.sessionId;

      // Case A: Mobile user rejects authentication
      const rejectRes = await request(app)
        .post(`/api/wallet/qr/${idA}/verify`)
        .send({ rejected: true });
      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.status).toBe("REJECTED");

      const statusA = await request(app).get(`/api/wallet/qr/${idA}/status`);
      expect(statusA.body.status).toBe("REJECTED");

      // Case B: Desktop user cancels QR session
      const cancelRes = await request(app).post(`/api/wallet/qr/${idB}/cancel`);
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.status).toBe("CANCELLED");

      // Attempting to scan a cancelled session fails (401)
      const scanCancelled = await request(app)
        .post(`/api/wallet/qr/${idB}/scan`)
        .send({ walletAddress: algoAddrQr });
      expect(scanCancelled.status).toBe(401);

      // Case C: QR session expires
      await QrAuthSession.updateOne(
        { sessionId: idC },
        { $set: { expiresAt: new Date(Date.now() - 10_000) } }
      );

      const statusC = await request(app).get(`/api/wallet/qr/${idC}/status`);
      expect(statusC.status).toBe(200);
      expect(statusC.body.status).toBe("EXPIRED");

      // Attempting to approve an expired QR session fails (401)
      const approveExpired = await request(app)
        .post(`/api/wallet/qr/${idC}/verify`)
        .send({
          walletAddress: algoAddrQr,
          signature: signAlgoChallenge(sessC.body.challenge, algoWalletQr),
        });
      expect(approveExpired.status).toBe(401);
    });
  });
});

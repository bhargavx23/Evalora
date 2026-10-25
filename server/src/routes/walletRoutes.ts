import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  requestWalletChallenge,
  verifyWalletSignature,
  completeWalletOnboarding,
  linkWallet,
  unlinkWallet,
  createQrAuthSession,
  scanQrAuthSession,
  verifyQrAuthSession,
  getQrAuthStatus,
  cancelQrAuthSession,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import { ENV } from "../config/env.js";

const router = Router();

const walletRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: ENV.NODE_ENV === "test" || ENV.NODE_ENV === "development" ? 1000 : 45,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many wallet verification requests. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
});

// Multi-wallet challenge, verification, onboarding & account linking
router.post("/challenge", walletRateLimiter, requestWalletChallenge);
router.post("/verify", walletRateLimiter, verifyWalletSignature);
router.post("/complete-onboarding", walletRateLimiter, completeWalletOnboarding);
router.post("/link", authenticate, walletRateLimiter, linkWallet);
router.post("/unlink", authenticate, walletRateLimiter, unlinkWallet);

// Desktop QR Mobile Wallet Login Routes
router.post("/qr/create", walletRateLimiter, createQrAuthSession);
router.get("/qr/:sessionId/status", walletRateLimiter, getQrAuthStatus);
router.post("/qr/:sessionId/scan", walletRateLimiter, scanQrAuthSession);
router.post("/qr/:sessionId/verify", walletRateLimiter, verifyQrAuthSession);
router.post("/qr/:sessionId/approve", walletRateLimiter, verifyQrAuthSession);
router.post("/qr/:sessionId/cancel", walletRateLimiter, cancelQrAuthSession);

export default router;

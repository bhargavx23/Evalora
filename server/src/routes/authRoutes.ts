import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  getCurrentUser,
  getGoogleOAuthStatus,
  handleGoogleOAuthCallback,
  login,
  loginWithOTP,
  requestOTP,
  verifyEmail,
  logout,
  register,
  registerCollege,
  resetPassword,
  startGoogleOAuth,
  requestWalletChallenge,
  verifyWalletSignature,
  completeWalletOnboarding,
  linkWallet,
  unlinkWallet,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication code attempts. Please try again later.",
  },
});

router.post("/login", login);
router.post("/otp/request", otpRateLimiter, requestOTP);
router.post("/otp/login", otpRateLimiter, loginWithOTP);
router.post("/otp/complete-onboarding", otpRateLimiter, completeWalletOnboarding);
router.post("/otp/verify-email", otpRateLimiter, verifyEmail);
router.post("/password-reset", otpRateLimiter, resetPassword);
router.post("/algorand/challenge", otpRateLimiter, requestWalletChallenge);
router.post("/algorand/verify", otpRateLimiter, verifyWalletSignature);
router.post("/algorand/link", authenticate, otpRateLimiter, linkWallet);
router.post("/algorand/unlink", authenticate, otpRateLimiter, unlinkWallet);
router.post("/register", register);
router.post("/register-college", registerCollege);
router.get("/google/status", getGoogleOAuthStatus);
router.get("/google", startGoogleOAuth);
router.get("/google/callback", handleGoogleOAuthCallback);
router.get("/me", authenticate, getCurrentUser);
router.post("/logout", logout);

export default router;


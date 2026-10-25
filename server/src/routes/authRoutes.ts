import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  getCurrentUser,
  getGoogleOAuthStatus,
  handleGoogleOAuthCallback,
  login,
  logout,
  register,
  registerCollege,
  startGoogleOAuth,
  requestWalletChallenge,
  verifyWalletSignature,
  linkWallet,
  unlinkWallet,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

const authActionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },
});

router.post("/login", login);
router.post("/algorand/challenge", authActionRateLimiter, requestWalletChallenge);
router.post("/algorand/verify", authActionRateLimiter, verifyWalletSignature);
router.post("/algorand/link", authenticate, authActionRateLimiter, linkWallet);
router.post("/algorand/unlink", authenticate, authActionRateLimiter, unlinkWallet);
router.post("/register", register);
router.post("/register-college", registerCollege);
router.get("/google/status", getGoogleOAuthStatus);
router.get("/google", startGoogleOAuth);
router.get("/google/callback", handleGoogleOAuthCallback);
router.get("/me", authenticate, getCurrentUser);
router.post("/logout", logout);

export default router;


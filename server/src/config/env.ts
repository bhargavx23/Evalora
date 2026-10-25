import dotenv from "dotenv";
import path from "path";

for (const envPath of [
  path.resolve(process.cwd(), "server", ".env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", ".env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
]) {
  dotenv.config({ path: envPath, override: true });
}

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/evalora",
  JWT_SECRET:
    process.env.JWT_SECRET ||
    "evalora-super-secure-production-jwt-secret-key-2026",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.AI_API_KEY || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  AI_PROVIDER: (process.env.AI_PROVIDER || "gemini").toLowerCase() as "gemini" | "openai",
  AI_FALLBACK_PROVIDER: (process.env.AI_FALLBACK_PROVIDER || "").toLowerCase() as "gemini" | "openai" | "",
  AI_MODEL: process.env.AI_MODEL || "",
  GEMINI_MODEL: process.env.GEMINI_MODEL || process.env.AI_MODEL || "gemini-3.8-flash",
  OPENAI_MODEL: process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini",
  AI_TEMPERATURE: process.env.AI_TEMPERATURE
    ? parseFloat(process.env.AI_TEMPERATURE)
    : 0.4,
  AI_MAX_OUTPUT_TOKENS: process.env.AI_MAX_OUTPUT_TOKENS
    ? parseInt(process.env.AI_MAX_OUTPUT_TOKENS, 10)
    : 4096,
  AI_TIMEOUT_MS: process.env.AI_TIMEOUT
    ? parseInt(process.env.AI_TIMEOUT, 10)
    : 45000,
  AI_MAX_RETRIES: process.env.AI_MAX_RETRIES
    ? parseInt(process.env.AI_MAX_RETRIES, 10)
    : 2,
  AI_MAX_GENERATION_BATCH: process.env.AI_MAX_GENERATION_BATCH
    ? parseInt(process.env.AI_MAX_GENERATION_BATCH, 10)
    : 10,
  AI_MAX_REPLENISH_PER_SESSION: process.env.AI_MAX_REPLENISH_PER_SESSION
    ? parseInt(process.env.AI_MAX_REPLENISH_PER_SESSION, 10)
    : 20,
  AI_RATE_LIMIT_PER_MINUTE: process.env.AI_RATE_LIMIT_PER_MINUTE
    ? parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE, 10)
    : 15,
  AI_SIMILARITY_THRESHOLD: process.env.AI_SIMILARITY_THRESHOLD
    ? parseFloat(process.env.AI_SIMILARITY_THRESHOLD)
    : 0.72,
  AI_AUTO_REPLENISH: process.env.AI_AUTO_REPLENISH !== "false",
  AI_FORCE_FRESH_EVERY_TIME: process.env.AI_FORCE_FRESH_EVERY_TIME === "true",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || "",
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || "Evalora",
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || "",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || "",
  AUTH_CHALLENGE_MAX_ATTEMPTS: process.env.AUTH_CHALLENGE_MAX_ATTEMPTS
    ? parseInt(process.env.AUTH_CHALLENGE_MAX_ATTEMPTS, 10)
    : 5,
  EXECUTION_TIMEOUT_MS: process.env.EXECUTION_TIMEOUT_MS
    ? parseInt(process.env.EXECUTION_TIMEOUT_MS, 10)
    : 4000,
  MAX_OUTPUT_SIZE_BYTES: 1024 * 512, // 512 KB
  RESUME_MAX_SIZE_BYTES: 5 * 1024 * 1024,
  // Algorand Blockchain & Multi-Wallet Configuration
  BLOCKCHAIN_NETWORK: (
    process.env.BLOCKCHAIN_NETWORK ||
    process.env.ALGORAND_NETWORK ||
    process.env.ALGOD_NETWORK ||
    "testnet"
  ).toLowerCase(),
  ALGORAND_NETWORK: (
    process.env.ALGORAND_NETWORK ||
    process.env.ALGOD_NETWORK ||
    "testnet"
  ).toLowerCase(),
  ALGORAND_RPC_URL:
    process.env.ALGORAND_RPC_URL ||
    process.env.ALGOD_SERVER ||
    "https://testnet-api.algonode.cloud",
  ALGOD_NETWORK: (
    process.env.ALGOD_NETWORK ||
    process.env.ALGORAND_NETWORK ||
    "testnet"
  ).toLowerCase() as
    | "testnet"
    | "mainnet"
    | "betanet"
    | "localnet",
  ALGOD_SERVER:
    process.env.ALGOD_SERVER ||
    process.env.ALGORAND_RPC_URL ||
    "https://testnet-api.algonode.cloud",
  ALGOD_PORT: process.env.ALGOD_PORT || "443",
  ALGOD_TOKEN: process.env.ALGOD_TOKEN || "",
  ALGOD_INDEXER_SERVER:
    process.env.ALGOD_INDEXER_SERVER || "https://testnet-idx.algonode.cloud",
  ALGOD_INDEXER_PORT: process.env.ALGOD_INDEXER_PORT || "443",
  ALGOD_INDEXER_TOKEN: process.env.ALGOD_INDEXER_TOKEN || "",
  EVALORA_ADMIN_EMAIL: (process.env.EVALORA_ADMIN_EMAIL || "bhargavpasupuleti5@gmail.com").toLowerCase().trim(),
  EVALORA_ADMIN_WALLET: (process.env.EVALORA_ADMIN_WALLET || "WLLFEO5GNYDMQTM3RWKC6MTMQDI6QUZEVQF22JPKKOECX2N24CZWYJM2BA").trim().toUpperCase(),
  EVALORA_PAYMENT_WALLET: (process.env.EVALORA_PAYMENT_WALLET || process.env.EVALORA_ADMIN_WALLET || "WLLFEO5GNYDMQTM3RWKC6MTMQDI6QUZEVQF22JPKKOECX2N24CZWYJM2BA").trim().toUpperCase(),
  PAYMENT_INTENT_EXPIRY_MINUTES: process.env.PAYMENT_INTENT_EXPIRY_MINUTES
    ? parseInt(process.env.PAYMENT_INTENT_EXPIRY_MINUTES, 10)
    : 15,
  WALLET_CHALLENGE_EXPIRY_MINUTES: process.env.WALLET_CHALLENGE_EXPIRY_MINUTES
    ? parseInt(process.env.WALLET_CHALLENGE_EXPIRY_MINUTES, 10)
    : 5,
  WALLET_AUTH_CHALLENGE_TTL: process.env.WALLET_AUTH_CHALLENGE_TTL
    ? parseInt(process.env.WALLET_AUTH_CHALLENGE_TTL, 10)
    : 300,
  QR_SESSION_TTL: process.env.QR_SESSION_TTL
    ? parseInt(process.env.QR_SESSION_TTL, 10)
    : 180,
};


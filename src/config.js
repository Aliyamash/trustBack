import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveFromBackend(value, fallback) {
  const configured = value || fallback;
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(backendRoot, configured);
}

function parseTrustProxy(value) {
  if (!value) return false;
  if (value === "true") return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export const config = {
  port: Number(process.env.PORT || 8000),
  host: process.env.HOST || "127.0.0.1",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  adminApiKey: process.env.ADMIN_API_KEY || "",
  databasePath: resolveFromBackend(process.env.DATABASE_PATH, "./data/trustence.sqlite"),
  uploadDir: resolveFromBackend(process.env.UPLOAD_DIR, "./uploads"),
  seedAssetDir: resolveFromBackend(process.env.SEED_ASSET_DIR, "./seed-assets"),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_SIZE_MB || 8) * 1024 * 1024,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
};

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./auth/auth.js";
import userRoutes from "./routes/user.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const app = express();
const PORT = process.env.PORT || 4000;

// ─────────────────────────────────────────────
// SECURITY HEADERS
// ─────────────────────────────────────────────
app.use(helmet());

// ─────────────────────────────────────────────
// CORS — allow frontend & admin origins (local + production)
// ─────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://vela-noire.vercel.app",
  "https://velanoire-backend-production.up.railway.app",
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// ─────────────────────────────────────────────
// RATE LIMITING — global: 100 req / 15 min
// ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use(limiter);

// ─────────────────────────────────────────────
// BETTER AUTH — must come BEFORE json/body parser
// Handles: /api/auth/sign-in, /api/auth/sign-up,
//          /api/auth/callback/google, etc.
//
// NOTE: We use a root-level interceptor (NOT app.use("/api/auth"))
// because Express 5 strips the mount prefix from req.url, breaking
// Better Auth's internal router. This way req.url is always the full path.
// ─────────────────────────────────────────────
const authHandler = toNodeHandler(auth);
app.use((req, res, next) => {
  if (!req.url.startsWith("/api/auth")) return next();
  return authHandler(req, res);
});

// ─────────────────────────────────────────────
// BODY PARSERS (after auth handler)
// ─────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// ─────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────
app.use("/api/user", userRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/admin", adminRoutes);

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV });
});

// ─────────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ─────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[ERROR]", err);
  res.status(500).json({ error: "Internal server error." });
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ VELA NOIRE backend running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
});

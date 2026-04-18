import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { dash } from "@better-auth/infra";
import { prisma } from "../lib/prisma.js";

export const auth = betterAuth({
  // ── Database ──────────────────────────────────────────────────────────────
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // ── Secret & base URL ────────────────────────────────────────────────────
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4000",

  // ── Rate limiting ─────────────────────────────────────────────────────────
  rateLimit: {
    enabled: process.env.NODE_ENV === "production", // disabled in dev
    window: 60, // seconds
    max: 20, // attempts per window (prod only)
  },

  // ── Email & Password ─────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // re-enable once Resend is configured
    minPasswordLength: 8,
  },

  // ── Google OAuth ─────────────────────────────────────────────────────────
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },

  // ── Session ───────────────────────────────────────────────────────────────
  // Database sessions — revocable, safer for e-commerce (fraud protection)
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh session if >1 day old
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // cache session in cookie for 5 min
    },
  },

  // ── Trusted origins (CORS) ────────────────────────────────────────────────
  trustedOrigins: [
    // Local dev
    "http://localhost:3000",
    "http://localhost:3001",
    // Production
    "https://vela-noire.vercel.app",
    "https://velanoire-backend-production.up.railway.app",
    // Dynamic from env (overrides above in Railway)
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
  ].filter(Boolean),

  // ── User extra fields ────────────────────────────────────────────────────
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        // Include in session so clients can read it from useSession()
        input: false, // clients cannot set this — only set via DB/admin
      },
      username: { type: "string", required: false },
      phone: { type: "string", required: false },
      country: { type: "string", required: false },
      locale: { type: "string", required: false },
    },
  },
  // ── Plugins ───────────────────────────────────────────────────────────────
  plugins: [
    dash(), // Better Auth dashboard (https://better-auth.dev/dash)
  ],
});

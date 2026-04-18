import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { prisma } from "../lib/prisma.js";
import {
  generateSignature,
  deleteResource,
  UPLOAD_FOLDERS,
} from "../lib/cloudinary.js";

const router = Router();

// ─────────────────────────────────────────────
// ALLOWED FOLDERS PER ROLE
// admin: all folders
// auth user: measurements only (custom order photos)
// ─────────────────────────────────────────────
const ADMIN_FOLDERS = [
  "products",
  "variants",
  "collections",
  "videos",
  "models",
  "modelVideos",
];
const USER_FOLDERS = ["measurements"];

// ─────────────────────────────────────────────
// GET /api/upload/sign
//
// Returns a short-lived Cloudinary signature so the
// client can upload directly to Cloudinary without
// routing file bytes through this server.
//
// Query params:
//   folder  — one of: products | variants | collections | videos | measurements
//   type    — "image" (default) | "video"
//
// Admin can sign for: products, variants, collections, videos, measurements
// Auth user can sign for: measurements only
// ─────────────────────────────────────────────
router.get("/sign", requireAuth, async (req, res) => {
  try {
    const { folder: folderKey, type = "image" } = req.query;

    // Validate folder key
    if (!folderKey || !UPLOAD_FOLDERS[folderKey]) {
      return res.status(400).json({
        error: `Invalid folder. Must be one of: ${Object.keys(UPLOAD_FOLDERS).join(", ")}`,
      });
    }

    // Validate resource type
    if (!["image", "video"].includes(type)) {
      return res
        .status(400)
        .json({ error: "Invalid type. Must be 'image' or 'video'." });
    }

    // Check permissions — always fetch role fresh from DB (session may not include it)
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === "admin";
    if (!isAdmin && !USER_FOLDERS.includes(folderKey)) {
      return res
        .status(403)
        .json({ error: "Forbidden. Admin access required for this folder." });
    }

    const cloudinaryFolder = UPLOAD_FOLDERS[folderKey];
    const signedParams = generateSignature(cloudinaryFolder, type);

    res.json({
      ...signedParams,
      resourceType: type,
    });
  } catch (err) {
    console.error("[upload/sign]", err);
    res.status(500).json({ error: "Failed to generate upload signature." });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/upload
//
// Permanently removes an asset from Cloudinary.
// Admin only — called when replacing or removing
// a product image / collection hero / variant image.
//
// Body: { publicId: string, resourceType?: "image" | "video" }
// ─────────────────────────────────────────────
router.delete("/", requireAdmin, async (req, res) => {
  try {
    const { publicId, resourceType = "image" } = req.body;

    if (!publicId || typeof publicId !== "string") {
      return res.status(400).json({ error: "publicId is required." });
    }

    if (!["image", "video"].includes(resourceType)) {
      return res
        .status(400)
        .json({ error: "resourceType must be 'image' or 'video'." });
    }

    // Enforce that public IDs belong to vela-noire namespace
    if (!publicId.startsWith("vela-noire/")) {
      return res.status(400).json({ error: "Invalid publicId namespace." });
    }

    const result = await deleteResource(publicId, resourceType);

    if (result.result === "ok" || result.result === "not found") {
      return res.json({ success: true, result: result.result });
    }

    res
      .status(500)
      .json({ error: "Cloudinary deletion failed.", detail: result });
  } catch (err) {
    console.error("[upload/delete]", err);
    res.status(500).json({ error: "Failed to delete asset." });
  }
});

export default router;

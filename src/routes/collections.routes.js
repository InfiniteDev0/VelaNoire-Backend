import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// GET /api/admin/collections — list all (used by product form dropdowns)
router.get("/", requireAdmin, async (req, res) => {
  try {
    const collections = await prisma.collection.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        tagline: true,
        _count: { select: { products: true } },
      },
    });
    res.json({ collections });
  } catch (err) {
    console.error("[GET /collections]", err);
    res.status(500).json({ error: "Failed to fetch collections." });
  }
});

// GET /api/admin/collections/:idOrSlug — single collection detail (accepts id OR slug)
router.get("/:idOrSlug", requireAdmin, async (req, res) => {
  try {
    const param = req.params.idOrSlug;
    const collection = await prisma.collection.findFirst({
      where: { OR: [{ id: param }, { slug: param }] },
      include: { _count: { select: { products: true } } },
    });
    if (!collection)
      return res.status(404).json({ error: "Collection not found." });
    res.json({ collection });
  } catch (err) {
    console.error("[GET /collections/:idOrSlug]", err);
    res.status(500).json({ error: "Failed to fetch collection." });
  }
});

// PATCH /api/admin/collections/:id — update hero image / hero video / fields
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const allowed = [
      "name",
      "tagline",
      "description",
      "heroImage",
      "heroVideo",
    ];
    const data = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k)),
    );
    if (Object.keys(data).length === 0)
      return res.status(400).json({ error: "No valid fields to update." });

    const collection = await prisma.collection.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ collection });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Collection not found." });
    console.error("[PATCH /collections/:id]", err);
    res.status(500).json({ error: "Failed to update collection." });
  }
});

export default router;

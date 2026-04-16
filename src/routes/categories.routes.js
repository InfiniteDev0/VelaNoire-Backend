import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// GET /api/admin/categories — list all
router.get("/", requireAdmin, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { products: true } },
      },
    });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories." });
  }
});

// POST /api/admin/categories — create
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim())
      return res.status(400).json({ error: "Name is required." });
    const slug = slugify(name.trim());
    const category = await prisma.category.create({
      data: { name: name.trim(), slug },
    });
    res.status(201).json({ category });
  } catch (err) {
    if (err.code === "P2002")
      return res.status(409).json({ error: "Category already exists." });
    res.status(500).json({ error: "Failed to create category." });
  }
});

// DELETE /api/admin/categories/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Category not found." });
    if (err.code === "P2003")
      return res
        .status(409)
        .json({ error: "Category has products — reassign them first." });
    res.status(500).json({ error: "Failed to delete category." });
  }
});

export default router;

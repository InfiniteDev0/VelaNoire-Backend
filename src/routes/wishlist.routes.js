import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// GET /api/wishlist — get user's wishlist
router.get("/", requireAuth, async (req, res) => {
  const items = await prisma.wishlistItem.findMany({
    where: { userId: req.user.id },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items });
});

// POST /api/wishlist/:productId — add to wishlist
router.post("/:productId", requireAuth, async (req, res) => {
  try {
    const item = await prisma.wishlistItem.create({
      data: { userId: req.user.id, productId: req.params.productId },
    });
    res.status(201).json({ item });
  } catch (err) {
    if (err.code === "P2002")
      return res.status(409).json({ error: "Already in wishlist." });
    res.status(500).json({ error: "Failed to add to wishlist." });
  }
});

// DELETE /api/wishlist/:productId — remove from wishlist
router.delete("/:productId", requireAuth, async (req, res) => {
  await prisma.wishlistItem.deleteMany({
    where: { userId: req.user.id, productId: req.params.productId },
  });
  res.json({ message: "Removed from wishlist." });
});

export default router;

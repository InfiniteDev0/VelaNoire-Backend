import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// GET /api/cart — get user's cart (regular + gift items)
router.get("/", requireAuth, async (req, res) => {
  const items = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items });
});

// POST /api/cart — add or update item in cart
router.post("/", requireAuth, async (req, res) => {
  const { productId, quantity = 1, isGift = false } = req.body;
  if (!productId)
    return res.status(400).json({ error: "productId is required." });

  try {
    const item = await prisma.cartItem.upsert({
      where: { userId_productId: { userId: req.user.id, productId } },
      update: { quantity, isGift },
      create: { userId: req.user.id, productId, quantity, isGift },
    });
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: "Failed to update cart." });
  }
});

// DELETE /api/cart/:productId — remove item
router.delete("/:productId", requireAuth, async (req, res) => {
  await prisma.cartItem.deleteMany({
    where: { userId: req.user.id, productId: req.params.productId },
  });
  res.json({ message: "Removed from cart." });
});

// DELETE /api/cart — clear entire cart
router.delete("/", requireAuth, async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { userId: req.user.id } });
  res.json({ message: "Cart cleared." });
});

export default router;

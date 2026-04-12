import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// GET /api/user/me — get current user profile
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        image: true,
        phone: true,
        country: true,
        locale: true,
        createdAt: true,
      },
    });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile." });
  }
});

// PATCH /api/user/me — update profile fields
router.patch("/me", requireAuth, async (req, res) => {
  const { name, username, phone, country, locale } = req.body;
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, username, phone, country, locale },
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        country: true,
        locale: true,
      },
    });
    res.json({ user: updated });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Username already taken." });
    }
    res.status(500).json({ error: "Failed to update profile." });
  }
});

export default router;

import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// GET /api/admin/me — verify admin session and return admin profile
router.get("/me", requireAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        createdAt: true,
      },
    });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch admin profile." });
  }
});

export default router;

import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

// ─────────────────────────────────────────────
// PUBLIC — no auth required
// These endpoints are consumed by the storefront.
// Only expose safe, customer-facing fields.
// ─────────────────────────────────────────────

// GET /api/store/collections/:slug
// Returns one collection's public fields (name, tagline, heroImage, heroVideo)
router.get("/collections/:slug", async (req, res) => {
  try {
    const collection = await prisma.collection.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true,
        name: true,
        slug: true,
        tagline: true,
        description: true,
        heroImage: true,
        heroVideo: true,
      },
    });
    if (!collection)
      return res.status(404).json({ error: "Collection not found." });
    res.json({ collection });
  } catch (err) {
    console.error("[GET /store/collections/:slug]", err);
    res.status(500).json({ error: "Failed to fetch collection." });
  }
});

// GET /api/store/collections
// All collections — name, slug, tagline, heroImage only (for nav / collection grid)
router.get("/collections", async (req, res) => {
  try {
    const collections = await prisma.collection.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        tagline: true,
        heroImage: true,
      },
      orderBy: { name: "asc" },
    });
    res.json({ collections });
  } catch (err) {
    console.error("[GET /store/collections]", err);
    res.status(500).json({ error: "Failed to fetch collections." });
  }
});

// GET /api/store/products
// Public product list — only LIVE products, safe fields only
// Supports: ?collection=slug&limit=8&page=1
router.get("/products", async (req, res) => {
  try {
    const { collection, limit = "8", page = "1" } = req.query;
    const take = Math.min(parseInt(limit, 10) || 8, 50);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where = { status: "LIVE" };
    if (collection) where.collection = { slug: collection };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          basePrice: true,
          discount: true,
          type: true,
          isNew: true,
          isBestSeller: true,
          isLimitedEdition: true,
          images: true,
          collection: { select: { name: true, slug: true } },
          variants: {
            select: {
              id: true,
              colorName: true,
              colorHex: true,
              images: true,
              priceOverride: true,
              isDefault: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: take,
        pages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    console.error("[GET /store/products]", err);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

// GET /api/store/models
// Public active brand models — name, slug, nationality, profileImage, first 3 campaign images
router.get("/models", async (req, res) => {
  try {
    const { limit = "6" } = req.query;
    const take = Math.min(parseInt(limit, 10) || 6, 20);

    const models = await prisma.brandModel.findMany({
      where: { isActive: true },
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        nationality: true,
        profileImage: true,
        images: true,
      },
    });
    res.json({ models });
  } catch (err) {
    console.error("[GET /store/models]", err);
    res.status(500).json({ error: "Failed to fetch models." });
  }
});

export default router;

import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { prisma } from "../lib/prisma.js";
import { deleteResource } from "../lib/cloudinary.js";

const router = Router();

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Auto-generate a URL slug from a product name */
function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Extract Cloudinary publicId from a secure_url */
function publicIdFromUrl(url) {
  // e.g. https://res.cloudinary.com/cloud/image/upload/v123/vela-noire/products/abc.jpg
  // → vela-noire/products/abc
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
  return match ? match[1] : null;
}

// ─────────────────────────────────────────────
// GET /api/admin/products
// List all products with variant count + stock sum
// Supports: ?status=LIVE&type=ABAYA&collection=xxx&search=term&page=1&limit=20
// ─────────────────────────────────────────────
router.get("/", requireAdmin, async (req, res) => {
  try {
    const {
      status,
      type,
      collection,
      search,
      page = "1",
      limit = "20",
    } = req.query;

    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (collection) where.collection = { slug: collection };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

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
          status: true,
          isNew: true,
          isBestSeller: true,
          isLimitedEdition: true,
          images: true,
          tags: true,
          createdAt: true,
          category: { select: { name: true, slug: true } },
          collection: { select: { name: true, slug: true } },
          variants: {
            select: {
              id: true,
              colorName: true,
              colorHex: true,
              stock: true,
              sku: true,
              isDefault: true,
              images: true,
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
    console.error("[GET /admin/products]", err);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

// ─────────────────────────────────────────────
// GET /api/admin/products/:id
// Single product — full detail including all variants
// ─────────────────────────────────────────────
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        collection: true,
        variants: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      },
    });
    if (!product) return res.status(404).json({ error: "Product not found." });
    res.json({ product });
  } catch (err) {
    console.error("[GET /admin/products/:id]", err);
    res.status(500).json({ error: "Failed to fetch product." });
  }
});

// ─────────────────────────────────────────────
// POST /api/admin/products
// Create product + variants in a single transaction
// ─────────────────────────────────────────────
router.post("/", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      basePrice,
      discount,
      type,
      status,
      categoryId,
      collectionId,
      season,
      images,
      fabric,
      availableStyles,
      availableSizes,
      availableLengths,
      shaylaIncluded,
      isNew,
      isBestSeller,
      isLimitedEdition,
      launchDate,
      releaseDate,
      tags,
      story,
      designer,
      caption,
      variants,
    } = req.body;

    // ── Validation ──────────────────────────────
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Product name is required." });
    }
    if (
      !basePrice ||
      isNaN(parseFloat(basePrice)) ||
      parseFloat(basePrice) < 0
    ) {
      return res.status(400).json({ error: "A valid base price is required." });
    }
    if (!categoryId) {
      return res.status(400).json({ error: "A category is required." });
    }
    if (!Array.isArray(variants) || variants.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one color variant is required." });
    }

    // Validate all variant SKUs are unique within this request
    const skus = variants.map((v) => v.sku).filter(Boolean);
    if (new Set(skus).size !== skus.length) {
      return res.status(400).json({ error: "Variant SKUs must be unique." });
    }
    if (skus.length !== variants.length) {
      return res.status(400).json({ error: "Each variant must have a SKU." });
    }

    // Auto-slug
    const baseSlug = slugify(name.trim());
    // Ensure uniqueness by appending timestamp on collision
    const existingSlug = await prisma.product.findUnique({
      where: { slug: baseSlug },
      select: { id: true },
    });
    const slug = existingSlug ? `${baseSlug}-${Date.now()}` : baseSlug;

    // ── Transaction: create product + variants ──
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: name.trim(),
          slug,
          description: description?.trim() || null,
          basePrice: parseFloat(basePrice),
          discount: parseFloat(discount || 0),
          type: type || "ABAYA",
          status: status || "IN_PRODUCTION",
          categoryId,
          collectionId: collectionId || null,
          season: season || null,
          images: Array.isArray(images)
            ? images.map((i) => (typeof i === "string" ? i : i.url))
            : [],
          fabric: fabric?.trim() || null,
          availableStyles: Array.isArray(availableStyles)
            ? availableStyles
            : [],
          availableSizes: Array.isArray(availableSizes) ? availableSizes : [],
          availableLengths: Array.isArray(availableLengths)
            ? availableLengths
            : [],
          shaylaIncluded: shaylaIncluded ?? null,
          isNew: isNew ?? true,
          isBestSeller: isBestSeller ?? false,
          isLimitedEdition: isLimitedEdition ?? false,
          launchDate: launchDate ? new Date(launchDate) : null,
          releaseDate: releaseDate ? new Date(releaseDate) : null,
          tags: Array.isArray(tags) ? tags : [],
          story: story?.trim() || null,
          designer: designer?.trim() || null,
          caption: caption?.trim() || null,
        },
      });

      await tx.productVariant.createMany({
        data: variants.map((v) => ({
          productId: created.id,
          colorName: v.colorName,
          colorHex: v.colorHex || null,
          sku: v.sku,
          stock: parseInt(v.stock, 10) || 0,
          priceOverride: v.priceOverride ? parseFloat(v.priceOverride) : null,
          isDefault: v.isDefault ?? false,
          images: Array.isArray(v.images)
            ? v.images.map((i) => (typeof i === "string" ? i : i.url))
            : [],
        })),
      });

      return tx.product.findUnique({
        where: { id: created.id },
        include: { variants: true, category: true, collection: true },
      });
    });

    res.status(201).json({ product });
  } catch (err) {
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ error: "A product variant SKU already exists." });
    }
    if (err.code === "P2003") {
      return res
        .status(400)
        .json({ error: "Invalid categoryId or collectionId." });
    }
    console.error("[POST /admin/products]", err);
    res.status(500).json({ error: "Failed to create product." });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/admin/products/:id
// Update product fields (partial update)
// Does NOT touch variants — those use their own sub-routes below
// ─────────────────────────────────────────────
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      basePrice,
      discount,
      type,
      status,
      categoryId,
      collectionId,
      season,
      images,
      fabric,
      availableStyles,
      availableSizes,
      availableLengths,
      shaylaIncluded,
      isNew,
      isBestSeller,
      isLimitedEdition,
      launchDate,
      releaseDate,
      tags,
      story,
      designer,
      caption,
    } = req.body;

    const data = {};
    if (name !== undefined) {
      data.name = name.trim();
      // Only regenerate slug if name actually changed
      const existing = await prisma.product.findUnique({
        where: { id: req.params.id },
        select: { name: true },
      });
      if (existing && existing.name !== name.trim()) {
        const baseSlug = slugify(name.trim());
        const collision = await prisma.product.findFirst({
          where: { slug: baseSlug, NOT: { id: req.params.id } },
          select: { id: true },
        });
        data.slug = collision ? `${baseSlug}-${Date.now()}` : baseSlug;
      }
    }
    if (description !== undefined)
      data.description = description?.trim() || null;
    if (basePrice !== undefined) data.basePrice = parseFloat(basePrice);
    if (discount !== undefined) data.discount = parseFloat(discount || 0);
    if (type !== undefined) data.type = type;
    if (status !== undefined) data.status = status;
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (collectionId !== undefined) data.collectionId = collectionId || null;
    if (season !== undefined) data.season = season || null;
    if (images !== undefined)
      data.images = images.map((i) => (typeof i === "string" ? i : i.url));
    if (fabric !== undefined) data.fabric = fabric?.trim() || null;
    if (availableStyles !== undefined) data.availableStyles = availableStyles;
    if (availableSizes !== undefined) data.availableSizes = availableSizes;
    if (availableLengths !== undefined)
      data.availableLengths = availableLengths;
    if (shaylaIncluded !== undefined) data.shaylaIncluded = shaylaIncluded;
    if (isNew !== undefined) data.isNew = isNew;
    if (isBestSeller !== undefined) data.isBestSeller = isBestSeller;
    if (isLimitedEdition !== undefined)
      data.isLimitedEdition = isLimitedEdition;
    if (launchDate !== undefined)
      data.launchDate = launchDate ? new Date(launchDate) : null;
    if (releaseDate !== undefined)
      data.releaseDate = releaseDate ? new Date(releaseDate) : null;
    if (tags !== undefined) data.tags = tags;
    if (story !== undefined) data.story = story?.trim() || null;
    if (designer !== undefined) data.designer = designer?.trim() || null;
    if (caption !== undefined) data.caption = caption?.trim() || null;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: { variants: true, category: true, collection: true },
    });

    res.json({ product });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Product not found." });
    console.error("[PATCH /admin/products/:id]", err);
    res.status(500).json({ error: "Failed to update product." });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/admin/products/:id
// Deletes product + all variants + their Cloudinary assets
// ─────────────────────────────────────────────
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { images: true, variants: { select: { images: true } } },
    });
    if (!product) return res.status(404).json({ error: "Product not found." });

    // Collect all Cloudinary public IDs to clean up
    const allUrls = [
      ...product.images,
      ...product.variants.flatMap((v) => v.images),
    ];
    const publicIds = allUrls.map(publicIdFromUrl).filter(Boolean);

    // Delete from DB first (variants cascade via schema)
    await prisma.product.delete({ where: { id: req.params.id } });

    // Clean up Cloudinary assets in background — don't block the response
    Promise.all(
      publicIds.map((pid) => deleteResource(pid).catch(() => null)),
    ).catch(() => null);

    res.json({ success: true });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Product not found." });
    console.error("[DELETE /admin/products/:id]", err);
    res.status(500).json({ error: "Failed to delete product." });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/admin/products/:id/variants/:variantId
// Update a single variant (stock, price, images, etc.)
// ─────────────────────────────────────────────
router.patch("/:id/variants/:variantId", requireAdmin, async (req, res) => {
  try {
    const {
      colorName,
      colorHex,
      sku,
      stock,
      priceOverride,
      isDefault,
      images,
    } = req.body;

    const data = {};
    if (colorName !== undefined) data.colorName = colorName;
    if (colorHex !== undefined) data.colorHex = colorHex;
    if (sku !== undefined) data.sku = sku;
    if (stock !== undefined) data.stock = parseInt(stock, 10);
    if (priceOverride !== undefined)
      data.priceOverride = priceOverride ? parseFloat(priceOverride) : null;
    if (isDefault !== undefined) data.isDefault = isDefault;
    if (images !== undefined)
      data.images = images.map((i) => (typeof i === "string" ? i : i.url));

    const variant = await prisma.productVariant.update({
      where: { id: req.params.variantId },
      data,
    });
    res.json({ variant });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Variant not found." });
    if (err.code === "P2002")
      return res.status(409).json({ error: "SKU already in use." });
    console.error("[PATCH /admin/products/:id/variants/:variantId]", err);
    res.status(500).json({ error: "Failed to update variant." });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/admin/products/:id/variants/:variantId
// Remove a variant + its Cloudinary images
// ─────────────────────────────────────────────
router.delete("/:id/variants/:variantId", requireAdmin, async (req, res) => {
  try {
    const variant = await prisma.productVariant.findUnique({
      where: { id: req.params.variantId },
      select: { images: true, productId: true },
    });
    if (!variant) return res.status(404).json({ error: "Variant not found." });
    if (variant.productId !== req.params.id)
      return res
        .status(400)
        .json({ error: "Variant does not belong to this product." });

    await prisma.productVariant.delete({ where: { id: req.params.variantId } });

    const publicIds = variant.images.map(publicIdFromUrl).filter(Boolean);
    Promise.all(
      publicIds.map((pid) => deleteResource(pid).catch(() => null)),
    ).catch(() => null);

    res.json({ success: true });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Variant not found." });
    console.error("[DELETE /admin/products/:id/variants/:variantId]", err);
    res.status(500).json({ error: "Failed to delete variant." });
  }
});

export default router;

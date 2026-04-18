import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { prisma } from "../lib/prisma.js";

const router = Router();
router.use(requireAdmin);

const MODEL_SELECT = {
  id: true,
  name: true,
  slug: true,
  bio: true,
  nationality: true,
  profileImage: true,
  images: true,
  videos: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  products: {
    select: {
      id: true,
      caption: true,
      linkImage: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
          type: true,
          variants: {
            select: {
              colorName: true,
              colorHex: true,
              images: true,
              isDefault: true,
            },
          },
        },
      },
    },
  },
};

// GET /api/admin/models
router.get("/", async (req, res) => {
  try {
    const models = await prisma.brandModel.findMany({
      select: MODEL_SELECT,
      orderBy: { createdAt: "desc" },
    });
    res.json({ models });
  } catch (err) {
    console.error("[GET /admin/models]", err);
    res.status(500).json({ error: "Failed to fetch models." });
  }
});

// GET /api/admin/models/:id
router.get("/:id", async (req, res) => {
  try {
    const model = await prisma.brandModel.findUnique({
      where: { id: req.params.id },
      select: MODEL_SELECT,
    });
    if (!model) return res.status(404).json({ error: "Model not found." });
    res.json({ model });
  } catch (err) {
    console.error("[GET /admin/models/:id]", err);
    res.status(500).json({ error: "Failed to fetch model." });
  }
});

// POST /api/admin/models
router.post("/", async (req, res) => {
  try {
    const {
      name,
      slug,
      bio,
      nationality,
      profileImage,
      images,
      videos,
      isActive,
    } = req.body;
    if (!name || !slug)
      return res.status(400).json({ error: "name and slug are required." });

    const model = await prisma.brandModel.create({
      data: {
        name,
        slug,
        bio: bio ?? null,
        nationality: nationality ?? null,
        profileImage: profileImage ?? null,
        images: images ?? [],
        videos: videos ?? [],
        isActive: isActive ?? true,
      },
      select: MODEL_SELECT,
    });
    res.status(201).json({ model });
  } catch (err) {
    if (err.code === "P2002")
      return res.status(409).json({ error: "Slug already in use." });
    console.error("[POST /admin/models]", err);
    res.status(500).json({ error: "Failed to create model." });
  }
});

// PUT /api/admin/models/:id
router.put("/:id", async (req, res) => {
  try {
    const {
      name,
      slug,
      bio,
      nationality,
      profileImage,
      images,
      videos,
      isActive,
    } = req.body;
    const model = await prisma.brandModel.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(bio !== undefined && { bio }),
        ...(nationality !== undefined && { nationality }),
        ...(profileImage !== undefined && { profileImage }),
        ...(images !== undefined && { images }),
        ...(videos !== undefined && { videos }),
        ...(isActive !== undefined && { isActive }),
      },
      select: MODEL_SELECT,
    });
    res.json({ model });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Model not found." });
    if (err.code === "P2002")
      return res.status(409).json({ error: "Slug already in use." });
    console.error("[PUT /admin/models/:id]", err);
    res.status(500).json({ error: "Failed to update model." });
  }
});

// DELETE /api/admin/models/:id
router.delete("/:id", async (req, res) => {
  try {
    await prisma.brandModel.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Model not found." });
    console.error("[DELETE /admin/models/:id]", err);
    res.status(500).json({ error: "Failed to delete model." });
  }
});

// POST /api/admin/models/:id/products — link a product
router.post("/:id/products", async (req, res) => {
  try {
    const { productId, caption, linkImage } = req.body;
    if (!productId)
      return res.status(400).json({ error: "productId is required." });
    const link = await prisma.modelProduct.create({
      data: {
        modelId: req.params.id,
        productId,
        caption: caption ?? null,
        linkImage: linkImage ?? null,
      },
    });
    res.status(201).json({ link });
  } catch (err) {
    if (err.code === "P2002")
      return res.status(409).json({ error: "Product already linked." });
    console.error("[POST /admin/models/:id/products]", err);
    res.status(500).json({ error: "Failed to link product." });
  }
});

// DELETE /api/admin/models/:id/products/:productId — unlink a product
router.delete("/:id/products/:productId", async (req, res) => {
  try {
    await prisma.modelProduct.deleteMany({
      where: { modelId: req.params.id, productId: req.params.productId },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /admin/models/:id/products/:productId]", err);
    res.status(500).json({ error: "Failed to unlink product." });
  }
});

export default router;

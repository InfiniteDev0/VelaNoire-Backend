import { v2 as cloudinary } from "cloudinary";

// ─────────────────────────────────────────────
// Cloudinary V2 — configured from environment variables
// ─────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // always use https
});

// ─────────────────────────────────────────────
// FOLDER MAPPING
// All assets live under vela-noire/<entity>
// ─────────────────────────────────────────────
export const UPLOAD_FOLDERS = {
  products: "vela-noire/products", // product hero / fallback images
  variants: "vela-noire/variants", // per-color variant images
  collections: "vela-noire/collections", // collection hero images
  videos: "vela-noire/videos", // collection hero videos
  measurements: "vela-noire/measurements", // customer measurement photos
  models: "vela-noire/models", // brand model portraits & editorial photos
  modelVideos: "vela-noire/model-videos", // brand model campaign videos
};

// ─────────────────────────────────────────────
// EAGER TRANSFORMATIONS
// Pre-generate common sizes on upload so they're
// cached at Cloudinary's CDN edge immediately.
// ─────────────────────────────────────────────
const IMAGE_EAGER = [
  // Full display — auto format (WebP/AVIF) + auto quality
  { width: 1600, crop: "limit", fetch_format: "auto", quality: "auto" },
  // Product card thumbnail
  {
    width: 600,
    height: 750,
    crop: "fill",
    gravity: "auto",
    fetch_format: "auto",
    quality: "auto",
  },
  // Mobile thumbnail
  {
    width: 400,
    height: 500,
    crop: "fill",
    gravity: "auto",
    fetch_format: "auto",
    quality: "auto",
  },
];

const VIDEO_EAGER = [
  // 1080p stream
  { width: 1920, height: 1080, crop: "limit", format: "mp4", quality: "auto" },
  // 720p fallback
  { width: 1280, height: 720, crop: "limit", format: "mp4", quality: "auto" },
];

// ─────────────────────────────────────────────
// generateSignature
// Returns everything the client needs to upload
// directly to Cloudinary without touching our server.
//
// The signature is valid for 10 minutes.
// ─────────────────────────────────────────────
export function generateSignature(folder, resourceType = "image") {
  const timestamp = Math.round(Date.now() / 1000);

  // Params that MUST be signed (every param sent with the upload must be signed)
  const baseParams = {
    folder,
    timestamp,
  };

  // Add eager transforms for images and videos
  if (resourceType === "image") {
    baseParams.eager = IMAGE_EAGER.map((t) => {
      const parts = [];
      if (t.width) parts.push(`w_${t.width}`);
      if (t.height) parts.push(`h_${t.height}`);
      if (t.crop) parts.push(`c_${t.crop}`);
      if (t.gravity) parts.push(`g_${t.gravity}`);
      if (t.fetch_format) parts.push(`f_${t.fetch_format}`);
      if (t.quality) parts.push(`q_${t.quality}`);
      return parts.join(",");
    }).join("|");
  }

  if (resourceType === "video") {
    baseParams.eager = VIDEO_EAGER.map((t) => {
      const parts = [];
      if (t.width) parts.push(`w_${t.width}`);
      if (t.height) parts.push(`h_${t.height}`);
      if (t.crop) parts.push(`c_${t.crop}`);
      if (t.format) parts.push(`f_${t.format}`);
      if (t.quality) parts.push(`q_${t.quality}`);
      return parts.join(",");
    }).join("|");
    // NOTE: resource_type must NOT be included in signed params —
    // Cloudinary puts it in the URL endpoint, not the form body.
    // Including it here causes a signature mismatch → 401.
  }

  const signature = cloudinary.utils.api_sign_request(
    baseParams,
    process.env.CLOUDINARY_API_SECRET,
  );

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
    ...(baseParams.eager ? { eager: baseParams.eager } : {}),
  };
}

// ─────────────────────────────────────────────
// deleteResource
// Permanently removes an asset from Cloudinary.
// Called when an admin removes/replaces an image.
// ─────────────────────────────────────────────
export async function deleteResource(publicId, resourceType = "image") {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

export { cloudinary };

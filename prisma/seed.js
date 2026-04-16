import "dotenv/config";
import { auth } from "../src/auth/auth.js";
import { prisma } from "../src/lib/prisma.js";

const ADMIN_EMAIL = "velanoire@info.com";
const ADMIN_PASSWORD = "velanoire@2026";

const CATEGORIES = [
  { name: "Abaya", slug: "abaya" },
  { name: "Perfume", slug: "perfume" },
  { name: "Bracelet", slug: "bracelet" },
  { name: "Handbag", slug: "handbag" },
  { name: "Shayla", slug: "shayla" },
  { name: "Shoes", slug: "shoes" },
  { name: "Accessory", slug: "accessory" },
];

const COLLECTIONS = [
  {
    name: "Rare Collectibles",
    slug: "rare-collectibles",
    tagline: "Drop once a year. Never restocked.",
    description:
      "Exclusive luxury sets — 1 Abaya, 1 Perfume, 1 Accessory. Limited to 30–50 sets per drop.",
  },
  {
    name: "Infinity Bride",
    slug: "infinity-bride",
    tagline: "For the queen on her most sacred day.",
    description:
      "White, cream, and pearl beige abayas with embroidered gold/silver thread for brides.",
  },
  {
    name: "Modern Muse",
    slug: "modern-muse",
    tagline: "Urban. Professional. Unmistakably elegant.",
    description:
      "Tailored cuts, muted colors, lightweight fabrics for the contemporary Muslimah.",
  },
  {
    name: "Lux Infinity",
    slug: "lux-infinity",
    tagline: "Velvet, silk, and jewel tones — for the bold.",
    description:
      "Premium abayas in royal blue, emerald, maroon with gold trim and crystals.",
  },
  {
    name: "Traditions Reimagined",
    slug: "traditions-reimagined",
    tagline: "Heritage, reborn with modern stitching.",
    description:
      "Classic Saudi/Emirati cuts with geometric Islamic embroidery.",
  },
  {
    name: "Simplicity Speaks",
    slug: "simplicity-speaks",
    tagline: "Clean lines. Zero noise. Total elegance.",
    description:
      "Straight-cut cotton-linen abayas in sand, ivory, charcoal, and soft sage.",
  },
  {
    name: "Seasonal",
    slug: "seasonal",
    tagline: "Summer · Winter · Autumn · Spring",
    description:
      "Four seasonal drops — Desert Bloom, Velvet Moon, Amber Luxe, Floral Grace.",
  },
];

async function seedAdmin() {
  console.log("🌱 Seeding admin user...");

  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existing) {
    // Already exists — just make sure role is admin
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: { role: "admin", emailVerified: true },
    });
    console.log("✅ Admin already exists — role confirmed as admin.");
    return;
  }

  // Create via better-auth so the password is hashed correctly
  await auth.api.signUpEmail({
    body: {
      name: "Vela Noire Admin",
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
    headers: new Headers(),
  });

  // Elevate role to admin + mark email verified
  await prisma.user.update({
    where: { email: ADMIN_EMAIL },
    data: { role: "admin", emailVerified: true },
  });

  console.log("✅ Admin user created: velanoire@info.com");
}

seedAdmin()
  .then(seedBaseData)
  .catch((err) => {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

async function seedBaseData() {
  console.log("\n🌱 Seeding categories & collections...");
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    console.log(`  ✅ Category: ${cat.name}`);
  }
  for (const col of COLLECTIONS) {
    await prisma.collection.upsert({
      where: { slug: col.slug },
      update: { tagline: col.tagline, description: col.description },
      create: col,
    });
    console.log(`  ✅ Collection: ${col.name}`);
  }
  console.log("\n✨ All done.");
}

import "dotenv/config";
import { auth } from "../src/auth/auth.js";
import { prisma } from "../src/lib/prisma.js";

const ADMIN_EMAIL = "velanoire@info.com";
const ADMIN_PASSWORD = "velanoire@2026";

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
  .catch((err) => {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

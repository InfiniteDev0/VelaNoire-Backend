import { auth } from "../auth/auth.js";
import { prisma } from "../lib/prisma.js";

/**
 * Middleware — protects routes that require an admin user.
 * Always verifies role from the DB (never trusts session cache alone).
 */
export async function requireAdmin(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.user) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    // Always fetch role from DB — never trust cached session value
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!dbUser || dbUser.role !== "admin") {
      return res.status(403).json({ error: "Forbidden. Admin access only." });
    }

    req.user = session.user;
    req.session = session.session;
    next();
  } catch (err) {
    console.error("[requireAdmin]", err.message);
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

import { auth } from "../auth/auth.js";

/**
 * Middleware — protects any route that requires a logged-in user.
 * Attaches req.user and req.session if valid.
 */
export async function requireAuth(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.user) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    req.user = session.user;
    req.session = session.session;
    next();
  } catch (err) {
    console.error("[requireAuth]", err.message);
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

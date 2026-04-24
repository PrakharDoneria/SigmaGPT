import { getAuth } from "firebase-admin/auth";

// ✅ Middleware — verifies Firebase ID token from frontend
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized — no token provided" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
// ✅ Add after verifyIdToken
const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS; // e.g. "gmail.com"

if (allowedDomains && allowedDomains !== "*") {
  const emailDomain = decodedToken.email?.split("@")[1];
  if (!allowedDomains.split(",").includes(emailDomain)) {
    return res.status(403).json({ error: "Access restricted" });
  }
}
    // ✅ Attach user info to request
    req.user = {
      uid:   decodedToken.uid,
      email: decodedToken.email,
      name:  decodedToken.name || decodedToken.email,
    };

    next();
  } catch (err) {
    console.error("❌ Auth error:", err.message);
    return res.status(401).json({ error: "Unauthorized — invalid token" });
  }
};
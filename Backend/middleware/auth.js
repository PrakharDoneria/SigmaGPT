/**
 * Auth Middleware
 * 
 * This middleware extracts the User ID from the request headers.
 * 1. Checks for 'x-user-id' (Simulated/Testing ID)
 * 2. Checks for 'Authorization' Bearer token (Real Firebase Auth)
 */
export const authMiddleware = async (req, res, next) => {
  try {
    // 1. Check for Testing ID (x-user-id)
    const testingId = req.headers["x-user-id"];
    
    if (testingId) {
      req.user = { uid: testingId };
      return next();
    }

    // 2. Check for Real Bearer Token (Future upgrade)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      // In a real app, you would use:
      // const decodedToken = await admin.auth().verifyIdToken(token);
      // req.user = decodedToken;
      
      // For now, if someone sends a Bearer token, we just log them in as "auth-user"
      // because we haven't set up the Firebase Admin Auth logic yet.
      req.user = { uid: "authenticated-user" }; 
      return next();
    }

    // 3. No identification found
    return res.status(401).json({ 
      error: "Unauthorized", 
      message: "Please include an x-user-id header or log in." 
    });

  } catch (error) {
    console.error("❌ Auth Middleware Error:", error.message);
    res.status(500).json({ error: "Authentication failed" });
  }
};

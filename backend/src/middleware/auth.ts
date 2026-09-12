import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/environment.js";
import User from "../models/User.js";

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    email: string;
    role: string;
    name: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const headerEmail = (req.headers["x-user-email"] as string) || "";
  const headerName = (req.headers["x-user-name"] as string) || "TrustRAG User";

  let userEmail: string | null = null;
  let userName: string = headerName;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];

    // 1. Try local JWT verification first
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        id: string;
        email: string;
        role: string;
        name?: string;
      };

      if (decoded && decoded.id) {
        req.user = {
          _id: decoded.id,
          email: decoded.email,
          role: decoded.role || "user",
          name: decoded.name || "TrustRAG User",
        };
        return next();
      }
    } catch {
      // 2. Local JWT failed — attempt to decode as Clerk token
      try {
        const decodedClerk = jwt.decode(token) as any;
        if (decodedClerk) {
          userEmail = decodedClerk.email || decodedClerk.sub;
          userName = decodedClerk.name || headerName;
        }
      } catch {
        // Not a valid JWT decode
      }
    }
  }

  // 3. If Clerk user email or header email is available, sync/provision in MongoDB
  const targetEmail = (userEmail || headerEmail).trim().toLowerCase();
  if (targetEmail) {
    try {
      let dbUser = await User.findOne({ email: targetEmail });
      if (!dbUser) {
        dbUser = await User.create({
          name: userName,
          email: targetEmail,
          password_hash: "clerk_oauth_user",
          role: "user",
        });
      }
      req.user = {
        _id: dbUser._id.toString(),
        email: dbUser.email,
        role: dbUser.role,
        name: dbUser.name,
      };
      return next();
    } catch (err) {
      console.error("User sync error in authenticate middleware:", err);
    }
  }

  // 4. In development mode, provide safe fallback to demo user
  if (env.NODE_ENV !== "production") {
    try {
      let demoUser = await User.findOne({ email: "demo@trustrag.ai" });
      if (!demoUser) {
        demoUser = await User.create({
          name: "Mudavath Kumar",
          email: "demo@trustrag.ai",
          password_hash: "demo_password",
          role: "user",
        });
      }
      req.user = {
        _id: demoUser._id.toString(),
        email: demoUser.email,
        role: demoUser.role,
        name: demoUser.name,
      };
      return next();
    } catch {
      // Ignore if DB is still connecting
    }
  }

  res.status(401).json({ error: "Authentication required. Please log in." });
};

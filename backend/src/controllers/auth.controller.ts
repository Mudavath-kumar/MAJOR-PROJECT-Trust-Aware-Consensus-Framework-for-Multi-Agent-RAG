import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Settings from "../models/Settings.js";
import { env } from "../config/environment.js";
import { AuthRequest } from "../middleware/auth.js";
import { isDbConnected } from "../config/database.js";

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters long" });
      return;
    }

    if (!isDbConnected()) {
      res.status(503).json({ error: "Authentication storage is unavailable" });
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ error: "User with this email already exists" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      password_hash,
      role: "user",
    });

    // Create default settings for user
    await Settings.create({ user_id: newUser._id });

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, role: newUser.role, name: newUser.name },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any },
    );

    res.status(201).json({
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to register user", message: err.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    if (!isDbConnected()) {
      res.status(503).json({ error: "Authentication storage is unavailable" });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any },
    );

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Login failed", message: err.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (!isDbConnected()) {
      res.json({ user: req.user });
      return;
    }

    const user = await User.findById(req.user._id).select("-password_hash");
    if (!user) {
      res.json({ user: req.user });
      return;
    }

    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch current user", message: err.message });
  }
};

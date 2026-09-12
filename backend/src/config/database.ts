import mongoose from "mongoose";
import { env } from "./environment.js";

let isConnected = false;

mongoose.connection.on("connected", () => {
  isConnected = true;
});

mongoose.connection.on("disconnected", () => {
  isConnected = false;
});

export const connectDB = async (): Promise<boolean> => {
  try {
    if (mongoose.connection.readyState === 1) {
      isConnected = true;
      return true;
    }
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    });
    isConnected = true;
    console.log(`✅ MongoDB Connected successfully: ${conn.connection.host}`);
    return true;
  } catch (error: any) {
    isConnected = false;
    console.warn(`⚠️ MongoDB connection warning: ${error.message}`);
    console.warn(
      "ℹ️ Running in resilient mode. Ensure MongoDB is active locally or configure MONGODB_URI in backend/.env with MongoDB Atlas (free tier).",
    );
    return false;
  }
};

export const maintainDBConnection = async (): Promise<void> => {
  let delayMs = 1000;
  while (!isConnected) {
    if (await connectDB()) return;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs * 2, 30000);
  }
};

export const isDbConnected = (): boolean => isConnected;

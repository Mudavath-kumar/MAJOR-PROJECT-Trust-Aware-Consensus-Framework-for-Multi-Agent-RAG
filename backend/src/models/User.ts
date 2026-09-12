import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import { UserRole } from "../types/index.js";

export interface IUserDocument extends Document {
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<IUserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password_hash);
};

export const User = mongoose.model<IUserDocument>("User", UserSchema);
export default User;

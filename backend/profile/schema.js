import { z } from "zod";

// Mongo ObjectId validator (24 hex chars)
const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

// Create Profile Schema
export const createUserProfileSchema = z.object({
  firebaseUID: z.string().min(1, "Firebase UID is required"),

  name: z.string().min(2, "Name must be at least 2 characters"),

  email: z.string().email("Invalid email address"),

  avatar: z.string().url("Avatar must be a valid URL").optional(),

  phone: z.string().min(8).optional(),

  address: z.string().min(5).optional(),

  recentlyBought: z.array(objectId).optional(),

  orders: z.array(objectId).optional(),

  wishlist: z.array(objectId).optional(),
});

// Update Profile Schema (everything optional except firebaseUID)
export const updateUserProfileSchema = z.object({
  name: z.string().min(2).optional(),

  avatar: z.string().url().optional(),

  phone: z.string().min(8).optional(),

  address: z.string().min(5).optional(),

  wishlist: z.array(objectId).optional(),
});

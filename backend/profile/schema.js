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

// Blank form values ("" / null) mean "not provided", not an invalid enum value.
const blankToUndefined = (schema) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema);

// An https URL, or a small inline image (the account page uploads a resized JPEG).
const avatarSchema = z
  .string()
  .max(400_000, "Image is too large")
  .refine(
    (v) => /^https:\/\//.test(v) || /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    "Invalid image"
  );

// Update Profile Schema. Every field the account page edits must be listed here —
// z.object strips unknown keys, so gender/date of birth/skin profile were silently
// dropped before they reached the controller and never saved.
export const updateUserProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  // The client's field names (Firebase-style) — mapped to name/avatar in updateProfile.
  displayName: z.string().trim().min(2, "Name must be at least 2 characters").max(80).optional(),

  avatar: avatarSchema.optional(),
  photoURL: avatarSchema.optional(),

  // "" clears the number.
  phone: z.union([
    z.literal(""),
    z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/, "Invalid phone number"),
  ]).optional(),

  gender: blankToUndefined(z.enum(["Male", "Female", "Non-binary", "Prefer not to say"]).optional()),
  dateOfBirth: blankToUndefined(
    z.coerce.date()
      .refine((d) => d <= new Date(), "Date of birth can't be in the future")
      .refine((d) => d.getFullYear() >= 1900, "Invalid date of birth")
      .optional()
  ),
  skinType: blankToUndefined(z.enum(["Oily", "Dry", "Combination", "Sensitive", "Normal"]).optional()),
  skinConcerns: z.array(z.enum(["Acne", "Dark Spots", "Aging", "Pigmentation", "Dullness", "Dryness"])).max(6).optional(),
  preferredRoutine: blankToUndefined(z.enum(["Morning Routine", "Night Routine", "Both"]).optional()),

  address: z.string().min(5).optional(),

  wishlist: z.array(objectId).optional(),
});

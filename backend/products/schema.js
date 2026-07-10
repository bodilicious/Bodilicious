import { z } from "zod";

/*
  PRODUCT CREATION
  - No rating
  - No reviews
  - No isActive
  - No extra fields allowed
*/
export const createProductSchema = z
  .object({
    pid: z.string().min(1, "Product ID is required"),
    name: z.string().min(1, "Name is required"),
    slug: z.string().optional(),
    brand: z.string().optional(),
    images: z
      .array(z.string().url("Each image must be a valid URL"))
      .min(1, "At least one image is required"),
    description: z.string().min(1, "Description is required"),

    category: z.enum(["skin", "hair", "body", "makeup", "lip", "other"]),
    sub_category: z.string().optional(),
    product_type: z.string().optional(),
    item_form: z.string().optional(),

    ingredients: z.object({
      key_actives: z.array(z.string()).optional(),
      botanical_extracts: z.array(z.string()).optional(),
      others: z.array(z.string()).optional(),
    }).optional(),

    benefits: z.array(z.string()).optional(),
    concerns_targeted: z.array(z.string()).optional(),

    usage: z.object({
      time: z.string().optional(),
      frequency: z.string().optional(),
      routine_step: z.string().optional(),
    }).optional(),

    price: z.number().min(0, "Price must be non-negative"),
    price_inr: z.number().min(0).optional(),
    stock: z.number().int("Stock must be an integer").min(0, "Stock cannot be negative"),

    product_weight_ml: z.number().optional(),
    product_weight_g: z.number().optional(),
    availability: z.string().optional(),

    skin_type_suitable: z.array(z.string()).optional(),
    skin_type_not_suitable: z.array(z.string()).optional(),
    hair_type_suitable: z.array(z.string()).optional(),

    how_to_use: z.array(z.string()).optional(),
    tips: z.array(z.string()).optional(),
    texture: z.string().optional(),
    warnings: z.array(z.string()).optional(),
    is_active_based: z.boolean().optional(),
    seo_keywords: z.object({
      primary: z.array(z.string()).optional(),
      secondary: z.array(z.string()).optional(),
      tertiary: z.array(z.string()).optional(),
    }).optional(),
  })
  .strict();

/*
  PRODUCT UPDATE
  - Partial updates
  - Still no forbidden fields
*/
export const updateProductSchema =
  createProductSchema.partial().strict();

/*
  REVIEW CREATION
  - user comes from req.user
  - client cannot fake identity
*/
export const createReviewSchema = z
  .object({
    rating: z
      .number()
      .min(1, "Rating must be at least 1")
      .max(5, "Rating cannot exceed 5"),

    comment: z.string().trim().optional(),
  })
  .strict();

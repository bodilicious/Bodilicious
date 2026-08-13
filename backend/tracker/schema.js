import { z } from "zod";

/* =========================================
   Mongo ObjectId Validation
========================================= */
const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid product ID");


/* =========================================
   Order Item Schema
========================================= */
const orderItemSchema = z.object({
  productId: objectId,
  // pid is the friendly product identifier (e.g. 'bodilicious-rose-cream').
  // It is used server-side as a fallback lookup when findById(productId) fails.
  // Must be declared here so Zod's parse() does NOT strip it before the controller sees it.
  pid: z.string().optional(),
  variant: z.string().optional().nullable(),
  quantity: z
    .number({
      required_error: "Quantity is required",
    })
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1"),
});


/* =========================================
   Shipping Details Schema
========================================= */
const shippingDetailsSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .min(2, "Name must be at least 2 characters"),

  phone: z
    .string({ required_error: "Phone number is required" })
    .regex(/^\+?[0-9\s\-()\u2010-\u2015]{7,20}$/, "Invalid phone number"),

  address: z
    .string({ required_error: "Address is required" })
    .min(5, "Address is too short"),

  city: z
    .string({ required_error: "City is required" })
    .min(2, "City is required"),

  state: z
    .string({ required_error: "State is required" })
    .min(2, "State is required"),

  pincode: z
    .string({ required_error: "Pincode is required" })
    .min(3, "Pincode is too short")
    .max(12, "Pincode is too long"),

  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email"),

  country: z.string().optional(),
});


/* =========================================
   Marketing Schema (optional UTM data)
========================================= */
const marketingSchema = z.object({
  source: z.string().optional().nullable(),
  medium: z.string().optional().nullable(),
  campaign: z.string().optional().nullable(),
}).optional();


/* =========================================
   Create Order Schema
========================================= */
export const createOrderSchema = z.object({
    items: z
      .array(orderItemSchema)
      .min(1, "At least one item is required"),

    paymentMethod: z
      .enum(["cod", "razorpay"])
      .optional()
      .default("cod"),

    shippingDetails: shippingDetailsSchema,
    
    billingDetails: shippingDetailsSchema.optional().nullable(),

    // UTM / marketing attribution — optional, never fail on missing
    marketing: marketingSchema,
    
    // quoteId for Razorpay integration
    quoteId: z.string().optional(),

    // Coupon code applied at checkout. Must be declared here — Zod's default
    // parse() strips unknown keys, so omitting this would silently drop the
    // field before createOrder ever saw it (same trap as Mongoose's strict
    // schema silently dropping unknown fields).
    couponCode: z.string().optional(),
  });


/* =========================================
   Verify Payment Schema
   Only validate the 3 Razorpay IDs — we look up items/shippingDetails
   from the draft order already stored in MongoDB (never trust the frontend
   for payment verification).
========================================= */
export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string({ required_error: "Razorpay order ID is required" }),
  razorpay_payment_id: z.string({ required_error: "Razorpay payment ID is required" }),
  razorpay_signature: z.string({ required_error: "Razorpay signature is required" }),
  // Optional passthrough fields (sent by frontend, ignored server-side but must not fail)
  items: z.array(z.any()).optional(),
  shippingDetails: z.any().optional(),
  marketing: marketingSchema,
});
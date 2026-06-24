import mongoose from "mongoose";
import { nanoid } from "nanoid";

const messageSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "UserProfile" },
    authorRole: { type: String, enum: ["admin", "customer", "system"], required: true },
    isAutomated: { type: Boolean, default: false },
    visibleToCustomer: { type: Boolean, default: true },
    attachments: [{ type: String }],
  },
  { timestamps: true }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      default: () => `TKT-${nanoid(6)}`,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["shipping", "payment", "other"],
      required: true,
    },
    orderId: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ["open", "resolved", "cancelled"],
      default: "open",
    },
    priority: {
      type: String,
      enum: ["normal", "high"],
      default: "normal",
    },
    description: {
      type: String,
      required: true,
    },
    messages: [messageSchema],
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: "general",
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Ticket = mongoose.model("Ticket", ticketSchema);
export const FAQ = mongoose.model("FAQ", faqSchema);

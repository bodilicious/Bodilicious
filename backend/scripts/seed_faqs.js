import mongoose from "mongoose";
import dotenv from "dotenv";
import { FAQ } from "../support/models.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const faqs = [
  {
    question: "How long does shipping take?",
    answer: "Standard shipping takes 5-7 business days. Express shipping takes 2-3 business days.",
    category: "shipping",
    order: 1
  },
  {
    question: "Do you ship internationally?",
    answer: "Currently, we only ship within India.",
    category: "shipping",
    order: 2
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, UPI, and Net Banking.",
    category: "payment",
    order: 3
  },
  {
    question: "Are your products cruelty-free?",
    answer: "Yes, all our products are 100% cruelty-free and vegan.",
    category: "product",
    order: 4
  },
  {
    question: "How can I track my order?",
    answer: "You will receive a tracking link via email and WhatsApp once your order is shipped.",
    category: "shipping",
    order: 5
  }
];

const seedFaqs = async () => {
  try {
    if (!MONGO_URI) {
      console.error("MONGO_URI not found in environment variables");
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");

    const existingCount = await FAQ.countDocuments();
    if (existingCount > 0) {
      console.log("FAQs already seeded. Skipping.");
      process.exit(0);
    }

    await FAQ.insertMany(faqs);
    console.log("Successfully seeded FAQs.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding FAQs:", error);
    process.exit(1);
  }
};

seedFaqs();

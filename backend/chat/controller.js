import Fuse from "fuse.js";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import { getProducts } from "./products.js";
import { matchIntent } from "./intents.js";
import RitualResponse from "../admin/ritualModels.js";

/* ===================================================
   RATE LIMITING
 =================================================== */
export const burstLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  legacyHeaders: false
});

export const chatLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Daily chat limit reached. Please try again tomorrow."
  }
});

/* ===================================================
   GEMINI SETUP
 =================================================== */
let ai = null;

if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });
  } catch (err) {
    console.error("Failed to initialize Gemini:", err);
  }
}

const GEMINI_FALLBACK_REPLY =
  "I’m currently handling many requests. Please try again in a few minutes or browse products directly.";

/* ===================================================
   PRODUCT DATA & FUZZY SEARCH (CACHED)
 =================================================== */
let productsCache = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getLiveProducts() {
  const now = Date.now();
  if (productsCache.length > 0 && (now - lastCacheUpdate) < CACHE_TTL) {
    return productsCache;
  }
  const freshProducts = await getProducts();
  productsCache = freshProducts;
  lastCacheUpdate = now;
  return freshProducts;
}

function getFuseInstance(items) {
  return new Fuse(items, {
    keys: [
      "name",
      "product_type",
      "description",
      "benefits",
      "concerns_targeted",
      "skin_type_suitable",
      "ingredients.key_actives",
      "ingredients.botanical_extracts"
    ],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 3
  });
}

/* ===================================================
   FAQ ANSWERS
 =================================================== */
const FAQ_ANSWERS = {
  shipping:
    "We offer free shipping on most orders. Delivery usually takes 3–5 business days.",
  delivery:
    "Delivery usually takes 3–5 business days depending on your location.",
  return:
    "We accept returns within 7 days of delivery for unused products in original packaging.",
  refund:
    "Refunds are processed within 5–7 business days after receiving the returned item.",
  cod:
    "Cash on Delivery (COD) is available for orders under ₹2000 in most pin codes.",
  cancellation:
    "Orders can be cancelled before dispatch from our warehouse.",
  contact:
    "You can reach support at bodiliciousnaturalproducts@gmail.com or via WhatsApp at +91 9894451947",
  support:
    "You can reach support at bodiliciousnaturalproducts@gmail.com or via WhatsApp at +91 9894451947"
};

/* ===================================================
   SYSTEM PROMPT (STRICT)
 =================================================== */
const SYSTEM_PROMPT = `
You are the Bodilicious Beauty Advisor, a sophisticated consultant for a luxury and organic skincare brand. 

TONE: Elegant, helpful, knowledgeable, and brand-safe.
KNOWLEDGE: Your ONLY legal source of product information is the provided PRODUCT_DATA.
PERSONALIZATION: Use the USER PROFILE INFO if provided to tailor your advice.

STRICT RULES:
1. Recommend 1-3 relevant products.
2. Focus on/botanical benefits. Use the terms from PRODUCT_DATA.
3. If asked about layering, refer to the "Thinnest to Thickest" rule.
4. If a user has a specific skin type in their profile, prioritize products suitable for that type.
5. Never provide medical diagnoses.
6. Mention prices in INR.
7. Be concise yet warm.
`;

/* ===================================================
   HELPERS
 =================================================== */
function extractContext(messages) {
  const context = {
    domain: null,
    skinType: null,
    concern: null,
    productType: null
  };

  for (const msg of messages) {
    if (!msg) continue;
    const lower = msg.toLowerCase();

    if (!context.domain) {
      if (lower.match(/\b(skin|acne|oily|dry|pigment|face|dark spot|spots)\b/)) context.domain = "skin";
      else if (lower.match(/\b(hair|dandruff|scalp|shampoo)\b/)) context.domain = "hair";
      else if (lower.match(/\b(body|soap|bath|wash)\b/)) context.domain = "body";
    }

    if (!context.skinType) {
      if (lower.match(/\b(oily)\b/)) context.skinType = "oily";
      else if (lower.match(/\b(dry)\b/)) context.skinType = "dry";
      else if (lower.match(/\b(combination)\b/)) context.skinType = "combination";
      else if (lower.match(/\b(normal)\b/)) context.skinType = "normal";
      else if (lower.match(/\b(sensitive)\b/)) context.skinType = "sensitive";
      else if (lower.match(/\b(acne[\s-]prone)\b/)) context.skinType = "acne_prone";
    }

    if (!context.concern) {
      if (lower.match(/\b(acne|pimples|breakouts)\b/)) context.concern = "acne";
      else if (lower.match(/\b(pigmentation|dark spots|marks)\b/)) context.concern = "pigmentation";
      else if (lower.match(/\b(dull|dullness|glow)\b/)) context.concern = "dullness";
      else if (lower.match(/\b(aging|wrinkles|fine lines)\b/)) context.concern = "aging";
      else if (lower.match(/\b(barrier|redness|irritated)\b/)) context.concern = "barrier_damage";
      else if (lower.match(/\b(dandruff|flakes|flaky)\b/)) context.concern = "dandruff";
      else if (lower.match(/\b(hair fall|hair loss|weak roots)\b/)) context.concern = "hair_fall";
      else if (lower.match(/\b(frizz|dry hair)\b/)) context.concern = "frizz";
    }

    if (!context.productType) {
      if (lower.match(/\b(serum)\b/)) context.productType = "serum";
      else if (lower.match(/\b(moisturizer|cream|lotion)\b/)) context.productType = "moisturizer";
      else if (lower.match(/\b(sunscreen|spf)\b/)) context.productType = "sunscreen";
      else if (lower.match(/\b(face wash|cleanser|soap)\b/)) context.productType = "cleanser";
      else if (lower.match(/\b(shampoo)\b/)) context.productType = "shampoo";
      else if (lower.match(/\b(conditioner)\b/)) context.productType = "conditioner";
      else if (lower.match(/\b(oil)\b/)) context.productType = "oil";
      else if (lower.match(/\b(lip balm)\b/)) context.productType = "lip_balm";
      else if (lower.match(/\b(foundation)\b/)) context.productType = "foundation";
      else if (lower.match(/\b(lipstick)\b/)) context.productType = "lipstick";
      else if (lower.match(/\b(eye cream)\b/)) context.productType = "eye_care";
    }
  }
  return context;
}

function matchFAQ(message) {
  for (const [key, answer] of Object.entries(FAQ_ANSWERS)) {
    const regex = new RegExp(`\\b${key}\\b`, "i");
    if (regex.test(message)) return answer;
  }
  return null;
}

function cleanQuery(text) {
  return text
    .toLowerCase()
    .replace(/(please|help me|can you)/g, "")
    .trim();
}

function formatProductReply(items) {
  let reply = "Here are some products that may match your needs:\n\n";

  items.forEach(p => {
    let suitableText = "";

    if (p.category === "hair") {
      suitableText =
        p.hair_type_suitable?.length
          ? `Suitable for: ${p.hair_type_suitable.join(", ")}`
          : "Suitable for: All hair types";
    } else {
      suitableText =
        p.skin_type_suitable?.length
          ? `Suitable for: ${p.skin_type_suitable.join(", ")}`
          : "";
    }

    reply += `• ${p.name} – ₹${p.price_inr}
${p.description}
${suitableText}\n\n`;
  });

  return reply.trim();
}

/* ===================================================
   MAIN CHAT HANDLER
 =================================================== */
export const handleChat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        success: false,
        message: "Message is required."
      });
    }

    // Load live products
    const liveProducts = await getLiveProducts();
    const fuse = getFuseInstance(liveProducts);

    const lower = message.toLowerCase();

    /* ---------- STEP 1: FAQ ---------- */
    const faqReply = matchFAQ(lower);
    if (faqReply) {
      return res.json({
        success: true,
        isFaq: true,
        reply: faqReply
      });
    }

    /* ---------- STEP 1.5: RULE-BASED INTENTS ---------- */
    const intentReply = matchIntent(lower, liveProducts);
    if (intentReply) {
      return res.json(intentReply);
    }

    /* ---------- STEP 2: CONTEXT-BASED MATCH ---------- */
    // Parse context from newest to oldest message
    const orderedMessages = [message, ...[...history].reverse()];
    const context = extractContext(orderedMessages);

    let intentProducts = [];

    // Apply filters based on context IF we found actionable context beyond just domain
    if (context.skinType || context.concern || context.productType) {
      intentProducts = liveProducts;

      if (context.domain) {
        intentProducts = intentProducts.filter(p => !p.category || p.category === context.domain || p.category === "mixed");
      }

      if (context.skinType) {
        intentProducts = intentProducts.filter(p =>
          !p.skin_type_not_suitable?.includes(context.skinType) &&
          (!p.skin_type_suitable || p.skin_type_suitable.length === 0 || p.skin_type_suitable.includes(context.skinType) || p.skin_type_suitable.includes("all"))
        );
      }

      if (context.concern) {
        intentProducts = intentProducts.filter(p =>
          p.concerns_targeted && p.concerns_targeted.some(c => c.includes(context.concern) || context.concern.includes(c))
        );
      }

      if (context.productType) {
        intentProducts = intentProducts.filter(p =>
          p.sub_category === context.productType ||
          (p.product_type && p.product_type.toLowerCase().includes(context.productType.replace("_", " ")))
        );
      }

      if (intentProducts.length > 0) {
        // ONLY return immediately if the query is extremely simple and has NO specifics
        const specificKeywords = ["rose", "extract", "with", "ingredient", "containing", "active", "vitamin", "acid", "serum", "oil"];
        const hasSpecifics = specificKeywords.some(kw => lower.includes(kw));

        if (!hasSpecifics) {
          return res.json({
            success: true,
            isProduct: true,
            domain: context.domain || "mixed",
            reply: "Based on what you've told me, here are some products that match your needs:",
            products: intentProducts.slice(0, 3)
          });
        }
      }
    }

    /* ---------- STEP 3: FUZZY SEARCH WITH CONTEXT ---------- */
    const cleaned = cleanQuery(lower);
    const contextWords = [];
    if (context.skinType) contextWords.push(context.skinType.replace("_", " "));
    if (context.concern) contextWords.push(context.concern.replace("_", " "));
    if (context.productType) contextWords.push(context.productType.replace("_", " "));

    const searchQuery = contextWords.length > 0 ? contextWords.join(" ") : (cleaned || message);
    const fuseResults = fuse.search(searchQuery);

    const specificKeywords = ["rose", "extract", "with", "ingredient", "containing", "active", "vitamin", "acid", "serum", "oil"];
    const hasSpecifics = specificKeywords.some(kw => lower.includes(kw));

    if (fuseResults.length > 0 && !hasSpecifics) {
      return res.json({
        success: true,
        isProduct: true,
        reply: "Here are some products that may match what you're looking for:",
        products: fuseResults.map(r => r.item).slice(0, 3)
      });
    }

    /* ---------- STEP 4: AI FALLBACK (GEMINI) ---------- */
    if (ai) {
      try {
        const { profileContext, structuredHistory = [] } = req.body;
        
        // Prepare context for the AI - USE FUZZY SEARCH to find candidates
        const candidates = fuse.search(message).map(r => r.item).slice(0, 12);
        const productContext = candidates.length > 0 
          ? candidates.map(p => `- ${p.name} (ID: ${p.pid}): ₹${p.price_inr}. Suitable: ${p.skin_type_suitable?.join(",") || "All"}. Description: ${(p.description || "").substring(0, 100)}...`).join("\n")
          : liveProducts.slice(0, 8).map(p => `- ${p.name} (ID: ${p.pid}): ₹${p.price_inr}. Suitable: ${p.skin_type_suitable?.join(",") || "All"}.`).join("\n");

        let userContextStr = "";
        if (profileContext) {
          userContextStr = `PROFILE: ${profileContext.skinType || "N/A"} skin, concerns: ${profileContext.skinConcerns?.join(",") || "none"}.\n`;
        }

        // Formulate contents for Gemini - includes history + current prompt
        const contents = [
          ...structuredHistory.slice(-4).map(h => ({
            role: h.role === "user" ? "user" : "model",
            parts: [{ text: h.text }]
          })),
          {
            role: "user",
            parts: [{ text: `${SYSTEM_PROMPT}\n\n${userContextStr}PRODUCT_DATA:\n${productContext}\n\nUSER_QUERY: ${message}` }]
          }
        ];

        const response = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: contents,
          config: {
            maxOutputTokens: 500,
            temperature: 0.7,
          }
        });

        const responseText = response.candidates[0].content.parts[0].text;

        // Extract product IDs if mentioned (look for ID: BD-...)
        const mentionedIds = [];
        const idMatches = responseText.match(/BD-[A-Z0-9-]+/g);
        if (idMatches) {
          mentionedIds.push(...new Set(idMatches));
        }

        const recommendedProducts = liveProducts.filter(p => mentionedIds.includes(p.pid));

        return res.json({
          success: true,
          isAi: true,
          reply: responseText,
          products: recommendedProducts.length > 0 ? recommendedProducts : candidates.slice(0, 2)
        });
      } catch (aiErr) {
        console.error("Gemini Generation Error:", aiErr);
      }
    }

    /* ---------- FINAL FALLBACK ---------- */
    return res.json({
      success: true,
      reply: "I'm having trouble finding a specific product for that. Could you tell me more about your skin type or concern (e.g., 'I have dry skin' or 'I want a serum')?"
    });

  } catch (err) {
    console.error("Chat Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  }
};

/* ===================================================
   RITUAL FINDER LOGGING
 =================================================== */
export const logRitualEvent = async (req, res) => {
  try {
    const { sessionId, status, focusArea, skinType, concerns, goal, routineTime, orderId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required" });
    }

    const updateData = {
      status,
      focusArea,
      skinType,
      concerns,
      goal,
      routineTime,
      user: req.user?._id || null,
    };

    if (orderId) updateData.order = orderId;

    // Upsert the ritual response for the session
    const ritual = await RitualResponse.findOneAndUpdate(
      { sessionId },
      { $set: updateData },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: ritual });
  } catch (err) {
    console.error("LogRitualEvent Error:", err);
    res.status(500).json({ success: false, message: "Error logging ritual event" });
  }
};
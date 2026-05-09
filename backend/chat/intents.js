import { brandRules } from "./rules/brand.js";
import { safetyRules } from "./rules/safety.js";
import { routineRules } from "./rules/routines.js";
import { ingredientRules } from "./rules/ingredients.js";
import { usageRules } from "./rules/usage.js";
import { concernRules } from "./rules/concerns.js";

// --- TRAIT EXTRACTOR ---
/**
 * Extracts multiple skin types and concerns from a single message
 * to handle complex queries like "oily but sensitive skin"
 */
const extractTraits = (text) => {
    const traits = {
        skinTypes: [],
        concerns: []
    };

    const typeMap = {
        oily: /\b(oily|greasy|sebum)\b/i,
        dry: /\b(dry|flaky|rough|dehydrated)\b/i,
        combination: /\b(combination|combo|t-zone)\b/i,
        sensitive: /\b(sensitive|irritates? easily|redness prone)\b/i,
        acne_prone: /\b(acne[\s-]prone|pimple[\s-]prone|breakout[\s-]prone)\b/i,
        normal: /\b(normal|balanced)\b/i
    };

    const concernMap = {
        acne: /\b(acne|pimples|blackheads|whiteheads|clogs)\b/i,
        aging: /\b(aging|wrinkles|fine lines?|fine_lines|fine_lines_and_wrinkles|loss_of_firmness)\b/i,
        pigmentation: /\b(pigmentation|dark spots?|dark_spots|marks|uneven|uneven_tone)\b/i,
        dullness: /\b(dull|glow|brighten|dullness)\b/i,
        barrier_damage: /\b(barrier|redness|stinging|burns|weakened_skin_barrier)\b/i
    };

    for (const [type, regex] of Object.entries(typeMap)) {
        if (regex.test(text)) traits.skinTypes.push(type);
    }

    for (const [concern, regex] of Object.entries(concernMap)) {
        if (regex.test(text)) traits.concerns.push(concern);
    }

    return traits;
};

export const matchIntent = (message, products) => {
    const text = message.toLowerCase().trim();

    // -- HELPERS passed to modules --
    const helpers = {
        recommend: (productsList, messageText) => ({
            success: true,
            isRuleBased: true,
            reply: messageText,
            products: productsList.slice(0, 3)
        }),
        pureText: (replyText) => ({
            success: true,
            isRuleBased: true,
            reply: replyText
        })
    };

    // --- PIPELINE (Priority Order) ---

    // 1. BRAND RULES
    const brandMatch = brandRules(text, products, helpers);
    if (brandMatch) return brandMatch;

    // 2. SAFETY RULES
    const safetyMatch = safetyRules(text, products, helpers);
    if (safetyMatch) return safetyMatch;

    // 3. ROUTINE BUILDERS
    const routineMatch = routineRules(text, products, helpers);
    if (routineMatch) return routineMatch;

    // 4. CONCERN DETECTION
    const concernMatch = concernRules(text, products, helpers);
    if (concernMatch) return concernMatch;

    // 5. USAGE GUIDANCE (Layering/Frequency - Specific)
    const usageMatch = usageRules(text, products, helpers);
    if (usageMatch) return usageMatch;

    // 6. INGREDIENT EDUCATION (General)
    const ingredientMatch = ingredientRules(text, products, helpers);
    if (ingredientMatch) return ingredientMatch;

    // 7. COMPLEX TRAIT MATCHING (Skin & Hair Types)
    const traits = extractTraits(text);
    if (traits.skinTypes.length > 0 || traits.concerns.length > 0) {
        let filtered = products;

        if (traits.skinTypes.length > 0) {
            // Must be suitable for ALL mentioned types (or 'all' types)
            filtered = filtered.filter(p => 
                traits.skinTypes.every(t => (p.skin_type_suitable || []).includes(t) || (p.skin_type_suitable || []).includes("all")) &&
                !traits.skinTypes.some(t => (p.skin_type_not_suitable || []).includes(t))
            );
        }

        if (traits.concerns.length > 0) {
            filtered = filtered.filter(p => 
                traits.concerns.some(c => (p.concerns_targeted || []).some(tc => tc.includes(c) || c.includes(tc)))
            );
        }

        if (filtered.length > 0) {
            const typesStr = traits.skinTypes.join(" and ").replace("_", "-");
            const concernsStr = traits.concerns.join(", ");
            const intro = `Based on your ${typesStr} skin${traits.concerns.length ? ` and concerns with ${concernsStr}` : ''}, these ${filtered.length > 1 ? 'options are' : 'is'} perfectly tailored to you:`;
            return helpers.recommend(filtered, intro);
        }
    }

    return null; // Let AI take over for truly unique queries
};
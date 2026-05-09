export const safetyRules = (text, products, helpers) => {
    const { pureText, recommend } = helpers;

    // 1. Pregnancy Safety - HIGH PRIORITY
    if (text.match(/\b(pregnant|pregnancy|baby safe|breastfeeding)\b/i)) {
        const safeProducts = products.filter(p => p.safety_labels?.includes("pregnancy_safe"));
        return recommend(safeProducts, "Congratulations! When it comes to pregnancy, we take a conservative, safety-first approach. Most of our hydrating and botanical products are gentle, but we strictly advise CONSULTING YOUR DOCTOR before using actives like High-Strength Salicylic Acid, Retinoids, or certain essential oils. Here are some of our gentlest, most popular pregnancy-safe options:");
    }

    // 2. Barrier Damage / Stinging
    if (text.match(/\b(burns|stings|irritated|redness|damaged barrier|red face)\b/i)) {
        const soothing = products.filter(p => (p.concerns_targeted || []).includes("barrier_damage") || p.name.match(/(Rose|Hyaluronic|Ceramide)/i));
        return recommend(soothing, "It sounds like your skin barrier might be compromised. STOP using all active exfoliants (AHAs, BHAs) and retinols immediately. Focus on 'Skin Fasting' with just a gentle cleanser, a ceramide-rich moisturizer, and sunscreen. These soothing essentials can help:");
    }

    // 3. Patch Testing
    if (text.match(/\bpatch test\b/i)) {
        return pureText("To perform a patch test: Apply a small amount of product to a clean area of skin on the inside of the elbow or behind the ear. Keep the area dry. If you experience any burning, intense stinging, or irritation during the next 24 hours, do not use the product on your face.");
    }

    // 4. Over-exfoliation
    if (text.match(/\b(too much exfoliation|peeling skin|over exfoliated)\b/i)) {
        return pureText("If your skin is peeling or shiny/waxy, you might be over-exfoliating. Scale back to once a week or stop entirely for 2 weeks to let your skin recover. Hydration is your best friend right now!");
    }

    return null;
};

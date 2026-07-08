export const routineRules = (text, products, helpers) => {
    const { recommend, pureText } = helpers;

    // 1. Teenage Routine
    if (text.match(/\b(teen|teenage|young skin|puberty|13|14|15|16|17|student|boy|girl)\b/i)) {
        const basics = products.filter(p => ["cleanser", "moisturizer", "sunscreen"].includes(p.sub_category) || p.suitable_for?.includes("teen"));
        return recommend(basics, "Starting young is great! For teenage skin, the focus is on DEEP CLEANSING and protection. Keep it simple: Gentle Cleanser -> Lightweight Moisturizer -> Sunscreen. Here is the perfect starter kit for young skin:");
    }

    // 2. Men's Routine
    if (text.match(/\b(men|man|guys|shaving|beard)\b/i)) {
        const mensSelection = products.filter(p => p.suitable_for?.includes("men") || p.name?.match(/(Charcoal|Tea Tree|Mint|)/i) || ["cleanser", "sunscreen"].includes(p.sub_category));
        return recommend(mensSelection, "Men's skin often needs no-fuss, effective hydration and oil control. We recommend: Deep Cleanser -> Soothing Hydrator -> Non-Greasy Sunscreen. Check out these men-friendly picks:");
    }

    // 3. Pregnancy Routine (Safe Selections)
    if (text.match(/\b(pregnancy|pregnant|maternity)\b/i) && text.match(/\b(routine|ritual|what to use)\b/i)) {
        const safeSelection = products.filter(p => p.safety_labels?.includes("pregnancy_safe"));
        return recommend(safeSelection, "For our mamas-to-be, we prioritize safety and nourishment. This routine is mineral-based and gentle: Gentle Cleanser -> Vitamin C -> Ceramide Moisturizer -> Mineral Sunscreen. Here are our top maternity-safe picks:");
    }

    // 4. Hair Care Ritual
    if (text.match(/\b(hair|scalp|dandruff|frizz|hair fall)\b/i) && text.match(/\b(routine|ritual|steps|how to|remedy)\b/i)) {
        const hairProducts = products.filter(p => p.category === "hair" || p.sub_category === "hair_oil");
        return recommend(hairProducts, "For healthy, lustrous hair, we recommend a 3-step ritual: Scalp Treatment/Oil (Pre-wash) -> Gentle Shampoo (Wash) -> Hair Serum (Post-wash). Here is your hair care guide:");
    }

    // 5. Body Care Ritual
    if (text.match(/\b(body|skin texture|stretch marks|body wash|soap)\b/i) && text.match(/\b(routine|ritual|steps)\b/i)) {
        const bodyProducts = products.filter(p => p.category === "body" || p.category === "skin" && p.sub_category === "face_body_wash");
        return recommend(bodyProducts, "A complete body ritual keeps your skin soft and supple. We suggest using a nourishing Body Wash followed by a hydrating Body Lotion or Oil. Explore our body collection:");
    }

    // 6. Night Repair Ritual
    if (text.match(/\b(night|pm)\b/i) && text.match(/\b(ritual|routine|steps)\b/i)) {
        const pmProducts = products.filter(p => p.usage?.time?.includes("PM") || p.usage?.time?.includes("AM & PM"));
        return recommend(pmProducts, "Nighttime is for recovery. Your PM ritual should be: Double Cleanse -> Treatment Serum -> Rich Moisturizer -> Eye Cream. These products work best while you sleep:");
    }

    // 7. Morning Glow Ritual
    if (text.match(/\b(morning|am)\b/i) && text.match(/\b(ritual|routine|steps)\b/i)) {
        const amProducts = products.filter(p => p.usage?.time?.includes("AM") || p.usage?.time?.includes("AM & PM"));
        return recommend(amProducts, "Wake up your skin! Your AM ritual should be: Refreshing Cleanser -> Vitamin C Serum -> Lightweight Moisturizer -> Sunscreen. Here are our daytime essentials:");
    }

    return null;
};


export const concernRules = (text, products, helpers) => {
    const { recommend } = helpers;

    const rules = [
        {
            patterns: [/\b(acne|pimples|breakouts|blackheads|whiteheads|clogged pores)\b/i],
            handler: () => {
                const treats = products.filter(p => (p.concerns_targeted || []).some(c => ["acne", "blackheads", "clogged_pores", "oil_control"].includes(c)));
                return recommend(treats, "For acne and clogged pores, the focus is on deep cleaning and gentle exfoliation to prevent future clogs. Look for Salicylic Acid (BHA) or Tea Tree. These targeted treatments are excellent:");
            }
        },
        {
            patterns: [/\b(dark circles|puffy eyes|puffiness|eye fine lines)\b/i],
            handler: () => {
                const eyeCare = products.filter(p => p.sub_category === "eye_care" || (p.concerns_targeted || []).some(c => ["dark_circles", "puffiness", "fine_lines"].includes(c)));
                return recommend(eyeCare, "The delicate skin around the eyes needs special care. For dark circles and puffiness, look for caffeine or hydrating peptides. Here are our top eye care solutions:");
            }
        },
        {
            patterns: [/\b(pigmentation|dark spots|melasma|uneven skin tone)\b/i],
            handler: () => {
                const treats = products.filter(p => (p.concerns_targeted || []).some(c => ["pigmentation", "dark_spots", "uneven_tone", "dullness"].includes(c)));
                return recommend(treats, "To fade pigmentation and even out your skin tone, Vitamin C, Niacinamide, and regular exfoliation are key. Don't forget sunscreen, as sun exposure makes spots darker! Try these:");
            }
        },
        {
            patterns: [/\b(aging|fine lines|wrinkles|loose skin|firming)\b/i],
            handler: () => {
                const treats = products.filter(p => (p.concerns_targeted || []).some(c => ["aging", "fine_lines", "fine_lines_and_wrinkles", "loss_of_firmness"].includes(c)));
                return recommend(treats, "For targeting fine lines and maintaining skin elasticity, Retinol and Peptides are the gold standards. Consistency is key for anti-aging results! Here are our best firming rituals:");
            }
        },
        {
            patterns: [/\b(dandruff|itchy scalp|flakes)\b/i],
            handler: () => {
                const treats = products.filter(p => (p.concerns_targeted || []).includes("dandruff") || p.name?.match(/\b(Tea Tree|Mint)\b/i));
                return recommend(treats, "Dandruff and itchy scalp often need balancing and clarifying ingredients like Tea Tree or Neem. Here's a targeted selection to help refresh your scalp:");
            }
        },
        {
            patterns: [/\b(hair fall|hair loss|thinning hair|weak roots)\b/i],
            handler: () => {
                const treats = products.filter(p => (p.concerns_targeted || []).includes("hair_fall") || (p.concerns_targeted || []).includes("weak_roots"));
                return recommend(treats, "To combat hair fall, you need to nourish the roots and strengthen the hair shaft. Ayurvedic favorites like Bhringraj and Amla are legendary for this. Here is our growth-boosting ritual:");
            }
        },
        {
            patterns: [/\b(frizz|dry hair|damaged hair)\b/i],
            handler: () => {
                const treats = products.filter(p => (p.concerns_targeted || []).includes("frizz") || p.name?.match(/\b(Milk Protein|Keratin|Argan)\b/i));
                return recommend(treats, "Frizz and damage usually signify a lack of moisture and protein in the hair cuticle. Our protein-rich conditioners and serums can help seal the cuticle and restore shine:");
            }
        }
    ];

    for (const rule of rules) {
        for (const pattern of rule.patterns) {
            if (pattern.test(text)) return rule.handler();
        }
    }
    return null;
};

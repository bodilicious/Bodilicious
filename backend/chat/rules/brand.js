export const brandRules = (text, products, helpers) => {
    const { pureText } = helpers;

    const rules = [
        {
            patterns: [/\bwhere (is|are) (you|bodilicious) from\b/i, /\borigin\b/i, /\bwhere (are |do )?products made\b/i],
            handler: () => pureText("Bodilicious is proudly rooted in India. We source our high-quality herbal and organic ingredients from sustainable farms across the country and manufacture in state-of-the-art facilities that respect traditional Ayurvedic wisdom.")
        },
        {
            patterns: [/\bis it organic\b/i, /\bare (the )?products organic\b/i, /\borganic status\b/i],
            handler: () => pureText("Yes! Bodilicious is committed to organic beauty. Most of our key ingredients are organically sourced, and we strive to keep our formulations as close to nature as possible, free from harmful synthetic pesticides.")
        },
        {
            patterns: [/\bcruelty.?(free)?\b/i, /\btest on animals\b/i],
            handler: () => pureText("Absolutely not. Bodilicious is 100% cruelty-free. We never test our products or ingredients on animals, and we ensure our suppliers adhere to the same ethical standards.")
        },
        {
            patterns: [/\bparaben.?(free)?\b/i, /\bharsh chemicals\b/i, /\bsulfate.?(free)?\b/i],
            handler: () => pureText("Our philosophy is 'Clean Beauty'. All Bodilicious products are formulated without parabens, sulfates (SLS/SLES), phthalates, or artificial fragrances that can irritate the skin.")
        },
        {
            patterns: [/\bis it natural\b/i, /\b100% natural\b/i],
            handler: () => pureText("We prioritize natural, plant-based ingredients in every bottle. While we use safe, science-backed preservatives to ensure product stability and your safety, our heart is 100% in herbal and botanical goodness.")
        }
    ];

    for (const rule of rules) {
        for (const pattern of rule.patterns) {
            if (pattern.test(text)) return rule.handler();
        }
    }
    return null;
};

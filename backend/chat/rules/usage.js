export const usageRules = (text, products, helpers) => {
    const { pureText } = helpers;

    const rules = [
        {
            patterns: [/\bhow (do i )?double cleanse\b/i, /\bdouble cleans(ing|e)\b/i],
            handler: () => pureText("Double cleansing is the secret to clear skin! Step 1: Use an oil-based cleanser or cleansing balm on dry skin to dissolve makeup and sunscreen. Step 2: Follow up with a water-based face wash (like our Rose Face Wash) to remove sweat and remaining impurities. Do this EVERY night!")
        },
        {
            patterns: [/\bhow (much|many) (product|serum|cream) (should i use|to apply)\b/i, /\bquantity\b/i],
            handler: () => pureText("A little goes a long way! For Serums: 2-3 drops is plenty. For Moisturizer/Sunscreen: A 'two-finger' length for the face and neck. For Cleanser: A coin-sized amount.")
        },
        {
            patterns: [/\border of (application|products)\b/i, /\bwhat (comes |apply )first\b/i, /\blayering (guide|rules)\b/i],
            handler: () => pureText("The golden rule is 'Thinnest to Thickest':\n1. Cleanser (on damp skin)\n2. Toner/Liquid Serum\n3. Thicker Serum/Treatment\n4. Eye Cream\n5. Moisturizer\n6. Sunscreen (Always last in AM!)")
        },
        {
            patterns: [/\bhow often (should i )?exfoliate\b/i, /\bexfoliation frequency\b/i],
            handler: () => pureText("Consistency is key, but don't overdo it! For sensitive skin: 1 time a week. For oily/normal skin: 2-3 times a week at night. Always follow up with plenty of hydration and SPF the next morning.")
        },
        {
            patterns: [/\breapply sunscreen\b/i, /\bhow often spf\b/i],
            handler: () => pureText("To stay fully protected, you should reapply sunscreen every 2-3 hours if you are outdoors. If you're indoors all day, one generous application in the morning is usually enough unless you're sitting directly by a sunny window.")
        },
        {
            patterns: [/\b(mix|combine|use|layer) vitamin c (and|with) niacinamide\b/i],
            handler: () => pureText("Yes, you absolutely can! Modern formulations make them very stable together. They are a powerhouse combo for brightening and refining skin texture. Apply Vitamin C first, then Niacinamide.")
        },
        {
            patterns: [/\b(mix|combine|use|layer) retinol (and|with) (aha|bha|exfoliant)\b/i],
            handler: () => pureText("CAUTION: We generally advise AGAINST using Retinol and strong exfoliating acids (AHAs/BHAs) in the same session, as it can lead to severe irritation. Use your acids on one night and Retinol on another!")
        }
    ];

    for (const rule of rules) {
        for (const pattern of rule.patterns) {
            if (pattern.test(text)) return rule.handler();
        }
    }
    return null;
};

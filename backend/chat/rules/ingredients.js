const INGREDIENT_SYNONYMS = {
    "vitamin e": ["vitamin e", "tocopherol", "tocopheryl acetate"],
    "tea tree": ["tea tree", "tea tree oil", "melaleuca"],
    "aloe vera": ["aloe vera", "aloe", "aloe gel"],
    "ceramides": ["ceramide", "ceramides", "ceramide np", "ceramide ap", "ceramide eop"],
    "peptides": ["peptide", "peptides", "palmitoyl peptide", "collagen complex"],
    "charcoal": ["charcoal", "activated charcoal"],
    "turmeric": ["turmeric", "curcumin", "haldi"],
    "kojic acid": ["kojic acid", "kojic"],
    "salicylic acid": ["salicylic acid", "bha", "willow bark"],
    "niacinamide": ["niacinamide", "vitamin b3"],
    "vitamin c": ["vitamin c", "ascorbic acid", "sodium ascorbyl phosphate"],
    "hyaluronic acid": ["hyaluronic acid", "sodium hyaluronate"],
    "rose": ["rose", "rosehip", "rose water", "rose extract"],
    "ashwagandha": ["ashwagandha", "winter cherry"],
    "bhringraj": ["bhringraj", "false daisy"],
    "milk protein": ["milk protein", "goat milk", "whey protein"]
};

const findByIngredient = (keyword, products) => {
    // Check synonyms
    let searchTerms = [keyword.toLowerCase()];
    for (const [canonical, synonyms] of Object.entries(INGREDIENT_SYNONYMS)) {
        if (synonyms.some(s => keyword.toLowerCase().includes(s)) || keyword.toLowerCase().includes(canonical)) {
            searchTerms = [...new Set([...searchTerms, canonical, ...synonyms])];
            break;
        }
    }

    return products.filter(p =>
        searchTerms.some(term => 
            (p.name?.toLowerCase().includes(term)) ||
            (p.description?.toLowerCase().includes(term)) ||
            (p.ingredients?.key_actives?.some(i => i.toLowerCase().includes(term))) ||
            (p.ingredients?.botanical_extracts?.some(i => i.toLowerCase().includes(term)))
        )
    );
};

export const ingredientRules = (text, products, helpers) => {
    const { recommend, pureText } = helpers;

    // Check for specific ingredient queries
    for (const [canonical, synonyms] of Object.entries(INGREDIENT_SYNONYMS)) {
        const pattern = new RegExp(`\\b(${[canonical, ...synonyms].join('|')})\\b`, 'i');
        if (pattern.test(text)) {
            const matchedProducts = findByIngredient(canonical, products);
            
            // Knowledge snippets
            const snippets = {
                "vitamin e": "Vitamin E is a powerful antioxidant that protects the skin from free radicals and UV damage while deeply hydrating and healing the skin barrier.",
                "tea tree": "Tea Tree Oil is nature's antiseptic. It's famous for fighting acne-causing bacteria and calming redness without over-drying.",
                "aloe vera": "Aloe Vera is the ultimate hydrator and soothener. It's perfect for calming sun-damaged or irritated skin and provides lightweight moisture.",
                "ceramides": "Ceramides are the 'glue' that holds your skin cells together. They are essential for repairing the skin barrier and locking in moisture.",
                "peptides": "Peptides are strings of amino acids that act as building blocks for proteins like collagen and elastin. They help firm the skin and reduce fine lines.",
                "charcoal": "Activated Charcoal acts like a magnet for dirt and oil. It's excellent for deep cleansing pores and detoxifying oily skin.",
                "turmeric": "Turmeric (Haldi) is an ancient Ayurvedic powerhouse with anti-inflammatory and brightening properties. It gives the skin a natural, healthy glow.",
                "niacinamide": "Niacinamide (Vitamin B3) is a multi-tasker that minimizes pores, regulates oil, and fades dark marks while soothing inflammation.",
                "vitamin c": "Vitamin C is the gold standard for brightening. It boosts collagen, fades pigmentation, and protects against environmental stressors.",
                "hyaluronic acid": "Hyaluronic Acid is a moisture magnet that can hold 1000x its weight in water, making it perfect for plumping and hydrating all skin types.",
                "rose": "Rose extracts are renowned for their soothing and anti-inflammatory benefits, helping to reduce redness and restore skin pH balance.",
                "ashwagandha": "Ashwagandha is an adaptogen that helps the skin cope with stress, promoting a youthful and revitalized appearance.",
                "bhringraj": "Bhringraj is the 'King of Herbs' for hair growth. it stimulates follicles and helps prevent premature graying.",
                "milk protein": "Milk Proteins are rich in amino acids that nourish and strengthen both hair and skin, making them soft and resilient."
            };

            const info = snippets[canonical] || `Exquisite choice! ${canonical} is one of our favorite ingredients for its skin-loving properties.`;
            
            if (matchedProducts.length > 0) {
                return recommend(matchedProducts, `${info} Here are some of our products containing it:`);
            } else {
                return pureText(`${info} While we don't have a specific product centered on it right now, we're always crafting new rituals!`);
            }
        }
    }

    return null;
};

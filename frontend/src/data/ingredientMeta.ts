import { normalizeIngredient } from '../utils/normalizeIngredient';

export interface IngredientMeta {
  name: string;
  normalizedKey: string;
  description: string;
  imagePath: string;
  altText: string;
}

const rawIngredients: Omit<IngredientMeta, 'normalizedKey'>[] = [
  { name: 'Niacinamide 5%', description: 'Reduces pigmentation, controls oil and strengthens the skin barrier.', imagePath: '/ingredients/niacinamide-5-.webp', altText: 'Niacinamide 5% close up' },
  { name: 'Titanium Dioxide', description: 'Mineral UV filter that reflects broad-spectrum solar radiation.', imagePath: '/ingredients/titanium-dioxide.webp', altText: 'Titanium Dioxide powder' },
  { name: 'Zinc Oxide', description: 'Gentle physical sunscreen with anti-inflammatory properties.', imagePath: '/ingredients/zinc-oxide.webp', altText: 'Zinc Oxide powder' },
  { name: 'Retinol', description: 'Boosts cell turnover to improve texture and reduce fine lines.', imagePath: '/ingredients/retinol.webp', altText: 'Retinol serum texture' },
  { name: 'Rice Water', description: 'Brightens complexion and adds a luminous, even-toned glow.', imagePath: '/ingredients/rice-water.webp', altText: 'Milky Rice Water' },
  { name: 'Panthenol', description: 'Provitamin B5 that soothes, heals and helps retain moisture.', imagePath: '/ingredients/panthenol.webp', altText: 'Panthenol texture' },
  { name: 'Ethyl Ascorbic Acid', description: 'A stable vitamin C derivative for targeted brightening and radiance.', imagePath: '/ingredients/ethyl-ascorbic-acid.webp', altText: 'Ethyl Ascorbic Acid powder/serum' },
  { name: 'Alpha Arbutin', description: 'Gently suppresses melanin to fade dark spots and uneven tone.', imagePath: '/ingredients/alpha-arbutin.webp', altText: 'Alpha Arbutin' },
  { name: 'Hyaluronic Acid', description: 'Attracts and retains moisture for plump, hydrated skin.', imagePath: '/ingredients/hyaluronic-acid.webp', altText: 'Hyaluronic Acid liquid gel' },
  { name: 'Aloe Vera', description: 'Calms irritation, hydrates and accelerates the skin healing process.', imagePath: '/ingredients/aloe-vera.webp', altText: 'Fresh Aloe Vera leaf' },
  { name: 'Salicylic Acid', description: 'Penetrates pores to dissolve excess oil and clear breakouts.', imagePath: '/ingredients/salicylic-acid.webp', altText: 'Salicylic Acid structure' },
  { name: 'Neem', description: 'Antibacterial extract that targets acne-causing bacteria and impurities.', imagePath: '/ingredients/neem.webp', altText: 'Fresh green Neem leaves' },
  { name: 'Green Tea', description: 'Antioxidant-rich extract that calms redness and protects skin.', imagePath: '/ingredients/green-tea.webp', altText: 'Green Tea leaves and extract' },
  { name: 'Peptides', description: 'Firms and plumps the skin by stimulating collagen production.', imagePath: '/ingredients/peptides.webp', altText: 'Peptide complex drop' },
  { name: 'Ceramides', description: 'Restores the protective barrier and seals in deep moisture.', imagePath: '/ingredients/ceramides.webp', altText: 'Ceramides liquid texture' },
  { name: 'Collagen Complex', description: 'Supports skin structure for improved elasticity and firmness.', imagePath: '/ingredients/collagen-complex.webp', altText: 'Collagen Complex cross-section' },
  { name: 'Rose Extract', description: 'Soothes the skin, improves radiance and delivers gentle nourishment.', imagePath: '/ingredients/rose-extract.webp', altText: 'Fresh Rose petals' },
  { name: 'Cucumber', description: 'Cooling extract that reduces puffiness and refreshes tired skin.', imagePath: '/ingredients/cucumber.webp', altText: 'Cucumber slices' },
  { name: 'Saffron', description: 'Brightens and evens skin tone for a warm, radiant complexion.', imagePath: '/ingredients/saffron.webp', altText: 'Saffron threads' },
  { name: 'Goat Milk', description: 'Rich in lactic acid and vitamins to gently nourish and protect.', imagePath: '/ingredients/goat-milk.webp', altText: 'Creamy Goat Milk' },
  { name: 'Shea Butter', description: 'Rich emollient that melts into skin for lasting, velvety softness.', imagePath: '/ingredients/shea-butter.webp', altText: 'Raw Shea Butter' },
  { name: 'Kokum Butter', description: 'Non-greasy butter that nourishes and protects the delicate lip area.', imagePath: '/ingredients/kokum-butter.webp', altText: 'Kokum Butter chunks' },
  { name: 'Argireline', description: 'Relaxes expression lines for a visibly smoother eye area.', imagePath: '/ingredients/argireline.webp', altText: 'Argireline serum' },
  { name: 'Ashwagandha', description: 'Adaptogen that soothes the scalp and supports healthy hair cycles.', imagePath: '/ingredients/ashwagandha.webp', altText: 'Ashwagandha root' },
  { name: 'Milk Protein', description: 'Strengthens the hair shaft to reduce breakage and brittleness.', imagePath: '/ingredients/milk-protein.webp', altText: 'Milk Protein extract' },
  { name: 'Wheat Protein', description: 'Fortifies hair structure for resilient, healthier-looking strands.', imagePath: '/ingredients/wheat-protein.webp', altText: 'Wheat grains and extract' },
  { name: 'Rice Extract', description: 'Brightens complexion and adds a luminous, even-toned glow.', imagePath: '/ingredients/rice-extract.webp', altText: 'Rice Extract liquid' },
  { name: 'Bhringraj', description: 'Strengthens hair roots and promotes healthy hair growth.', imagePath: '/ingredients/bhringraj.webp', altText: 'Bhringraj leaves' },
  { name: 'Amla', description: 'Rich in vitamin C to nourish the scalp and prevent hair fall.', imagePath: '/ingredients/amla.webp', altText: 'Fresh Amla berries' },
  { name: 'Hibiscus', description: 'Conditions hair and boosts shine for silkier strands.', imagePath: '/ingredients/hibiscus.webp', altText: 'Red Hibiscus flower' },
  { name: 'Shikakai', description: 'Gently cleanses while maintaining the hair natural moisture balance.', imagePath: '/ingredients/shikakai.webp', altText: 'Shikakai pods' },
  { name: 'Glycolic Acid', description: 'Exfoliates dead cells to reveal brighter, smoother skin.', imagePath: '/ingredients/glycolic-acid.webp', altText: 'Glycolic Acid serum drops' },
  { name: 'Centella Asiatica', description: 'Speeds up barrier recovery and reduces skin sensitivity.', imagePath: '/ingredients/centella-asiatica.webp', altText: 'Centella Asiatica green leaves' },
  { name: 'Azelaic Acid', description: 'Normalises skin tone, controls sebum and reduces blemishes.', imagePath: '/ingredients/azelaic-acid.webp', altText: 'Azelaic Acid cream' },
  { name: 'Glycerin', description: 'Draws moisture into the skin for long-lasting hydration.', imagePath: '/ingredients/glycerin.webp', altText: 'Clear Glycerin liquid' },
  { name: 'Squalane', description: 'Lightweight, skin-identical oil that balances and locks in moisture.', imagePath: '/ingredients/squalane.webp', altText: 'Squalane oil drop' },
  { name: 'Olive Oil', description: 'A skin-identical lipid that softens, protects and restores moisture.', imagePath: '/ingredients/olive-oil.webp', altText: 'Pure Olive Oil' },
  { name: 'Carrot Extract', description: 'Packed with beta-carotene to brighten and reduce lip pigmentation.', imagePath: '/ingredients/carrot-extract.webp', altText: 'Carrot Extract drop' },
  { name: 'Lavender Oil', description: 'Calming botanical oil that deeply nourishes and repairs overnight.', imagePath: '/ingredients/lavender-oil.webp', altText: 'Lavender Oil and flowers' },
  { name: 'Kaolin Clay', description: 'Absorbs excess oil and impurities without over-drying the skin.', imagePath: '/ingredients/kaolin-clay.webp', altText: 'White Kaolin Clay powder' },
  { name: 'Keratin Protein', description: 'Rebuilds hair structure for smooth, strong, and shiny strands.', imagePath: '/ingredients/keratin-protein.webp', altText: 'Keratin Protein liquid' },
  { name: 'Beetroot Extract', description: 'Imparts a natural rosy tint while conditioning and protecting lips.', imagePath: '/ingredients/beetroot-extract.webp', altText: 'Beetroot Extract' },
  { name: 'Avobenzone', description: 'Broad-spectrum UV filter that protects skin against UVA rays.', imagePath: '/ingredients/avobenzone_png_1773160783282.webp', altText: 'Avobenzone' },
  { name: 'Integrin', description: 'Supports cell-to-cell communication for structural skin support.', imagePath: '/ingredients/integrin_png_1773160810372.webp', altText: 'Integrin' },
  { name: 'Fibronectin', description: 'Aids in tissue repair, binding collagen to cells to firm skin.', imagePath: '/ingredients/fibronectin_png_1773160847299.webp', altText: 'Fibronectin' },
  { name: 'Argan Oil', description: 'Luxurious oil packed with vitamin E to deeply nourish skin and hair.', imagePath: '/ingredients/argan_oil_png_1773160881776.webp', altText: 'Argan Oil' },
  { name: 'Methi Extracts', description: 'Rich in proteins to strengthen hair roots and reduce thinning.', imagePath: '/ingredients/methi_extracts_png_1773160926857.webp', altText: 'Methi Extracts' },
  { name: 'Peruvian Ginseng', description: 'Energizes cells to revitalize a tired, dull complexion.', imagePath: '/ingredients/peruvian_ginseng_png_1773160963824.webp', altText: 'Peruvian Ginseng' },
  { name: 'Cyclopentasiloxane', description: 'A lightweight conditioning fluid that adds an instantly silky finish.', imagePath: '/ingredients/cyclopentasiloxane_png_1773160984051.webp', altText: 'Cyclopentasiloxane' },
  { name: 'Decyl Glucoside', description: 'An ultra-mild, plant-derived cleanser that foams richly without stripping.', imagePath: '/ingredients/decyl_glucoside_png_1773161054753.webp', altText: 'Decyl Glucoside' },
  { name: 'Coco Glucoside', description: 'A gentle, biodegradable surfactant perfect for sensitive skin wash.', imagePath: '/ingredients/coco_glucoside_png_1773161027464.webp', altText: 'Coco Glucoside' },
  { name: 'Glycerine', description: 'Powerful humectant that intensely hydrates and softens the skin.', imagePath: '/ingredients/glycerin.webp', altText: 'Glycerine' },
  { name: 'Beta Carotene', description: 'A powerful antioxidant that brightens skin and protects against environmental damage.', imagePath: '/ingredients/beta-carotene.webp', altText: 'Beta Carotene extract' },
  { name: 'Cocoa Butter', description: 'A rich natural fat that heals chapped lips and deeply moisturizes skin.', imagePath: '/ingredients/cocoa-butter.webp', altText: 'Raw Cocoa Butter' },
  { name: 'Ashwaganda', description: 'Adaptogen that soothes the scalp and supports healthy hair cycles.', imagePath: '/ingredients/ashwagandha.webp', altText: 'Ashwagandha root' },
  { name: 'Jojoba Oil', description: 'A biomimetic liquid wax that balances sebum and deeply nourishes skin without clogging pores.', imagePath: '/ingredients/jojoba-oil.webp', altText: 'Jojoba Oil' },
  { name: 'Glutathione', description: 'A potent antioxidant that combats oxidative stress and dramatically illuminates the complexion.', imagePath: '/ingredients/glutathione.webp', altText: 'Glutathione' },
  { name: 'Kakadu Plum Extract', description: 'One of the world\'s richest sources of Vitamin C for intense brightening and collagen support.', imagePath: '/ingredients/kakadu-plum-extract.webp', altText: 'Kakadu Plum' },
  { name: 'Tea Tree Oil', description: 'Renowned for its natural antibacterial properties to effectively purify pores and combat blemishes.', imagePath: '/ingredients/tea-tree-oil.webp', altText: 'Tea Tree Oil' },
  { name: 'Vitamin E', description: 'A powerful restorative antioxidant that strengthens the skin barrier and seals in essential moisture.', imagePath: '/ingredients/vitamin-e.webp', altText: 'Vitamin E capsule' },
  { name: 'Moringa', description: 'A nutrient-dense botanical powerhouse that detoxifies and revitalizes dull, tired skin.', imagePath: '/ingredients/moringa.webp', altText: 'Moringa leaves' },
  { name: 'Brahmi', description: 'An Ayurvedic herb that strengthens hair follicles and provides exceptional antioxidant protection.', imagePath: '/ingredients/brahmi.webp', altText: 'Brahmi leaves' },
  { name: 'Brahmi Extract', description: 'Concentrated Ayurvedic extract to deeply nourish the scalp and encourage stronger, denser hair growth.', imagePath: '/ingredients/brahmi.webp', altText: 'Brahmi Extract' },
  { name: 'Ginseng', description: 'An energizing botanical adaptogen that stimulates circulation and revitalizes cellular function.', imagePath: '/ingredients/ginseng.webp', altText: 'Ginseng root' },
  { name: 'Apple Cider Vinegar', description: 'Naturally balances pH, clarifies buildup, and imparts a brilliant, healthy shine to hair and skin.', imagePath: '/ingredients/apple-cider-vinegar.webp', altText: 'Apple Cider Vinegar' },
  { name: 'Onion Seed Oil', description: 'Rich in sulfur to effectively minimize hair thinning and visibly boost hair density and strength.', imagePath: '/ingredients/onion-seed-oil.webp', altText: 'Onion Seed Oil' },
  { name: 'Castor Oil', description: 'A deeply penetrating oil rich in ricinoleic acid that fiercely promotes thicker hair and locked-in moisture.', imagePath: '/ingredients/castor-oil.webp', altText: 'Castor Oil' },
  { name: 'Rosehip Oil', description: 'Packed with essential fatty acids and natural retinoids to dramatically improve texture and hyperpigmentation.', imagePath: '/ingredients/rosehip-oil.webp', altText: 'Rosehip Oil' },
  { name: 'Papaya Extract', description: 'Contains natural papain enzymes that gently exfoliate away dull skin cells to reveal a soft, radiant glow.', imagePath: '/ingredients/papaya-extract.webp', altText: 'Papaya Extract' },
  { name: 'Mulberry Extract', description: 'A natural skin-brightening alternative to hydroquinone that visibly reduces the appearance of uneven tone.', imagePath: '/ingredients/mulberry-extract.webp', altText: 'Mulberry Extract' },
  { name: 'Coconut Oil', description: 'An intensely rich, traditional emollient that melts deeply into the skin and hair shaft for long-lasting hydration.', imagePath: '/ingredients/coconut-oil.webp', altText: 'Coconut Oil' },
  { name: 'Sweet Almond Oil', description: 'A luxurious, vitamin-rich oil that softly soothes irritation while dramatically improving elasticity.', imagePath: '/ingredients/sweet-almond-oil.webp', altText: 'Sweet Almond Oil' },
  { name: 'Peppermint Oil', description: 'A refreshing, cooling botanical that stimulates microcirculation and soothes the scalp.', imagePath: '/ingredients/peppermint-oil.webp', altText: 'Peppermint Oil' },
];

export const INGREDIENT_META: Record<string, IngredientMeta> = {};

rawIngredients.forEach((ing) => {
  const normKey = normalizeIngredient(ing.name);
  INGREDIENT_META[normKey] = {
    ...ing,
    normalizedKey: normKey
  };
});

export const getIngredientData = (name: string): IngredientMeta => {
  const normKey = normalizeIngredient(name);
  if (INGREDIENT_META[normKey]) {
    return INGREDIENT_META[normKey];
  }

  for (const [key, value] of Object.entries(INGREDIENT_META)) {
    if (normKey.includes(key) || key.includes(normKey)) {
      return value;
    }
  }

  return {
    name,
    normalizedKey: normKey,
    description: 'A key active that works synergistically for visible, effective results.',
    imagePath: '/ingredients/fallback.webp',
    altText: `${name} ingredient`
  };
};

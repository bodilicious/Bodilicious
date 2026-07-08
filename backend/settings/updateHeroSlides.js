import mongoose from "mongoose";
import dotenv from "dotenv";
import HomepageContent from "./homepageModel.js";

dotenv.config({ path: "../.env" });

const heroSlides = [
  {
    imageUrl: '/assets/hero_carousel_1.webp',
    mobileImage: '/assets/hero_mobile_1.webp',
    eyebrow: 'Dermatologically Tested • Science-Backed • Skin-Safe',
    title: 'Skincare That',
    highlight: 'Goes Beyond the Surface',
    subtitle: 'Real beauty starts with healthy skin. We combine powerful actives with nature-derived extracts to target the root causes of your concerns—delivering visible results that are gentle, safe, and deeply nourishing.',
    ctaText: 'Shop Skin Care',
    ctaLink: '/shop?category=skin,makeup,lip',
    ctaSecondaryText: 'Shop Collection',
    ctaSecondaryLink: '/shop',
    overlayDesktop: 'from-dark-red/90 via-dark-red/60',
    order: 0,
  },
  {
    imageUrl: '/assets/hero_carousel_2.webp',
    mobileImage: '/assets/hero_mobile_2.webp',
    eyebrow: 'Bhringraj • Hibiscus • Keratin • Ashwagandha',
    title: 'Hair Care Rooted',
    highlight: "in Nature's Wisdom",
    subtitle: 'Fight hair fall, dandruff, and premature greying with our science-backed formulations. Real results, zero compromise.',
    ctaText: 'Explore Hair Care',
    ctaLink: '/shop?category=hair',
    ctaSecondaryText: 'Shop Collection',
    ctaSecondaryLink: '/shop',
    overlayDesktop: 'from-[#3d1a0a]/90 via-[#3d1a0a]/55',
    order: 1,
  },
  {
    imageUrl: '/assets/hero_carousel_3.webp',
    mobileImage: '/assets/hero_mobile_3.webp',
    eyebrow: 'Rose • Turmeric • Sandalwood • Coconut',
    title: 'Body Rituals',
    highlight: "You'll Love Every Day",
    subtitle: "Transform your daily routine with luxurious body oils, scrubs, and lotions infused with nature's most nourishing botanicals. Healthy, glowing skin from head to toe.",
    ctaText: 'Shop Body Care',
    ctaLink: '/shop?category=body',
    ctaSecondaryText: 'Shop Collection',
    ctaSecondaryLink: '/shop',
    overlayDesktop: 'from-[#5c2a00]/90 via-[#5c2a00]/50',
    order: 2,
  },
  {
    imageUrl: '/assets/hero_carousel_4.webp',
    mobileImage: '/assets/hero_mobile_4.webp',
    eyebrow: 'Niacinamide • Retinol • Hyaluronic Acid • Salicylic Acid',
    title: 'Complete Routines',
    highlight: 'Built for Real Skin',
    subtitle: 'From targeted serums to protective sunscreens, every product is designed to work together so you can build a routine that truly delivers—gentle, effective, and proudly.',
    ctaText: 'Find Your Ritual',
    ctaLink: '/ritual-finder',
    ctaSecondaryText: 'Shop All',
    ctaSecondaryLink: '/shop',
    overlayDesktop: 'from-[#1a3320]/90 via-[#1a3320]/50',
    order: 3,
  },
  {
    imageUrl: '/assets/hero_carousel_5.webp',
    mobileImage: '/assets/hero_mobile_5.webp',
    eyebrow: 'Vegan • Cruelty-Free • Earth-Friendly',
    title: 'Conscious Beauty',
    highlight: 'For a Better Tomorrow',
    subtitle: 'Discover skincare that loves your skin and the planet. Sustainably sourced ingredients packaged with care, because true beauty shouldn\'t cost the earth.',
    ctaText: 'Shop Sustainable',
    ctaLink: '/shop',
    ctaSecondaryText: 'Learn More',
    ctaSecondaryLink: '/brand-story',
    overlayDesktop: 'from-[#2d4a2e]/90 via-[#2d4a2e]/50',
    order: 4,
  },
  {
    imageUrl: '/assets/hero_carousel_6.webp',
    mobileImage: '/assets/hero_mobile_6.webp',
    eyebrow: 'Vitamin C • Peptides • Bakuchiol • Squalane',
    title: 'Glow With',
    highlight: 'Unstoppable Radiance',
    subtitle: 'Unlock your skin\'s natural luminosity with our potent brightening complexes. Designed to fade dark spots, even tone, and give you that coveted lit-from-within glow.',
    ctaText: 'Shop Best Sellers',
    ctaLink: '/shop?category=skin',
    ctaSecondaryText: 'Shop Collection',
    ctaSecondaryLink: '/shop',
    overlayDesktop: 'from-[#4a362d]/90 via-[#4a362d]/50',
    order: 5,
  }
];

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
    console.log("MongoDB connected");

    let content = await HomepageContent.findOne();
    if (!content) {
      console.log("No homepage content found in DB.");
      process.exit(1);
    }

    if (content.draft) content.draft.heroSlides = heroSlides;
    if (content.published) content.published.heroSlides = heroSlides;

    await content.save();
    console.log("Hero slides restored successfully!");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

run();

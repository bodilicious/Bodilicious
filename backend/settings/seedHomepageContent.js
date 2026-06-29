import mongoose from "mongoose";
import dotenv from "dotenv";
import HomepageContent from "./homepageModel.js";

dotenv.config({ path: "../.env" });

const seedData = {
  heroSlides: [
    {
      imageUrl: '/assets/hero_carousel_1.webp',
      imageAlt: 'Dermatologically tested skincare',
      eyebrow: 'Dermatologically Tested • Science-Backed • Skin-Safe',
      title: 'Skincare That',
      highlight: 'Goes Beyond the Surface',
      subtitle: 'Real beauty starts with healthy skin. We combine powerful actives with nature-derived extracts to target the root causes of your concerns—delivering visible results that are gentle, safe, and deeply nourishing.',
      ctaText: 'Shop Skin Care',
      ctaLink: '/shop?category=skin,makeup,lip',
      ctaSecondaryText: 'Shop Collection',
      ctaSecondaryLink: '/shop',
      overlayDesktop: 'from-dark-red/90 via-dark-red/60',
      order: 1
    },
    {
      imageUrl: '/assets/hero_carousel_2.webp',
      imageAlt: 'Hair care that transforms',
      eyebrow: 'Bhringraj • Hibiscus • Keratin • Ashwagandha',
      title: 'Hair Care Rooted',
      highlight: "in Nature's Wisdom",
      subtitle: 'Fight hair fall, dandruff, and premature greying with our science-backed herbal formulations. Real results, zero compromise.',
      ctaText: 'Explore Hair Care',
      ctaLink: '/shop?category=hair',
      ctaSecondaryText: 'Shop Collection',
      ctaSecondaryLink: '/shop',
      overlayDesktop: 'from-[#3d1a0a]/90 via-[#3d1a0a]/55',
      order: 2
    },
    {
      imageUrl: '/assets/hero_carousel_3.webp',
      imageAlt: 'Body care reimagined',
      eyebrow: 'Rose • Turmeric • Sandalwood • Coconut',
      title: 'Body Rituals',
      highlight: "You'll Love Every Day",
      subtitle: "Transform your daily routine with luxurious body oils, scrubs, and lotions infused with nature's most nourishing botanicals. Healthy, glowing skin from head to toe.",
      ctaText: 'Shop Body Care',
      ctaLink: '/shop?category=body',
      ctaSecondaryText: 'Shop Collection',
      ctaSecondaryLink: '/shop',
      overlayDesktop: 'from-[#5c2a00]/90 via-[#5c2a00]/50',
      order: 3
    },
    {
      imageUrl: '/assets/hero_carousel_4.webp',
      imageAlt: 'Complete Routines Built for Real Skin',
      eyebrow: 'Niacinamide • Retinol • Hyaluronic Acid • Salicylic Acid',
      title: 'Complete Routines',
      highlight: 'Built for Real Skin',
      subtitle: 'From targeted serums to protective sunscreens, every product is designed to work together so you can build a routine that truly delivers—gentle, effective, and proudly herbal.',
      ctaText: 'Find Your Ritual',
      ctaLink: '/ritual-finder',
      ctaSecondaryText: 'Shop All',
      ctaSecondaryLink: '/shop',
      overlayDesktop: 'from-[#1a3320]/90 via-[#1a3320]/50',
      order: 4
    },
    {
      imageUrl: '/assets/hero_carousel_5.webp',
      imageAlt: 'Conscious Beauty',
      eyebrow: 'Vegan • Cruelty-Free • Earth-Friendly',
      title: 'Conscious Beauty',
      highlight: 'For a Better Tomorrow',
      subtitle: 'Discover skincare that loves your skin and the planet. Sustainably sourced ingredients packaged with care, because true beauty shouldn\'t cost the earth.',
      ctaText: 'Shop Sustainable',
      ctaLink: '/shop',
      ctaSecondaryText: 'Learn More',
      ctaSecondaryLink: '/brand-story',
      overlayDesktop: 'from-[#2d4a2e]/90 via-[#2d4a2e]/50',
      order: 5
    },
    {
      imageUrl: '/assets/hero_carousel_6.webp',
      imageAlt: 'Glow With Unstoppable Radiance',
      eyebrow: 'Vitamin C • Peptides • Bakuchiol • Squalane',
      title: 'Glow With',
      highlight: 'Unstoppable Radiance',
      subtitle: 'Unlock your skin\'s natural luminosity with our potent brightening complexes. Designed to fade dark spots, even tone, and give you that coveted lit-from-within glow.',
      ctaText: 'Shop Best Sellers',
      ctaLink: '/shop?category=skin',
      ctaSecondaryText: 'Shop Collection',
      ctaSecondaryLink: '/shop',
      overlayDesktop: 'from-[#4a362d]/90 via-[#4a362d]/50',
      order: 6
    }
  ],
  categories: [
    {
      label: 'Skin Care',
      filterId: 'skin',
      imageUrl: 'https://images.pexels.com/photos/3762879/pexels-photo-3762879.jpeg?auto=compress&cs=tinysrgb&w=600',
      imageAlt: 'Skin Care',
      description: 'Targeted care for acne, pigmentation, dullness and aging',
      order: 1,
      isVisible: true
    },
    {
      label: 'Hair Care',
      filterId: 'hair',
      imageUrl: '/assets/banners/haircare0.webp',
      imageAlt: 'Hair Care',
      description: 'Solutions for hair fall, dandruff and premature greying',
      order: 2,
      isVisible: true
    },
    {
      label: 'Body Care',
      filterId: 'body',
      imageUrl: '/assets/banners/body0.webp',
      imageAlt: 'Body Care',
      description: 'Nourishing rituals for healthy, glowing skin',
      order: 3,
      isVisible: true
    },
    {
      label: 'Lip Care',
      filterId: 'lip',
      imageUrl: '/assets/banners/lip0.webp',
      imageAlt: 'Lip Care',
      description: 'Pure, healing care for soft and healthy lips',
      order: 4,
      isVisible: true
    },
    {
      label: 'Makeup',
      filterId: 'makeup',
      imageUrl: '/assets/banners/makeup.webp',
      imageAlt: 'Makeup',
      description: 'Enhance your natural beauty with clean formulations',
      order: 5,
      isVisible: true
    }
  ],
  promises: [
    {
      icon: 'FlaskConical',
      title: 'Science-Backed Active Ingredients',
      description: 'Bodilicious products are formulated with proven actives like COENZYME Q10+PDRN, Retinol, Exosomes, Ceramides, Peptides, Niacinamide, Salicylic, and Azelaic acid to effectively target real concerns such as acne, pigmentation, tan, and dryness.',
      order: 1
    },
    {
      icon: 'Leaf',
      title: 'Nature + Technology Formulations',
      description: 'We combine powerful botanical extracts like Aloe Vera, Bhringraj, Hibiscus and Ashwagandha with modern skincare science to deliver products that are both effective and gentle.',
      order: 2
    },
    {
      icon: 'Sparkles',
      title: 'Complete Care for Skin, Hair & Beauty',
      description: 'From skincare and haircare to lip care and makeup, Bodilicious offers a complete range of products designed to help you look healthy, radiant and confident every day.',
      order: 3
    }
  ],
  amazonReviews: [
    {
      rating: 5,
      comment: "I like natural bodilicious products ...truly worthy ........i always load my supplies ...skin, and hair- shampoo and conditioner tooo!!! its best value I would have to say",
      user: "Ravi",
      productName: "Bodilicious Liquid Sunscreen",
      date: "29 July 2024",
      isVerified: true,
      order: 1
    },
    {
      rating: 5,
      comment: "Amazing product by Bodilicious. My hair fall got controlled and mild shampoo but leathers less. I strongly suggest this product to all who have hair fall issues and dryness",
      user: "PREMKUMAR K.",
      productName: "Bodilicious Hair Strengthening Milk Protein Shampoo",
      date: "16 September 2021",
      isVerified: true,
      order: 2
    },
    {
      rating: 5,
      comment: "It controls oil without drying out my face. Finally found a staple for my routine.",
      user: "Neha Sharma",
      productName: "Bodilicious Salicylic Acid Serum",
      date: "12 May 2024",
      isVerified: false,
      order: 3
    }
  ],
  faqs: [
    {
      question: 'Can I use multiple serums together?',
      answer: 'Some serums can be layered, but certain actives should not be used together. Vitamin C and Hyaluronic Acid can be safely combined, while Retinol with AHA/BHA should be avoided in the same routine. Retinol and Vitamin C are best used in the night and Retinol is used at night. Always introduce one active ingredient at a time.',
      order: 1,
      isVisible: true
    },
    {
      question: 'How long does it take to see results?',
      answer: 'Results vary depending on the product and concern. Hydration products may show results within a few days, acne treatments typically take 2–4 weeks, and pigmentation treatments may take 4–8 weeks. Hair growth products usually require several weeks to months for noticeable changes. Consistent use is essential for visible results.',
      order: 2,
      isVisible: true
    },
    {
      question: 'Do I need sunscreen while using active ingredients?',
      answer: 'Yes. Many active ingredients such as retinol, AHA, BHA and vitamin C can increase skin sensitivity to sunlight. Always apply sunscreen during the day when using these products.',
      order: 3,
      isVisible: true
    },
    {
      question: 'Are Bodilicious products suitable for all skin types?',
      answer: 'Most Bodilicious products are formulated to suit multiple skin types including dry, normal, oily and combination skin. Each product page clearly lists the recommended skin types and any skin types that should avoid the product.',
      order: 4,
      isVisible: true
    }
  ],
  sectionTitles: {
    bestSellersTitle: "Best Sellers",
    bestSellersSubtitle: "Discover",
    newArrivalsTitle: "New Arrivals",
    newArrivalsSubtitle: "Just Landed",
    categoriesTitle: "Category",
    categoriesSubtitle: "Shop by",
    promisesTitle: "Why Bodilicious?",
    promisesSubtitle: "Our Promise",
    reviewsTitle: "What Our Customers Say",
    reviewsSubtitle: "Real Results",
    faqTitle: "Frequently Asked Questions",
    faqSubtitle: "Queries",
    ctaTitle: "Start Your Targeted Care Journey",
    ctaSubtitle: "Look Good, Feel Good",
    ctaDescription: "Discover skincare and haircare products made to solve real concerns with trusted, handmade, dermatologically tested formulations.",
    ctaButtonText: "Shop Now"
  }
};

const runSeed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
    console.log("MongoDB connected");

    let content = await HomepageContent.findOne();
    if (!content) {
      content = new HomepageContent();
    }

    content.published = {
      ...seedData,
      status: 'published',
      publishedAt: new Date(),
      updatedBy: "system",
      version: 1
    };
    content.draft = {
      ...seedData,
      status: 'draft',
      updatedAt: new Date(),
      updatedBy: "system"
    };

    await content.save();
    console.log("Homepage content seeded successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding homepage content:", error);
    process.exit(1);
  }
};

runSeed();

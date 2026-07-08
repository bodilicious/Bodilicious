import { ArrowRight, Leaf, Sparkles, ChevronRight, Loader2, FlaskConical, CheckCircle2, MessageCircle } from 'lucide-react';
import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { m, useReducedMotion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
import Footer from '../components/Footer';
import StarRating from '../components/StarRating';
import VideoSnippets from '../components/VideoSnippets';
import HeroCarousel from '../components/HeroCarousel';
import { fadeUpVariant, staggerContainerVariant, getAccessibleVariant, easings } from '../utils/motionTokens';
import { useSEO } from '../hooks/useSEO';
import EditableBlock from '../components/EditableBlock';
import EditableList from '../components/EditableList';
import ImageUploadField from '../components/ImageUploadField';
import ProductPickerModal from '../admin/ProductPickerModal';
import { Settings2 } from 'lucide-react';

// Fallback assets
import haircareImg from '../assets/banners/haircare0.webp';
import bodyImg from '../assets/banners/body0.webp';
import lipImg from '../assets/banners/lip0.webp';
import makeupImg from '../assets/banners/makeup.webp';

// ─── Hardcoded fallback content (used when DB has not been seeded) ────────────
const DEFAULT_CATEGORIES = [
  {
    label: 'Skin Care',
    filterId: 'skin',
    imageUrl: 'https://images.pexels.com/photos/3762879/pexels-photo-3762879.jpeg?auto=compress&cs=tinysrgb&w=600',
    imageAlt: 'Skin Care',
    description: 'Targeted care for acne, pigmentation, dullness and aging',
    order: 1,
    isVisible: true,
  },
  {
    label: 'Hair Care',
    filterId: 'hair',
    imageUrl: haircareImg,
    imageAlt: 'Hair Care',
    description: 'Solutions for hair fall, dandruff and premature greying',
    order: 2,
    isVisible: true,
  },
  {
    label: 'Body Care',
    filterId: 'body',
    imageUrl: bodyImg,
    imageAlt: 'Body Care',
    description: 'Nourishing rituals for healthy, glowing skin',
    order: 3,
    isVisible: true,
  },
  {
    label: 'Lip Care',
    filterId: 'lip',
    imageUrl: lipImg,
    imageAlt: 'Lip Care',
    description: 'Pure, healing care for soft and healthy lips',
    order: 4,
    isVisible: true,
  },
  {
    label: 'Makeup',
    filterId: 'makeup',
    imageUrl: makeupImg,
    imageAlt: 'Makeup',
    description: 'Enhance your natural beauty with clean formulations',
    order: 5,
    isVisible: true,
  },
];

const DEFAULT_PROMISES = [
  {
    icon: 'FlaskConical',
    title: 'Science-Backed Active Ingredients',
    description: 'Bodilicious products are formulated with proven actives like COENZYME Q10+PDRN, Retinol, Exosomes, Ceramides, Peptides, Niacinamide, Salicylic, and Azelaic acid to effectively target real concerns such as acne, pigmentation, tan, and dryness.',
    order: 1,
  },
  {
    icon: 'Leaf',
    title: 'Nature + Technology Formulations',
    description: 'We combine powerful botanical extracts like Aloe Vera, Bhringraj, Hibiscus and Ashwagandha with modern skincare science to deliver products that are both effective and gentle.',
    order: 2,
  },
  {
    icon: 'Sparkles',
    title: 'Complete Care for Skin, Hair & Beauty',
    description: 'From skincare and haircare to lip care and makeup, Bodilicious offers a complete range of products designed to help you look healthy, radiant and confident every day.',
    order: 3,
  },
];

const DEFAULT_AMAZON_REVIEWS = [
  {
    rating: 5,
    comment: "I like natural bodilicious products ...truly worthy ........i always load my supplies ...skin, and hair- shampoo and conditioner tooo!!! its best value I would have to say",
    user: "Ravi",
    productName: "Bodilicious Liquid Sunscreen",
    date: "29 July 2024",
    isVerified: true,
    order: 1,
  },
  {
    rating: 5,
    comment: "Amazing product by Bodilicious. My hair fall got controlled and mild shampoo but leathers less. I strongly suggest this product to all who have hair fall issues and dryness",
    user: "PREMKUMAR K.",
    productName: "Bodilicious Hair Strengthening Milk Protein Shampoo",
    date: "16 September 2021",
    isVerified: true,
    order: 2,
  },
  {
    rating: 5,
    comment: "It controls oil without drying out my face. Finally found a staple for my routine.",
    user: "Neha Sharma",
    productName: "Bodilicious Salicylic Acid Serum",
    date: "12 May 2024",
    isVerified: false,
    order: 3,
  },
];

const DEFAULT_FAQS = [
  {
    question: 'Can I use multiple serums together?',
    answer: 'Some serums can be layered, but certain actives should not be used together. Vitamin C and Hyaluronic Acid can be safely combined, while Retinol with AHA/BHA should be avoided in the same routine. Retinol and Vitamin C are best used in the night and Retinol is used at night. Always introduce one active ingredient at a time.',
    order: 1,
    isVisible: true,
  },
  {
    question: 'How long does it take to see results?',
    answer: 'Results vary depending on the product and concern. Hydration products may show results within a few days, acne treatments typically take 2–4 weeks, and pigmentation treatments may take 4–8 weeks. Hair growth products usually require several weeks to months for noticeable changes. Consistent use is essential for visible results.',
    order: 2,
    isVisible: true,
  },
  {
    question: 'Do I need sunscreen while using active ingredients?',
    answer: 'Yes. Many active ingredients such as retinol, AHA, BHA and vitamin C can increase skin sensitivity to sunlight. Always apply sunscreen during the day when using these products.',
    order: 3,
    isVisible: true,
  },
  {
    question: 'Are Bodilicious products suitable for all skin types?',
    answer: 'Most Bodilicious products are formulated to suit multiple skin types including dry, normal, oily and combination skin. Each product page clearly lists the recommended skin types and any skin types that should avoid the product.',
    order: 4,
    isVisible: true,
  },
];

const DEFAULT_SECTION_TITLES = {
  bestSellersTitle: 'Best Sellers',
  bestSellersSubtitle: 'Discover',
  newArrivalsTitle: 'New Arrivals',
  newArrivalsSubtitle: 'Just Landed',
  categoriesTitle: 'Category',
  categoriesSubtitle: 'Shop by',
  promisesTitle: 'Why Bodilicious?',
  promisesSubtitle: 'Our Promise',
  reviewsTitle: 'What Our Customers Say',
  reviewsSubtitle: 'Real Results',
  faqTitle: 'Frequently Asked Questions',
  faqSubtitle: 'Queries',
  ctaTitle: 'Start Your Targeted Care Journey',
  ctaSubtitle: 'Look Good, Feel Good',
  ctaDescription: 'Discover skincare and haircare products made to solve real concerns with trusted, handmade, dermatologically tested formulations.',
  ctaButtonText: 'Shop Now',
};
// ─────────────────────────────────────────────────────────────────────────────

const PROMISE_ICON_MAP: Record<string, any> = {
  FlaskConical,
  Leaf,
  Sparkles,
};

// Maps DB-stored literal paths → Vite-processed hashed imports.
// The seed script stores paths like '/assets/banners/haircare0.webp' which
// don't exist at runtime because Vite renames & hashes bundled assets.
const BUNDLED_BANNER_MAP: Record<string, string> = {
  '/assets/banners/haircare0.webp': haircareImg,
  'assets/banners/haircare0.webp': haircareImg,
  '/assets/banners/body0.webp': bodyImg,
  'assets/banners/body0.webp': bodyImg,
  '/assets/banners/lip0.webp': lipImg,
  'assets/banners/lip0.webp': lipImg,
  '/assets/banners/makeup.webp': makeupImg,
  'assets/banners/makeup.webp': makeupImg,
};

/** Resolves a category image URL, substituting bundled Vite assets for known literal paths. */
const resolveBannerUrl = (url: string): string => BUNDLED_BANNER_MAP[url] ?? url;

interface HomePageProps {
  isEditing?: boolean;
  contentData?: any;
  onContentChange?: (newData: any) => void;
}

export default function HomePage({ isEditing = false, contentData: propContentData, onContentChange }: HomePageProps) {
  const { setShopFilter, products, isLoading, error } = useApp();
  const [publishedContent, setPublishedContent] = useState<any>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const fadeUp = getAccessibleVariant(fadeUpVariant, !!shouldReduceMotion);
  const stagger = getAccessibleVariant(staggerContainerVariant, !!shouldReduceMotion);

  useSEO({
    title: 'Bodilicious — Premium Herbal Skincare & Haircare',
    description:
      'Shop dermatologically tested herbal skincare and haircare made with science-backed actives like Niacinamide, Retinol & Hyaluronic Acid. Free shipping on orders over ₹1500.',
    keywords: 'herbal skincare products, dermatologically tested herbal haircare, niacinamide serum for glowing skin, retinol anti-aging cream herbal, organic shampoo for hair fall, hyaluronic acid moisturizer natural, premium herbal skincare india, buy skincare products online india',
    canonical: '/',
  });

  // Splash screen state
  const hasSeenSplash = sessionStorage.getItem('splashShown');
  const [showSplash, setShowSplash] = useState(!hasSeenSplash && !isEditing);
  const [reviewTab, setReviewTab] = useState<'website' | 'amazon'>('website');
  const [activePicker, setActivePicker] = useState<'bestSellers' | 'newArrivals' | null>(null);
  const [isPastBanner, setIsPastBanner] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // 500px is roughly the height of the banner on most devices
      setIsPastBanner(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const dismissSplash = useCallback(() => {
    setShowSplash(false);
    sessionStorage.setItem('splashShown', 'true');
    window.dispatchEvent(new Event('splashDismissed'));
  }, []);

  useEffect(() => {
    if (!showSplash) return;
    if (!isLoading) dismissSplash();
  }, [isLoading, error, showSplash, dismissSplash]);

  useEffect(() => {
    if (!showSplash) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissSplash();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSplash, dismissSplash]);

  useEffect(() => {
    if (!showSplash) return;
    const fallback = setTimeout(() => dismissSplash(), 35000);
    return () => clearTimeout(fallback);
  }, [showSplash, dismissSplash]);

  useEffect(() => {
    if (location.hash === '#faq') {
      const el = document.getElementById('faq');
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 300);
    }
  }, [location]);

  // Ref guard: fetch homepage content exactly once — avoids re-fetching every time
  // publishedContent or fetchingHomepage state changes (which re-triggered the effect).
  const homepageFetchedRef = useRef(false);
  useEffect(() => {
    if (isEditing || propContentData || homepageFetchedRef.current) return;
    homepageFetchedRef.current = true;
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/settings/homepage`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setPublishedContent(data.data);
        } else {
          setPublishedContent({});
        }
      })
      .catch(err => {
        console.error('Failed to load homepage content', err);
        homepageFetchedRef.current = false; // allow retry on error
        setPublishedContent({});
      });
  }, [isEditing, propContentData]); // stable deps — no publishedContent/fetchingHomepage loop

  const contentData = propContentData || publishedContent;

  const handleShop = useCallback((filter: 'all' | 'skin' | 'hair' | 'body' | 'lip' | 'makeup' | 'other') => {
    if (isEditing) return;
    setShopFilter(filter);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (filter === 'all') navigate('/shop');
    else navigate(`/shop?category=${filter}`);
  }, [navigate, setShopFilter, isEditing]);

  const [fetchedBestSellers, setFetchedBestSellers] = useState<any[]>([]);

  useEffect(() => {
    // If we already have the products in AppContext, we might not need to fetch,
    // but to guarantee we have all 6 regardless of AppContext's limit=24, we fetch them explicitly.
    if (isEditing) return;

    if (contentData?.bestSellerMode === 'manual' && contentData.bestSellerPids?.length > 0) {
      Promise.all(
        contentData.bestSellerPids.map((pid: string) =>
          fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/products/${pid}`)
            .then(res => res.json())
            .then(res => res.data)
            .catch(() => null)
        )
      ).then(results => {
        setFetchedBestSellers(results.filter(Boolean));
      });
    } else {
      const defaultAutoNames = [
        "coenzyme q10 serum",
        "glow boost serum",
        "physical sunscreen with spf 50",
        "kojic glycolic",
        "hydrating sunscreen spray",
        "peptide ceramide collagen"
      ];
      
      Promise.all(
        defaultAutoNames.map(name =>
          fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/products?name=${encodeURIComponent(name)}&slim=true`)
            .then(res => res.json())
            .then(res => res.data?.[0])
            .catch(() => null)
        )
      ).then(results => {
        setFetchedBestSellers(results.filter(Boolean));
      });
    }
  }, [contentData?.bestSellerMode, contentData?.bestSellerPids, isEditing]);

  const bestSellers = useMemo(() => {
    if (fetchedBestSellers.length > 0) {
      return fetchedBestSellers;
    }
    // Fallback to context products while fetching
    if (!products || !Array.isArray(products) || products.length === 0) return [];
    
    if (contentData?.bestSellerMode === 'manual' && contentData.bestSellerPids?.length > 0) {
      return contentData.bestSellerPids
        .map((pid: string) => products.find(p => p.pid === pid))
        .filter((p: any): p is NonNullable<typeof p> => !!p);
    }

    const defaultAutoNames = [
      "coenzyme q10 serum",
      "glow boost serum",
      "physical sunscreen with spf 50",
      "kojic glycolic",
      "hydrating sunscreen spray",
      "peptide ceramide collagen"
    ].map(n => n.toLowerCase().trim());

    const autoBestSellers = products.filter(p => {
      const pName = (p?.name || "").toLowerCase().trim();
      return defaultAutoNames.some(targetName => pName.includes(targetName));
    });

    if (autoBestSellers.length > 0) {
      return autoBestSellers.sort((a, b) => {
        const aName = (a?.name || "").toLowerCase().trim();
        const bName = (b?.name || "").toLowerCase().trim();
        const aIndex = defaultAutoNames.findIndex(n => aName.includes(n));
        const bIndex = defaultAutoNames.findIndex(n => bName.includes(n));
        return aIndex - bIndex;
      });
    }

    return [...products].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4);
  }, [products, fetchedBestSellers, contentData?.bestSellerMode, contentData?.bestSellerPids]);

  const newArrivals = useMemo(() => {
    if (!products || !Array.isArray(products) || products.length === 0) return [];

    if (contentData?.newArrivalMode === 'manual' && contentData.newArrivalPids?.length > 0) {
      return contentData.newArrivalPids
        .map((pid: string) => products.find(p => p.pid === pid))
        .filter((p: any): p is NonNullable<typeof p> => !!p);
    }

    return [...products].filter(p => !!p.createdAt).sort((a, b) => {
      const aTime = new Date(a.createdAt!).getTime() || 0;
      const bTime = new Date(b.createdAt!).getTime() || 0;
      return bTime - aTime;
    }).slice(0, 6);
  }, [products, contentData?.newArrivalMode, contentData?.newArrivalPids]);

  const [websiteReviews, setWebsiteReviews] = useState<any[]>([]);

  useEffect(() => {
    // Fetch a small batch of top reviews via dedicated lightweight endpoint to save bandwidth
    const url = `${import.meta.env.VITE_API_URL || ''}/api/v1/products/reviews/top`;
    fetch(url)
      .then(res => res.json())
      .then(json => {
        if (json && json.success && Array.isArray(json.data)) {
          setWebsiteReviews(json.data);
        }
      })
      .catch(err => console.error('Failed to fetch reviews for homepage:', err));
  }, []);

  // Handle generic text change
  const handleTextChange = (path: string, value: string) => {
    if (!onContentChange) return;
    // Ensure we operate on the current full state including defaults
    const base = isEditing
      ? {
          ...(contentData || {})
        }
      : contentData;
    if (!base) return;
    const keys = path.split('.');
    const newData = JSON.parse(JSON.stringify(base));
    let curr = newData;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!curr[keys[i]]) curr[keys[i]] = {};
      curr = curr[keys[i]];
    }
    curr[keys[keys.length - 1]] = value;
    onContentChange(newData);
  };

  const handleListChange = (key: string, newItems: any[]) => {
    if (!onContentChange) return;
    // Ensure we operate on the current full state including defaults
    const base = isEditing
      ? {
          ...(contentData || {})
        }
      : contentData;
    if (!base) return;
    onContentChange({ ...base, [key]: newItems });
  };

  if (!showSplash && (isLoading || (!isEditing && !contentData)) && !hasSeenSplash && !isEditing) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-dark-red animate-spin mb-4" />
        <p className="text-dark-red font-sans text-sm uppercase tracking-widest">Loading Bodilicious...</p>
      </div>
    );
  }

  const titles = { ...DEFAULT_SECTION_TITLES, ...(contentData?.sectionTitles || {}) };

  // Use DB content when available, otherwise fall back to hardcoded originals
  const categories: any[] = (contentData?.categories && contentData.categories.length > 0)
    ? contentData.categories
    : DEFAULT_CATEGORIES;
  const promises: any[] = (contentData?.promises && contentData.promises.length > 0)
    ? contentData.promises
    : DEFAULT_PROMISES;
  const amazonReviews: any[] = (contentData?.amazonReviews && contentData.amazonReviews.length > 0)
    ? contentData.amazonReviews
    : DEFAULT_AMAZON_REVIEWS;
  const faqs: any[] = (contentData?.faqs && contentData.faqs.length > 0)
    ? contentData.faqs
    : DEFAULT_FAQS;
  const videoSnippets: any[] = contentData?.videoSnippets || [];

  return (
    <div className={`bg-white ${showSplash ? 'pointer-events-none' : ''}`}>
      <AnimatePresence>
        {showSplash && (
          <m.div
            role="status"
            onClick={dismissSplash}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-[#fdf9f0] via-[#f7f3ea] to-[#f4ebe1] flex flex-col items-center justify-center pointer-events-auto cursor-pointer overflow-hidden"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8, ease: easings.standard } }}
          >
            <div className="relative flex flex-col items-center pointer-events-none z-10 w-full max-w-lg px-6">
              <img src="/logo.webp" alt="Bodilicious Logo" loading="eager" decoding="async" className="w-56 md:w-72 mb-10" />
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
          
          <HeroCarousel 
            slides={contentData?.heroSlides} 
            isEditing={isEditing} 
            onSlidesChange={(newSlides) => handleListChange('heroSlides', newSlides)} 
          />

          <ProductPickerModal
            isOpen={activePicker !== null}
            onClose={() => setActivePicker(null)}
            selectedPids={activePicker === 'bestSellers' ? (contentData?.bestSellerPids || []) : (contentData?.newArrivalPids || [])}
            onSave={(pids) => {
              if (activePicker === 'bestSellers') {
                handleTextChange('bestSellerPids', pids as any);
              } else if (activePicker === 'newArrivals') {
                handleTextChange('newArrivalPids', pids as any);
              }
            }}
          />

          {/* BEST SELLERS */}
          <section className="py-20 bg-white overflow-hidden">
            <m.div
              className="max-w-7xl mx-auto px-6"
              initial="hidden"
              animate="visible"
              variants={stagger}
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
                <m.div variants={fadeUp} className="relative flex-1 pr-12">
                  <EditableBlock 
                    isEditing={isEditing} value={titles.bestSellersSubtitle} 
                    onChange={v => handleTextChange('sectionTitles.bestSellersSubtitle', v)}
                    tagName="p" className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-2" 
                  />
                  <EditableBlock 
                    isEditing={isEditing} value={titles.bestSellersTitle} 
                    onChange={v => handleTextChange('sectionTitles.bestSellersTitle', v)}
                    tagName="h2" className="font-serif text-dark-red text-3xl md:text-4xl" 
                  />
                  {isEditing && (
                    <div className="absolute right-0 top-0 flex flex-col items-end gap-2">
                      <button
                        onClick={() => handleTextChange('bestSellerMode', contentData?.bestSellerMode === 'manual' ? 'auto' : 'manual')}
                        className="px-2 py-1 bg-white border border-slate-200 text-[10px] rounded hover:bg-slate-50 transition-colors uppercase font-sans tracking-widest text-slate-500"
                      >
                        Mode: {contentData?.bestSellerMode === 'manual' ? 'Manual' : 'Auto'}
                      </button>
                      {contentData?.bestSellerMode === 'manual' && (
                        <button
                          onClick={() => setActivePicker('bestSellers')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-red text-white text-xs rounded hover:bg-ruby-red transition-colors font-sans uppercase tracking-widest"
                        >
                          <Settings2 size={14} /> Choose Products
                        </button>
                      )}
                    </div>
                  )}
                </m.div>
                {!isEditing && (
                  <m.button variants={fadeUp} onClick={() => handleShop('all')} className="flex items-center gap-1 mt-4 md:mt-0 text-xs font-sans tracking-widest uppercase text-grey-beige hover:text-ruby-red transition-colors">
                    View All <ChevronRight size={14} />
                  </m.button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {bestSellers.map((product: any) => (
                  <m.div key={product.pid} variants={fadeUp}>
                    <ProductCard product={product} />
                  </m.div>
                ))}
              </div>
            </m.div>
          </section>

          {/* NEW ARRIVALS */}
          {newArrivals.length > 0 && (
            <section className="py-20 bg-silk-light overflow-hidden">
              <m.div
                className="max-w-7xl mx-auto px-6"
                initial="hidden"
                animate="visible"
                variants={stagger}
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
                  <m.div variants={fadeUp} className="relative flex-1 pr-12">
                    <EditableBlock 
                      isEditing={isEditing} value={titles.newArrivalsSubtitle} 
                      onChange={v => handleTextChange('sectionTitles.newArrivalsSubtitle', v)}
                      tagName="p" className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-2" 
                    />
                    <EditableBlock 
                      isEditing={isEditing} value={titles.newArrivalsTitle} 
                      onChange={v => handleTextChange('sectionTitles.newArrivalsTitle', v)}
                      tagName="h2" className="font-serif text-dark-red text-3xl md:text-4xl" 
                    />
                    {isEditing && (
                      <div className="absolute right-0 top-0 flex flex-col items-end gap-2">
                        <button
                          onClick={() => handleTextChange('newArrivalMode', contentData?.newArrivalMode === 'manual' ? 'auto' : 'manual')}
                          className="px-2 py-1 bg-white border border-slate-200 text-[10px] rounded hover:bg-slate-50 transition-colors uppercase font-sans tracking-widest text-slate-500"
                        >
                          Mode: {contentData?.newArrivalMode === 'manual' ? 'Manual' : 'Auto'}
                        </button>
                        {contentData?.newArrivalMode === 'manual' && (
                          <button
                            onClick={() => setActivePicker('newArrivals')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-red text-white text-xs rounded hover:bg-ruby-red transition-colors font-sans uppercase tracking-widest"
                          >
                            <Settings2 size={14} /> Choose Products
                          </button>
                        )}
                      </div>
                    )}
                  </m.div>
                  {!isEditing && (
                    <m.button variants={fadeUp} onClick={() => handleShop('all')} className="flex items-center gap-1 mt-4 md:mt-0 text-xs font-sans tracking-widest uppercase text-grey-beige hover:text-ruby-red transition-colors">
                      View All <ChevronRight size={14} />
                    </m.button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  {newArrivals.map((product: any) => (
                    <m.div key={product.pid} variants={fadeUp}>
                      <ProductCard product={product} />
                    </m.div>
                  ))}
                </div>
              </m.div>
            </section>
          )}

          {/* CATEGORY */}
          <section className="py-20 bg-white overflow-hidden">
            <m.div
              className="max-w-7xl mx-auto px-6"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
            >
              <m.div variants={fadeUp} className="text-center mb-12">
                <EditableBlock 
                  isEditing={isEditing} value={titles.categoriesSubtitle} 
                  onChange={v => handleTextChange('sectionTitles.categoriesSubtitle', v)}
                  tagName="p" className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-2" 
                />
                <EditableBlock 
                  isEditing={isEditing} value={titles.categoriesTitle} 
                  onChange={v => handleTextChange('sectionTitles.categoriesTitle', v)}
                  tagName="h2" className="font-serif text-dark-red text-3xl md:text-4xl" 
                />
              </m.div>

              <EditableList
                isEditing={isEditing}
                items={categories}
                onItemsChange={(newItems) => handleListChange('categories', newItems)}
                getItemId={(c) => c._id || c.filterId}
                strategy="rect"
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
                onAdd={() => handleListChange('categories', [...categories, { _id: Array.from({length:24}, () => Math.floor(Math.random()*16).toString(16)).join(''), label: 'New Category', filterId: `cat-${Date.now()}`, imageUrl: '', imageAlt: '', description: '', order: categories.length + 1 }])}
                renderItem={(cat, idx) => (
                  <m.div
                    variants={isEditing ? undefined : fadeUp}
                    style={isEditing ? { opacity: 1, transform: 'none' } : undefined}
                    className={`group relative overflow-hidden aspect-[4/5] text-left ${isEditing ? 'border border-slate-200' : 'cursor-pointer'}`}
                    onClick={() => !isEditing && handleShop(cat.filterId as any)}
                  >
                    <ImageUploadField
                      isEditing={isEditing}
                      imageUrl={resolveBannerUrl(cat.imageUrl)}
                      imageAlt={cat.imageAlt}
                      onImageChange={(url) => {
                        const newCats = [...categories];
                        newCats[idx] = { ...newCats[idx], imageUrl: url };
                        handleListChange('categories', newCats);
                      }}
                      onAltChange={(alt) => {
                        const newCats = [...categories];
                        newCats[idx] = { ...newCats[idx], imageAlt: alt };
                        handleListChange('categories', newCats);
                      }}
                      containerClassName="absolute inset-0"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-red/80 via-dark-red/20 to-transparent pointer-events-none" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 z-30 pointer-events-none">
                      <div className="pointer-events-auto transition-transform duration-500 group-hover:-translate-y-2">
                        <EditableBlock
                          isEditing={isEditing}
                          value={cat.label}
                          onChange={(v) => {
                            const newCats = [...categories];
                            newCats[idx] = { ...newCats[idx], label: v };
                            handleListChange('categories', newCats);
                          }}
                          tagName="h3"
                          className="font-serif text-silk text-3xl mb-1 block"
                        />
                        <EditableBlock
                          isEditing={isEditing}
                          value={cat.description}
                          onChange={(v) => {
                            const newCats = [...categories];
                            newCats[idx] = { ...newCats[idx], description: v };
                            handleListChange('categories', newCats);
                          }}
                          tagName="p"
                          multiline
                          className="text-silk/80 text-sm font-sans block mb-3"
                        />
                      </div>
                      {!isEditing && (
                        <div className="flex items-center gap-1 mt-3 text-indian-red text-sm font-sans tracking-widest uppercase transition-all duration-500 group-hover:text-ruby-red">
                          <span className="flex items-center gap-1 transition-transform duration-500 group-hover:translate-x-2">
                            Shop Now <ChevronRight size={14} />
                          </span>
                        </div>
                      )}
                    </div>
                  </m.div>
                )}
              />
            </m.div>
          </section>

          <VideoSnippets 
            isEditing={isEditing} 
            items={videoSnippets} 
            onItemsChange={(newItems) => handleListChange('videoSnippets', newItems)} 
          />

          {/* PROMISES / WHY BODILICIOUS */}
          <section className="py-20 bg-dark-red text-silk overflow-hidden">
            <m.div
              className="max-w-7xl mx-auto px-6"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
            >
              <m.div variants={fadeUp} className="text-center mb-14">
                <EditableBlock 
                  isEditing={isEditing} value={titles.promisesSubtitle} 
                  onChange={v => handleTextChange('sectionTitles.promisesSubtitle', v)}
                  tagName="p" className="text-[10px] font-sans tracking-[0.3em] uppercase text-indian-red mb-2" 
                />
                <EditableBlock 
                  isEditing={isEditing} value={titles.promisesTitle} 
                  onChange={v => handleTextChange('sectionTitles.promisesTitle', v)}
                  tagName="h2" className="font-serif text-3xl md:text-4xl" 
                />
              </m.div>

              <EditableList
                isEditing={isEditing}
                items={promises}
                onItemsChange={(newItems) => handleListChange('promises', newItems)}
                getItemId={(p) => p._id || p.title}
                strategy="rect"
                className="grid grid-cols-1 md:grid-cols-3 gap-10"
                onAdd={() => handleListChange('promises', [...promises, { _id: Array.from({length:24}, () => Math.floor(Math.random()*16).toString(16)).join(''), title: 'New Promise', description: 'Description here', icon: 'Leaf', order: promises.length + 1 }])}
                renderItem={(promise, idx) => {
                  const IconComponent = PROMISE_ICON_MAP[promise.icon] || Sparkles;
                  return (
                    <m.div key={promise._id || promise.title} variants={isEditing ? undefined : fadeUp} style={isEditing ? { opacity: 1, transform: 'none' } : undefined} className="text-center">
                      <div className="w-14 h-14 rounded-full bg-ruby-red/20 border border-ruby-red/30 flex items-center justify-center mx-auto mb-6">
                        <IconComponent size={22} className="text-indian-red" />
                      </div>
                      <EditableBlock
                        isEditing={isEditing} value={promise.title}
                        onChange={(v) => {
                          const p = [...promises]; p[idx] = { ...p[idx], title: v }; handleListChange('promises', p);
                        }}
                        tagName="h3" className="font-serif text-xl mb-3 block"
                      />
                      <EditableBlock
                        isEditing={isEditing} value={promise.description} multiline
                        onChange={(v) => {
                          const p = [...promises]; p[idx] = { ...p[idx], description: v }; handleListChange('promises', p);
                        }}
                        tagName="p" className="text-silk/60 font-sans text-sm leading-relaxed block"
                      />
                    </m.div>
                  );
                }}
              />
            </m.div>
          </section>

          {/* REVIEWS */}
          <section className="py-20 bg-silk-light overflow-hidden">
            <m.div
              className="max-w-7xl mx-auto px-6"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
            >
              <m.div variants={fadeUp} className="text-center mb-10">
                <EditableBlock 
                  isEditing={isEditing} value={titles.reviewsSubtitle} 
                  onChange={v => handleTextChange('sectionTitles.reviewsSubtitle', v)}
                  tagName="p" className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-2" 
                />
                <EditableBlock 
                  isEditing={isEditing} value={titles.reviewsTitle} 
                  onChange={v => handleTextChange('sectionTitles.reviewsTitle', v)}
                  tagName="h2" className="font-serif text-dark-red text-3xl md:text-4xl" 
                />
              </m.div>

              <m.div variants={fadeUp} className="flex justify-center mb-10">
                <div className="inline-flex border border-silk-dark/30 rounded-full p-1 bg-white shadow-sm">
                  <button
                    onClick={() => setReviewTab('website')}
                    className={`px-5 py-2 rounded-full text-xs font-sans tracking-widest uppercase transition-all duration-200 ${
                      reviewTab === 'website' ? 'bg-dark-red text-silk shadow-sm' : 'text-grey-beige hover:text-dark-red'
                    }`}
                  >
                    Customer Reviews
                  </button>
                  <button
                    onClick={() => setReviewTab('amazon')}
                    className={`px-5 py-2 rounded-full text-xs font-sans tracking-widest uppercase transition-all duration-200 ${
                      reviewTab === 'amazon' ? 'bg-dark-red text-silk shadow-sm' : 'text-grey-beige hover:text-dark-red'
                    }`}
                  >
                    From Our Customers
                  </button>
                </div>
              </m.div>

              <AnimatePresence mode="wait">
                <m.div
                  key={reviewTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="w-full"
                >
                  {reviewTab === 'website' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {websiteReviews.map((review, i) => (
                        <m.div key={i} className="bg-white p-7 border border-silk/30 hover:border-ruby-red/20 transition-all shadow-sm">
                          <StarRating rating={review.rating} size={14} />
                          <p className="font-sans text-dark-red/80 text-sm leading-relaxed mt-4 mb-6 italic">"{review.comment}"</p>
                          <div className="border-t border-silk/50 pt-4 flex items-end justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-sans font-semibold text-dark-red">{review.user}</p>
                                {review.isVerified && (
                                  <span className="flex items-center gap-0.5 px-1 bg-green-50 text-green-700 border border-green-100 rounded-full text-[7px] font-bold uppercase tracking-tighter">
                                    <CheckCircle2 size={9} strokeWidth={3} />
                                    Verified
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-sans text-grey-beige mt-0.5 leading-none">{review.productName}</p>
                            </div>
                            <p className="text-[10px] font-sans text-grey-beige">
                              {review.createdAt ? new Date((review as any).createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                            </p>
                          </div>
                        </m.div>
                      ))}
                    </div>
                  ) : (
                    <EditableList
                      isEditing={isEditing}
                      items={amazonReviews}
                      onItemsChange={(newItems) => handleListChange('amazonReviews', newItems)}
                      getItemId={(r) => r?._id || String(r?.user || '') + String(r?.comment || '').substring(0, 5)}
                      strategy="rect"
                      className="grid grid-cols-1 md:grid-cols-3 gap-6"
                      onAdd={() => handleListChange('amazonReviews', [...amazonReviews, { _id: Array.from({length:24}, () => Math.floor(Math.random()*16).toString(16)).join(''), rating: 5, comment: 'New comment', user: 'Name', productName: 'Product', date: 'Date', order: amazonReviews.length + 1 }])}
                      renderItem={(review, idx) => (
                        <m.div className="bg-white p-7 border border-silk/30 hover:shadow-sm transition-all h-full flex flex-col justify-between">
                          <div>
                            <StarRating rating={review.rating} size={14} />
                            <EditableBlock
                              isEditing={isEditing} value={review.comment} multiline
                              onChange={(v) => { const r = [...amazonReviews]; r[idx] = { ...r[idx], comment: v }; handleListChange('amazonReviews', r); }}
                              tagName="p" className="font-sans text-dark-red/80 text-sm leading-relaxed mt-4 mb-6 italic block"
                            />
                          </div>
                          <div className="border-t border-silk/50 pt-4 flex items-end justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <EditableBlock
                                  isEditing={isEditing} value={review.user}
                                  onChange={(v) => { const r = [...amazonReviews]; r[idx] = { ...r[idx], user: v }; handleListChange('amazonReviews', r); }}
                                  tagName="p" className="text-xs font-sans font-semibold text-dark-red block"
                                />
                                {review.isVerified && (
                                  <span className="flex items-center gap-0.5 px-1 bg-green-50 text-green-700 border border-green-100 rounded-full text-[7px] font-bold uppercase tracking-tighter">
                                    <CheckCircle2 size={9} strokeWidth={3} />
                                    Verified
                                  </span>
                                )}
                                <span className="flex items-center gap-0.5 px-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[7px] font-bold uppercase tracking-tighter">
                                  Amazon
                                </span>
                              </div>
                              <EditableBlock
                                isEditing={isEditing} value={review.productName}
                                onChange={(v) => { const r = [...amazonReviews]; r[idx] = { ...r[idx], productName: v }; handleListChange('amazonReviews', r); }}
                                tagName="p" className="text-[10px] font-sans text-grey-beige mt-0.5 leading-none block"
                              />
                            </div>
                            <p className="text-[10px] font-sans text-grey-beige">{review.date}</p>
                          </div>
                        </m.div>
                      )}
                    />
                  )}
                </m.div>
              </AnimatePresence>
            </m.div>
          </section>

          {/* FAQS */}
          <div id="faq" className="max-w-7xl mx-auto w-full px-6 mt-24 pt-12 border-t border-silk/50 pb-8">
            <div className="text-center mb-12">
              <EditableBlock 
                isEditing={isEditing} value={titles.faqSubtitle} 
                onChange={v => handleTextChange('sectionTitles.faqSubtitle', v)}
                tagName="p" className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-4" 
              />
              <EditableBlock 
                isEditing={isEditing} value={titles.faqTitle} 
                onChange={v => handleTextChange('sectionTitles.faqTitle', v)}
                tagName="h2" className="font-serif text-3xl lg:text-4xl text-dark-red" 
              />
            </div>

            <EditableList
              isEditing={isEditing}
              items={faqs}
              onItemsChange={(newItems) => handleListChange('faqs', newItems)}
              getItemId={(f) => f._id || f.question}
              strategy="rect"
              className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12"
              onAdd={() => handleListChange('faqs', [...faqs, { _id: Array.from({length:24}, () => Math.floor(Math.random()*16).toString(16)).join(''), question: 'New Question?', answer: 'Answer here', order: faqs.length + 1 }])}
              renderItem={(faq, idx) => (
                <div className="bg-white p-6 border border-silk shadow-sm rounded-sm hover:border-ruby-red/50 transition-colors duration-300 flex flex-col">
                  <EditableBlock
                    isEditing={isEditing} value={faq.question}
                    onChange={(v) => { const f = [...faqs]; f[idx] = { ...f[idx], question: v }; handleListChange('faqs', f); }}
                    tagName="h3" className="font-serif text-lg text-dark-red mb-3 block"
                  />
                  <EditableBlock
                    isEditing={isEditing} value={faq.answer} multiline
                    onChange={(v) => { const f = [...faqs]; f[idx] = { ...f[idx], answer: v }; handleListChange('faqs', f); }}
                    tagName="p" className="font-sans text-gray-600 text-[13px] leading-relaxed font-light block"
                  />
                </div>
              )}
            />
          </div>

          {/* CTA */}
          <section className="py-20 bg-white overflow-hidden">
            <m.div
              className="max-w-2xl mx-auto px-6 text-center"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
            >
              <m.div variants={fadeUp}>
                <EditableBlock 
                  isEditing={isEditing} value={titles.ctaSubtitle} 
                  onChange={v => handleTextChange('sectionTitles.ctaSubtitle', v)}
                  tagName="p" className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-3" 
                />
              </m.div>
              <m.div variants={fadeUp}>
                <EditableBlock 
                  isEditing={isEditing} value={titles.ctaTitle} 
                  onChange={v => handleTextChange('sectionTitles.ctaTitle', v)}
                  tagName="h2" className="font-serif text-dark-red text-3xl md:text-4xl mb-4" 
                />
              </m.div>
              <m.div variants={fadeUp}>
                <EditableBlock 
                  isEditing={isEditing} value={titles.ctaDescription} multiline
                  onChange={v => handleTextChange('sectionTitles.ctaDescription', v)}
                  tagName="p" className="font-sans text-grey-beige text-sm leading-relaxed mb-8 block" 
                />
              </m.div>
              <m.div variants={fadeUp}>
                {isEditing ? (
                  <div className="inline-flex items-center gap-2 bg-dark-red text-silk px-10 py-4 font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-colors border border-dashed border-white">
                    <EditableBlock 
                      isEditing={isEditing} value={titles.ctaButtonText} 
                      onChange={v => handleTextChange('sectionTitles.ctaButtonText', v)}
                      tagName="span" className="inline-block" 
                    />
                    <ArrowRight size={14} />
                  </div>
                ) : (
                  <button
                    onClick={() => handleShop('all')}
                    className="inline-flex items-center gap-2 bg-dark-red text-silk px-10 py-4 font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-colors"
                  >
                    {titles.ctaButtonText} <ArrowRight size={14} />
                  </button>
                )}
              </m.div>
            </m.div>
          </section>

          <Footer />
        </m.div>
      </AnimatePresence>

      {/* Contact Bubble */}
      {!isEditing && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isPastBanner && (
            <m.button
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ duration: 0.4, type: 'spring' }}
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.open('https://wa.me/919894451947', '_blank')}
              className="fixed bottom-6 right-6 z-[90] flex items-center justify-center w-16 h-16 bg-silk text-ruby-red rounded-full shadow-[0_10px_40px_rgba(127,31,14,0.15)] hover:shadow-[0_16px_50px_rgba(127,31,14,0.25)] hover:bg-silk-light transition-all duration-300 cursor-pointer group"
              aria-label="Contact Us"
            >
              <MessageCircle size={28} strokeWidth={2} className="group-hover:scale-110 transition-transform duration-300" />
              <span className="absolute top-0 right-0 w-4 h-4 bg-[#22c55e] border-[2px] border-silk group-hover:border-silk-light transition-colors duration-300 rounded-full shadow-sm" />
            </m.button>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
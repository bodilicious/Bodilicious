import { ArrowRight, Leaf, Sparkles, ChevronRight, Loader2, FlaskConical, CheckCircle2 } from 'lucide-react';
import { useMemo, useCallback, useEffect, useState } from 'react';
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

// Category banner images — bundled via Vite
import haircareImg from '../assets/banners/haircare0.webp';
import bodyImg from '../assets/banners/body0.webp';
import lipImg from '../assets/banners/lip0.webp';
import makeupImg from '../assets/banners/makeup.webp';

const SHOP_CATEGORIES = [
  {
    label: 'Skin Care',
    filter: 'skin' as const,
    img: 'https://images.pexels.com/photos/3762879/pexels-photo-3762879.jpeg?auto=compress&cs=tinysrgb&w=600',
    desc: 'Targeted care for acne, pigmentation, dullness and aging',
  },
  {
    label: 'Hair Care',
    filter: 'hair' as const,
    img: haircareImg,
    desc: 'Solutions for hair fall, dandruff and premature greying',
  },
  {
    label: 'Body Care',
    filter: 'body' as const,
    img: bodyImg,
    desc: 'Nourishing rituals for healthy, glowing skin',
  },
  {
    label: 'Lip Care',
    filter: 'lip' as const,
    img: lipImg,
    desc: 'Pure, healing care for soft and healthy lips',
  },
  {
    label: 'Makeup',
    filter: 'makeup' as const,
    img: makeupImg,
    desc: 'Enhance your natural beauty with clean formulations',
  },
];

const PROMISES = [
  {
    Icon: FlaskConical,
    title: 'Science-Backed Active Ingredients',
    desc: 'Bodilicious products are formulated with proven actives like COENZYME Q10+PDRN, Retinol, Exosomes, Ceramides, Peptides, Niacinamide, Salicylic, and Azelaic acid to effectively target real concerns such as acne, pigmentation, tan, and dryness.',
  },
  {
    Icon: Leaf,
    title: 'Nature + Technology Formulations',
    desc: 'We combine powerful botanical extracts like Aloe Vera, Bhringraj, Hibiscus and Ashwagandha with modern skincare science to deliver products that are both effective and gentle.',
  },
  {
    Icon: Sparkles,
    title: 'Complete Care for Skin, Hair & Beauty',
    desc: 'From skincare and haircare to lip care and makeup, Bodilicious offers a complete range of products designed to help you look healthy, radiant and confident every day.',
  },
];

const AMAZON_REVIEWS = [
  {
    rating: 5,
    comment: "I like natural bodilicious products ...truly worthy ........i always load my supplies ...skin, and hair- shampoo and conditioner tooo!!! its best value I would have to say",
    user: "Ravi",
    productName: "Bodilicious Liquid Sunscreen",
    createdAt: "29 July 2024",
    isVerified: true,
  },
  {
    rating: 5,
    comment: "Amazing product by Bodilicious. My hair fall got controlled and mild shampoo but leathers less. I strongly suggest this product to all who have hair fall issues and dryness",
    user: "PREMKUMAR K.",
    productName: "Bodilicious Hair Strengthening Milk Protein Shampoo",
    createdAt: "16 September 2021",
    isVerified: true,
  },
  {
    rating: 5,
    comment: "It controls oil without drying out my face. Finally found a staple for my routine.",
    user: "Neha Sharma",
    productName: "Bodilicious Salicylic Acid Serum",
    createdAt: "12 May 2024",
  },
];

export default function HomePage() {
  const { setShopFilter, products, isLoading, error, storeSettings } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const fadeUp = getAccessibleVariant(fadeUpVariant, !!shouldReduceMotion);
  const stagger = getAccessibleVariant(staggerContainerVariant, !!shouldReduceMotion);

  useSEO({
    title: 'Bodilicious — Premium Herbal Skincare & Haircare',
    description:
      'Shop dermatologically tested herbal skincare and haircare made with science-backed actives like Niacinamide, Retinol & Hyaluronic Acid. Free shipping on orders over ₹1500.',
    canonical: '/',
  });

  // Splash screen state
  const hasSeenSplash = sessionStorage.getItem('splashShown');
  const [showSplash, setShowSplash] = useState(!hasSeenSplash);


  // Review tab state: 'website' | 'amazon'
  const [reviewTab, setReviewTab] = useState<'website' | 'amazon'>('website');

  // Handle splash screen dismissal
  const dismissSplash = useCallback(() => {
    setShowSplash(false);
    sessionStorage.setItem('splashShown', 'true');
    window.dispatchEvent(new Event('splashDismissed'));
  }, []);

  // Tie splash duration to actual loading state and handle errors
  useEffect(() => {
    if (!showSplash) return;

    if (!isLoading) {

      dismissSplash();
    }
  }, [isLoading, error, showSplash, dismissSplash]);

  // Keyboard accessibility: Escape to dismiss
  useEffect(() => {
    if (!showSplash) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissSplash();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSplash, dismissSplash]);

  // 35-second hard cap fallback
  useEffect(() => {
    if (!showSplash) return;

    const fallback = setTimeout(() => {

      dismissSplash();
    }, 35000);

    return () => clearTimeout(fallback);
  }, [showSplash, dismissSplash]);

  useEffect(() => {
    if (location.hash === '#faq') {
      const el = document.getElementById('faq');
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 300);
      }
    }
  }, [location]);

  const handleShop = useCallback((filter: 'all' | 'skin' | 'hair' | 'body' | 'lip' | 'makeup' | 'other') => {
    setShopFilter(filter);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (filter === 'all') {
      navigate('/shop');
    } else {
      navigate(`/shop?category=${filter}`);
    }
  }, [navigate, setShopFilter]);

  // Best sellers: admin-curated via settings, or keyword fallback
  const bestSellers = useMemo(() => {
    if (!products || products.length === 0) return [];

    // If admin has curated a best sellers list, use it (preserving order)
    if (storeSettings.bestSellerPids && storeSettings.bestSellerPids.length > 0) {
      const pinned = storeSettings.bestSellerPids
        .map(pid => products.find(p => p.pid === pid))
        .filter((p): p is NonNullable<typeof p> => !!p);
      if (pinned.length > 0) return pinned;
    }

    // Keyword-based fallback (original logic)
    const targets = [
      'coenzyme q10',
      'glow boost',
      'physical sunscreen',
      'kojic glycolic',
      'hydrating sunscreen spray',
      'peptide ceramide'
    ];

    const selected = targets.map(target => {
      const keywords = target.split(' ');
      return products.find(p => {
        if (!p || !p.name) return false;
        const name = p.name.toLowerCase();
        return name.includes(target) || keywords.every(kw => name.includes(kw));
      });
    }).filter((p): p is NonNullable<typeof p> => !!p);

    const uniqueSelected = Array.from(new Set(selected));
    if (uniqueSelected.length === 0) return products.filter((_, i) => [0, 1, 2, 4].includes(i));
    return uniqueSelected;
  }, [products, storeSettings.bestSellerPids]);

  // New arrivals: sorted by createdAt desc, guarded against missing/invalid dates, max 6
  const newArrivals = useMemo(() =>
    [...products]
      .filter(p => !!p.createdAt)
      .sort((a, b) => {
        const aTime = new Date(a.createdAt!).getTime() || 0;
        const bTime = new Date(b.createdAt!).getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, 6),
    [products]
  );

  // Website reviews: pulled from product review data
  const websiteReviews = useMemo(() =>
    products
      .flatMap(p => p.reviews.map(r => ({ ...r, productName: p.name })))
      .slice(0, 3),
    [products]
  );

  // Only show the standard loader if there is an error but the splash wasn't shown
  // Or if it's currently loading, but we decided NOT to show the splash (e.g. reload and splash has already been seen)
  if (!showSplash && isLoading && !hasSeenSplash) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-dark-red animate-spin mb-4" />
        <p className="text-dark-red font-sans text-sm uppercase tracking-widest">Loading Bodilicious...</p>
      </div>
    );
  }

  return (
    <div className={`bg-white ${showSplash ? 'pointer-events-none' : ''}`}>
      {/* FULL-SCREEN SPLASH OVERLAY */}
      <AnimatePresence>
        {showSplash && (
          <m.div
            role="status"
            aria-label="Loading, please wait"
            onClick={dismissSplash}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-[#fdf9f0] via-[#f7f3ea] to-[#f4ebe1] flex flex-col items-center justify-center pointer-events-auto cursor-pointer overflow-hidden"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.8, ease: easings.standard } }}
          >
            {/* Decorative background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vmin] h-[80vmin] bg-ruby-red/5 blur-[120px] rounded-full mix-blend-multiply" />
              <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[60vmin] h-[60vmin] bg-indian-red/5 blur-[100px] rounded-full mix-blend-multiply" />
            </div>

            <div className="relative flex flex-col items-center pointer-events-none z-10 w-full max-w-lg px-6">
              <m.img
                src="/logo.webp"
                alt="Bodilicious Logo"
                className="w-56 md:w-72 max-w-full h-auto object-contain pointer-events-none mb-10 drop-shadow-sm"
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                {...({ fetchpriority: 'high' } as any)}
              />

              <m.div 
                className="flex flex-col items-center w-full"
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                {/* Custom glowing loading bar */}
                <div className="w-full max-w-[200px] h-[3px] bg-dark-red/10 rounded-full overflow-hidden mb-8 relative">
                  <m.div 
                    className="absolute top-0 left-0 h-full bg-dark-red rounded-full w-full"
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  />
                </div>
                
                <p className="text-sm md:text-base font-sans tracking-[0.25em] uppercase text-dark-red/80 font-medium text-center">
                  Warming up the server...
                </p>
                <p className="text-xs md:text-sm font-sans tracking-widest text-grey-beige mt-5 text-center px-4">
                  Click anywhere or press Esc to dismiss
                </p>
              </m.div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!showSplash && (
          <m.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: easings.standard }}
          >


            {/* HERO CAROUSEL */}
            <HeroCarousel />


      {/* BEST SELLERS */}
      <section className="py-20 bg-white overflow-hidden">
        <m.div
          className="max-w-7xl mx-auto px-6"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <m.div variants={fadeUp}>
              <p className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-2">
                Discover
              </p>
              <h2 className="font-serif text-dark-red text-3xl md:text-4xl">Best Sellers</h2>
            </m.div>

            <m.button
              variants={fadeUp}
              onClick={() => handleShop('all')}
              className="flex items-center gap-1 mt-4 md:mt-0 text-xs font-sans tracking-widest uppercase text-grey-beige hover:text-ruby-red transition-colors"
            >
              View All <ChevronRight size={14} />
            </m.button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {bestSellers.map(product => (
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
              <m.div variants={fadeUp}>
                <p className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-2">
                  Just Landed
                </p>
                <h2 className="font-serif text-dark-red text-3xl md:text-4xl">New Arrivals</h2>
              </m.div>

              <m.button
                variants={fadeUp}
                onClick={() => handleShop('all')}
                className="flex items-center gap-1 mt-4 md:mt-0 text-xs font-sans tracking-widest uppercase text-grey-beige hover:text-ruby-red transition-colors"
              >
                View All <ChevronRight size={14} />
              </m.button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {newArrivals.map(product => (
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
            <p className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-2">
              Shop by
            </p>
            <h2 className="font-serif text-dark-red text-3xl md:text-4xl">Category</h2>
          </m.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SHOP_CATEGORIES.map(cat => (
              <m.button
                key={cat.filter}
                variants={fadeUp}
                onClick={() => handleShop(cat.filter)}
                className="group relative overflow-hidden aspect-[4/5] text-left"
              >
                <img
                  loading="lazy"
                  decoding="async"
                  src={cat.img}
                  alt={cat.label}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-red/80 via-dark-red/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h3 className="font-serif text-silk text-2xl mb-1">{cat.label}</h3>
                  <p className="text-silk/70 text-xs font-sans">{cat.desc}</p>
                  <div className="flex items-center gap-1 mt-3 text-indian-red text-xs font-sans tracking-widest uppercase">
                    Shop Now <ChevronRight size={12} />
                  </div>
                </div>
              </m.button>
            ))}
          </div>
        </m.div>
      </section>

      <VideoSnippets />

      {/* WHY BODILICIOUS */}
      <section className="py-20 bg-dark-red text-silk overflow-hidden">
        <m.div
          className="max-w-7xl mx-auto px-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          <m.div variants={fadeUp} className="text-center mb-14">
            <p className="text-[10px] font-sans tracking-[0.3em] uppercase text-indian-red mb-2">
              Our Promise
            </p>
            <h2 className="font-serif text-3xl md:text-4xl">Why Bodilicious?</h2>
          </m.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {PROMISES.map(({ Icon, title, desc }) => (
              <m.div key={title} variants={fadeUp} className="text-center">
                <div className="w-14 h-14 rounded-full bg-ruby-red/20 border border-ruby-red/30 flex items-center justify-center mx-auto mb-6">
                  <Icon size={22} className="text-indian-red" />
                </div>
                <h3 className="font-serif text-xl mb-3">{title}</h3>
                <p className="text-silk/60 font-sans text-sm leading-relaxed">{desc}</p>
              </m.div>
            ))}
          </div>
        </m.div>
      </section>

      {/* REVIEWS — single tabbed section replacing two separate blocks */}
      <section className="py-20 bg-silk-light overflow-hidden">
        <m.div
          className="max-w-7xl mx-auto px-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
        >
          <m.div variants={fadeUp} className="text-center mb-10">
            <p className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-2">
              Real Results
            </p>
            <h2 className="font-serif text-dark-red text-3xl md:text-4xl">What Our Customers Say</h2>
          </m.div>

          {/* Tab switcher */}
          <m.div variants={fadeUp} className="flex justify-center mb-10">
            <div className="inline-flex border border-silk-dark/30 rounded-full p-1 bg-white shadow-sm">
              <button
                onClick={() => setReviewTab('website')}
                className={`px-5 py-2 rounded-full text-xs font-sans tracking-widest uppercase transition-all duration-200 ${
                  reviewTab === 'website'
                    ? 'bg-dark-red text-silk shadow-sm'
                    : 'text-grey-beige hover:text-dark-red'
                }`}
              >
                Customer Reviews
              </button>
              <button
                onClick={() => setReviewTab('amazon')}
                className={`px-5 py-2 rounded-full text-xs font-sans tracking-widest uppercase transition-all duration-200 ${
                  reviewTab === 'amazon'
                    ? 'bg-dark-red text-silk shadow-sm'
                    : 'text-grey-beige hover:text-dark-red'
                }`}
              >
                From Our Customers
              </button>
            </div>
          </m.div>

          {/* Tab content — conditionally rendered to avoid mounting both sets of cards */}
          {reviewTab === 'website' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {websiteReviews.map((review, i) => (
                <m.div key={i} variants={fadeUp} className="bg-white p-7 border border-silk/30 hover:border-ruby-red/20 transition-all shadow-sm">
                  <StarRating rating={review.rating} size={14} />
                  <p className="font-sans text-dark-red/80 text-sm leading-relaxed mt-4 mb-6 italic">
                    "{review.comment}"
                  </p>
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
                      {new Date((review as any).createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </m.div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {AMAZON_REVIEWS.map((review, i) => (
                <m.div key={i} variants={fadeUp} className="bg-white p-7 border border-silk/30 hover:shadow-sm transition-all">
                  <StarRating rating={review.rating} size={14} />
                  <p className="font-sans text-dark-red/80 text-sm leading-relaxed mt-4 mb-6 italic">
                    "{review.comment}"
                  </p>
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
                        <span className="flex items-center gap-0.5 px-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[7px] font-bold uppercase tracking-tighter">
                          Amazon
                        </span>
                      </div>
                      <p className="text-[10px] font-sans text-grey-beige mt-0.5 leading-none">{review.productName}</p>
                    </div>
                    <p className="text-[10px] font-sans text-grey-beige">{review.createdAt}</p>
                  </div>
                </m.div>
              ))}
            </div>
          )}
        </m.div>
      </section>

      {/* FAQ */}
      <div id="faq" className="max-w-7xl mx-auto w-full px-6 mt-24 pt-12 border-t border-silk/50 pb-8">
        <div className="text-center mb-12">
          <p className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-4">Queries</p>
          <h2 className="font-serif text-3xl lg:text-4xl text-dark-red">Frequently Asked Questions</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {[
            {
              q: 'Can I use multiple serums together?',
              a: 'Some serums can be layered, but certain actives should not be used together. Vitamin C and Hyaluronic Acid can be safely combined, while Retinol with AHA/BHA should be avoided in the same routine. Retinol and Vitamin C are best used in the night and Retinol is used at night. Always introduce one active ingredient at a time.'
            },
            {
              q: 'How long does it take to see results?',
              a: 'Results vary depending on the product and concern. Hydration products may show results within a few days, acne treatments typically take 2–4 weeks, and pigmentation treatments may take 4–8 weeks. Hair growth products usually require several weeks to months for noticeable changes. Consistent use is essential for visible results.'
            },
            {
              q: 'Do I need sunscreen while using active ingredients?',
              a: 'Yes. Many active ingredients such as retinol, AHA, BHA and vitamin C can increase skin sensitivity to sunlight. Always apply sunscreen during the day when using these products.',
            },
            {
              q: 'Are Bodilicious products suitable for all skin types?',
              a: 'Most Bodilicious products are formulated to suit multiple skin types including dry, normal, oily and combination skin. Each product page clearly lists the recommended skin types and any skin types that should avoid the product.',
            },
          ].map((faq, idx) => (
            <div
              key={idx}
              className="bg-white p-6 border border-silk shadow-sm rounded-sm hover:border-ruby-red/50 transition-colors duration-300 flex flex-col"
            >
              <h3 className="font-serif text-lg text-dark-red mb-3">{faq.q}</h3>
              <p className="font-sans text-gray-600 text-[13px] leading-relaxed font-light">{faq.a}</p>
            </div>
          ))}
        </div>
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
          <m.p variants={fadeUp} className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-3">
            Look Good, Feel Good
          </m.p>
          <m.h2 variants={fadeUp} className="font-serif text-dark-red text-3xl md:text-4xl mb-4">
            Start Your Targeted Care Journey
          </m.h2>
          <m.p variants={fadeUp} className="font-sans text-grey-beige text-sm leading-relaxed mb-8">
            Discover skincare and haircare products made to solve real concerns with trusted, handmade,
            dermatologically tested formulations.
          </m.p>
          <m.button
            variants={fadeUp}
            onClick={() => handleShop('all')}
            className="inline-flex items-center gap-2 bg-dark-red text-silk px-10 py-4 font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-colors"
          >
            Shop Now <ArrowRight size={14} />
          </m.button>
        </m.div>
      </section>

      <Footer />
      </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
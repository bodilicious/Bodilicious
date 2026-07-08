
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Heart,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Loader2,
  Star,
  Droplets,
  ShieldCheck,
  Dna,
  Sparkles,
  Leaf,
  FlaskConical,
  Wind,
  Hand,
  SunMoon,
  Truck,
  Activity,
  ChevronDown,
  Zap,
  Moon,
  Layers,
  Flower2,
  Droplet,
  HeartPulse,
  Eye,
  Wand2,
  Gauge,
  RefreshCw,
  CloudSun,
  Pipette,
  Waves,
  CheckCircle2,
  Clock,
  type LucideIcon
} from 'lucide-react';
import { m, useReducedMotion, AnimatePresence } from 'framer-motion';
import { fadeUpVariant, staggerContainerVariant, getAccessibleVariant } from '../utils/motionTokens';
import { useApp } from '../context/AppContext';
import StarRating from '../components/StarRating';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import IngredientTooltip from '../components/IngredientTooltip';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { getIngredientData } from '../data/ingredientMeta';
import { useSEO } from '../hooks/useSEO';
import { usePostHog } from 'posthog-js/react';
import { useCurrency } from '../hooks/useCurrency';

const AccordionItem = ({
  title,
  content,
  isOpen,
  onClick
}: {
  title: string;
  content: React.ReactNode;
  isOpen: boolean;
  onClick: () => void;
}) => (
  <div className="border-b border-silk/60 text-dark-red">
    <button
      onClick={onClick}
      className="w-full flex justify-between items-center py-5 font-sans text-[11px] sm:text-sm tracking-[0.18em] uppercase hover:text-ruby-red transition-colors text-left"
    >
      <span>{title}</span>
      <ChevronDown
        size={16}
        className={`shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
      />
    </button>

    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="pb-5 font-sans text-sm text-dark-red/80 leading-relaxed">
            {content}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  </div>
);

export default function ProductPage() {
  const { pid } = useParams<{ pid: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const posthog = usePostHog();

  const {
    selectedProductPid: contextPid,
    addToCart,
    toggleWishlist,
    isInWishlist,
    navigateTo,
    authStatus,
    getAuthHeaders,
    storeSettings,
  } = useApp();

  const { formatPrice, userCurrency } = useCurrency();

  const productId = pid || searchParams.get('id') || contextPid;

  // Enforce canonical URL if we are using fallback IDs
  useEffect(() => {
    if (productId && !pid) {
      navigate(`/product/${productId}`, { replace: true });
    }
  }, [productId, pid, navigate]);

  const shouldReduceMotion = useReducedMotion();
  const fadeUp = getAccessibleVariant(fadeUpVariant, !!shouldReduceMotion);
  const stagger = getAccessibleVariant(staggerContainerVariant, !!shouldReduceMotion);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── SEO: update meta tags + inject Product JSON-LD when loaded ──
  const productDesc = product?.description
    ? product.description.slice(0, 155)
    : 'Premium herbal skincare and haircare from Bodilicious. Dermatologically tested, science-backed formulas.';

  const productSchema = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        image: product.images[0] || '',
        description: product.description || '',
        brand: { '@type': 'Brand', name: 'Bodilicious' },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'INR',
          price: String(product.price),
          availability:
            product.stock > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          url: `https://www.bodilicious.in/product/${product.pid}`,
          seller: { '@type': 'Organization', name: 'Bodilicious' },
        },
        ...(product.rating && product.ratingCount && product.ratingCount > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: String(product.rating.toFixed(1)),
                reviewCount: String(product.ratingCount),
                bestRating: '5',
                worstRating: '1',
              },
            }
          : {}),
      }
    : null;

  const productKeywords = product
    ? [
        product.name,
        product.category,
        product.sub_category,
        product.product_type,
        ...(product.concerns_targeted || []),
        'Bodilicious',
        'herbal',
        'dermatologically tested'
      ].filter(Boolean).join(', ')
    : undefined;

  const breadcrumbSchema = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://www.bodilicious.in/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Shop',
            item: 'https://www.bodilicious.in/shop',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: product.name,
            item: `https://www.bodilicious.in/product/${product.pid}`,
          },
        ],
      }
    : null;

  const productJsonLd =
    productSchema && breadcrumbSchema
      ? [productSchema, breadcrumbSchema]
      : productSchema ?? undefined;

  useSEO({
    title: product ? `${product.name} — Bodilicious` : 'Product — Bodilicious',
    description: productDesc,
    keywords: productKeywords,
    canonical: product ? `/product/${product.pid}` : '/shop',
    ogImage: product?.images[0],
    ogImageAlt: product ? `${product.name} by Bodilicious` : undefined,
    jsonLd: productJsonLd,
  });


  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [activeAccordion, setActiveAccordion] = useState<string | null>('details');

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const [zoomStyle, setZoomStyle] = useState({
    display: 'none',
    backgroundPosition: '0% 0%'
  });

  const [showIngredientSidebar, setShowIngredientSidebar] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isRelatedLoading, setIsRelatedLoading] = useState(false);

  const fetchProduct = useCallback(async (isInitial = true) => {
    try {
      if (isInitial) setLoading(true);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/products/${productId}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error('Failed to fetch product');
      }

      setProduct(data.data);
      setError(null);
    } catch {
      setError('Product not found');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (!productId) {
      setError('No product selected');
      setLoading(false);
      return;
    }

    fetchProduct();
  }, [fetchProduct, productId]);


  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (authStatus !== 'authenticated') {
      setReviewFeedback({ type: 'error', msg: 'Please sign in to write a review' });
      return;
    }

    setIsSubmittingReview(true);
    setReviewFeedback(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/products/${product?.pid}/reviews`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit review');

      const successMsg = storeSettings.reviewModerationEnabled 
        ? 'Review submitted and is pending approval.' 
        : 'Review submitted successfully!';
      setReviewFeedback({ type: 'success', msg: successMsg });
      setReviewComment('');
      setReviewRating(5);

      fetchProduct(false);
    } catch (err: any) {
      setReviewFeedback({ type: 'error', msg: err.message });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  useEffect(() => {
    setActiveImage(0);
    setQty(1);
    setActiveAccordion('details');
    setShowIngredientSidebar(false);
    setZoomStyle({ display: 'none', backgroundPosition: '0% 0%' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product?.pid]);

  const inWishlist = product ? isInWishlist(product.pid) : false;

  useEffect(() => {
    if (!product?.category || !product?.pid) return;

    const fetchRelated = async () => {
      setIsRelatedLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/products?category=${product.category}&excludePid=${product.pid}&limit=4`
        );
        const data = await res.json();
        if (data.success) {
          setRelatedProducts(data.data);
        }
      } catch (err) {
        console.error('Error fetching related products:', err);
      } finally {
        setIsRelatedLoading(false);
      }
    };

    fetchRelated();
  }, [product?.category, product?.pid]);

  // ── Product View Tracking ──
  // Fire once per product per session (deduped via sessionStorage)
  const viewTracked = useRef(false);
  useEffect(() => {
    if (!product?.pid || viewTracked.current) return;
    const sessionKey = `pv_${product.pid}`;
    if (sessionStorage.getItem(sessionKey)) return;
    viewTracked.current = true;
    sessionStorage.setItem(sessionKey, '1');

    // Fire and forget — silent failure is intentional
    fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'product_viewed',
        productId: product.pid,
        productName: product.name,
      }),
    }).catch(() => { /* silent */ });

    // 🚀 PostHog Client-Side Tracking
    if (posthog) {
      posthog.capture('Product Viewed', {
        productId: product.pid,
        name: product.name,
        category: product.category,
        price: product.price
      });
    }
  }, [product?.pid]); // pid is the only meaningful dep; viewTracked ref + sessionStorage deduplicate

  const prevImage = useCallback(() => {
    setActiveImage((i) => (i === 0 ? (product?.images.length || 1) - 1 : i - 1));
  }, [product?.images.length]);

  const nextImage = useCallback(() => {
    setActiveImage((i) => (i === (product?.images.length || 1) - 1 ? 0 : i + 1));
  }, [product?.images.length]);

  const handleAddToCart = useCallback(() => {
    if (product) {
      addToCart(product, qty);
    }
  }, [qty, addToCart, product]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Disable hover-zoom on touch devices / smaller screens
    if (window.innerWidth < 1024 || showIngredientSidebar || activeImage !== 0) return;

    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;

    setZoomStyle({
      display: 'block',
      backgroundPosition: `${x}% ${y}%`,
    });
  };

  const handleMouseLeave = () => {
    if (window.innerWidth < 1024) return;
    setZoomStyle({ display: 'none', backgroundPosition: '0% 0%' });
  };

  const handleMobileTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (window.innerWidth >= 1024 || showIngredientSidebar || activeImage !== 0) return;

    if (zoomStyle.display === 'block') {
      setZoomStyle({ display: 'none', backgroundPosition: '0% 0%' });
    } else {
      const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - left) / width) * 100;
      const y = ((e.clientY - top) / height) * 100;

      setZoomStyle({
        display: 'block',
        backgroundPosition: `${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (window.innerWidth >= 1024 || zoomStyle.display !== 'block' || showIngredientSidebar || activeImage !== 0) return;

    const touch = e.touches[0];
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((touch.clientX - left) / width) * 100;
    const y = ((touch.clientY - top) / height) * 100;

    setZoomStyle({
      display: 'block',
      backgroundPosition: `${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`,
    });
  };

  const isZoomed = zoomStyle.display === 'block';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-dark-red mb-4" />
        <p className="text-xs uppercase tracking-widest font-sans text-dark-red">
          Loading Bodilicious...
        </p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center -mt-10 px-6 text-center">
        <p className="font-serif text-3xl text-dark-red mb-5">{error ?? 'Product not found'}</p>
        <button
          onClick={() => navigateTo('shop')}
          className="text-xs uppercase font-sans tracking-widest text-grey-beige hover:text-dark-red transition-colors border-b border-grey-beige hover:border-dark-red pb-1"
        >
          Return to shop
        </button>
      </div>
    );
  }

  const BENEFIT_ICON_MAP: Array<[string, LucideIcon]> = [
    ['hydrat', Droplets], ['moisture', Droplets], ['locks in', Droplets],
    ['plump', Droplets], ['dehydrat', Droplets], ['barrier', ShieldCheck],
    ['protect', ShieldCheck], ['uv', CloudSun], ['sun damage', CloudSun],
    ['spf', CloudSun], ['collagen', Dna], ['peptide', Dna],
    ['fine line', Dna], ['aging', Dna], ['elasticity', Dna],
    ['firm', Dna], ['texture', Sparkles], ['exfoliat', Sparkles],
    ['smooth', Sparkles], ['brightens', Sparkles], ['glow', Sparkles],
    ['radiance', Sparkles], ['complexion', Sparkles], ['brighten', Sparkles],
    ['even tone', Wand2], ['dark spot', Wand2], ['pigment', Wand2],
    ['tone', Wand2], ['discolor', Wand2], ['sooth', Leaf],
    ['calm', Leaf], ['inflam', Leaf], ['sensitiv', Leaf],
    ['nourish', Leaf], ['natural', Leaf], ['botanical', Flower2],
    ['acne', Zap], ['pore', Zap], ['blackhead', Zap],
    ['blemish', Zap], ['oil control', Gauge], ['controls oil', Gauge],
    ['controls excess oil', Gauge], ['sebum', Gauge], ['non-greasy', Gauge],
    ['hair fall', HeartPulse], ['breakage', HeartPulse], ['strengthen', Dna],
    ['frizz', Wind], ['scalp', Flower2], ['cleans', RefreshCw],
    ['purif', RefreshCw], ['wash', RefreshCw], ['lip', Droplet],
    ['overnight', Moon], ['repair', Moon], ['rejuvenat', Moon],
    ['under-eye', Eye], ['puffiness', Eye], ['dark circle', Eye],
    ['long last', CheckCircle2], ['coverage', Layers], ['matte finish', Layers],
    ['long lasting', CheckCircle2], ['smudge', CheckCircle2], ['tint', Wand2],
    ['shine', Sparkles], ['adds shine', Sparkles],
  ];

  const getBenefitIcon = (benefit: string): LucideIcon => {
    const lower = benefit.toLowerCase();
    for (const [kw, icon] of BENEFIT_ICON_MAP) {
      if (lower.includes(kw)) return icon;
    }
    return Activity;
  };

  const benefitsMap = (product.benefits ?? []).slice(0, 6).map((b) => ({
    label: b.charAt(0).toUpperCase() + b.slice(1),
    icon: getBenefitIcon(b),
  }));

  const rawIngredientsList = [
    ...(product.ingredients?.key_actives ?? []),
    ...(product.ingredients?.botanical_extracts ?? []),
    ...(product.ingredients?.others ?? []),
  ].filter(Boolean);

  const uniqueNormalizedIngredients = Array.from(
    new Map(rawIngredientsList.map((name) => [name.trim().toLowerCase(), name])).values()
  );

  const ingredientsHighlights = uniqueNormalizedIngredients.map((name) => {
    const data = getIngredientData(name);
    return {
      title: data.name || name,
      desc:
        data.description ||
        'A key active that works synergistically for visible, effective results.',
      imagePath: data.imagePath || '/ingredients/fallback.webp',
      altText: data.altText || `${name} ingredient`,
    };
  });

  const STEP_TEMPLATES: Record<string, { title: string; icon: LucideIcon; desc: string }[]> = {
    cleanser: [
      { title: 'Dampen Skin', icon: Droplets, desc: 'Wet face or body with lukewarm water.' },
      { title: 'Apply & Lather', icon: Hand, desc: 'Work the cleanser into a gentle lather.' },
      { title: 'Massage In', icon: RefreshCw, desc: 'Massage in circular motions for 30–60 seconds.' },
      { title: 'Rinse Well', icon: Waves, desc: 'Rinse thoroughly and pat dry with a soft towel.' },
    ],
    serum: [
      { title: 'Cleanse First', icon: Wind, desc: 'Start with a freshly cleansed, dry face.' },
      { title: 'Dispense', icon: Pipette, desc: 'Apply 2–3 drops onto your fingertips.' },
      { title: 'Press & Pat', icon: Hand, desc: 'Gently press and pat into skin; do not rub.' },
      { title: 'Layer Up', icon: Layers, desc: 'Follow with moisturiser to seal in actives.' },
    ],
    moisturizer: [
      { title: 'Cleanse Face', icon: Wind, desc: 'Start with a fresh, clean canvas.' },
      { title: 'Apply Product', icon: Droplets, desc: 'Take a pea-sized amount; warm between fingertips.' },
      { title: 'Massage Gently', icon: Hand, desc: 'Use upward circular motions for absorption.' },
      { title: 'Day & Night', icon: SunMoon, desc: 'Use daily morning and evening for best results.' },
    ],
    sunscreen: [
      { title: 'After Skincare', icon: Layers, desc: 'Apply as the last step in your morning routine.' },
      { title: 'Generous Layer', icon: Droplets, desc: 'Use two finger-lengths for the face.' },
      { title: 'Blend In', icon: Hand, desc: 'Spread evenly and allow to settle for 2 minutes.' },
      { title: 'Reapply', icon: RefreshCw, desc: 'Reapply every 2–3 hours when outdoors.' },
    ],
    'eye care': [
      { title: 'Final Step', icon: Layers, desc: 'Use after all other serums and creams.' },
      { title: 'Small Amount', icon: Pipette, desc: 'Take a grain-of-rice-sized amount.' },
      { title: 'Ring Finger', icon: Hand, desc: 'Gently tap around the orbital bone; never drag.' },
      { title: 'Daily Ritual', icon: Clock, desc: 'Consistent daily use delivers the best results.' },
    ],
    shampoo: [
      { title: 'Wet Hair', icon: Waves, desc: 'Thoroughly wet your hair before applying.' },
      { title: 'Apply', icon: Droplets, desc: 'Dispense and distribute through wet hair.' },
      { title: 'Massage Scalp', icon: Hand, desc: 'Work into the scalp with gentle circular motions.' },
      { title: 'Rinse Well', icon: RefreshCw, desc: 'Rinse thoroughly and follow with conditioner.' },
    ],
    'hair oil': [
      { title: 'Section Hair', icon: Layers, desc: 'Part hair into sections for even application.' },
      { title: 'Apply to Scalp', icon: Pipette, desc: 'Massage oil directly onto scalp and roots.' },
      { title: 'Work Through', icon: Hand, desc: 'Work remaining oil through the hair lengths.' },
      { title: 'Leave & Wash', icon: Clock, desc: 'Leave for 30–60 mins then shampoo out.' },
    ],
    'hair styling': [
      { title: 'Damp or Dry', icon: Wind, desc: 'Can be used on damp or dry hair.' },
      { title: 'Small Amount', icon: Pipette, desc: 'Apply a pea-sized amount to your palm.' },
      { title: 'Mid to Ends', icon: Hand, desc: 'Smooth through mid-lengths and ends; avoid roots.' },
      { title: 'Style', icon: Sparkles, desc: 'Style as usual for frizz-free, glossy results.' },
    ],
    'lip care': [
      { title: 'Clean Lips', icon: Wind, desc: 'Start with clean, dry lips.' },
      { title: 'Apply Product', icon: Pipette, desc: 'Glide on an even layer of the product.' },
      { title: 'Press Lips', icon: Hand, desc: 'Press lips together for full coverage.' },
      { title: 'Reapply', icon: RefreshCw, desc: 'Reapply as needed throughout the day.' },
    ],
    makeup: [
      { title: 'Prep Skin', icon: Layers, desc: 'Apply primer or moisturiser as a base.' },
      { title: 'Apply Evenly', icon: Pipette, desc: 'Use a brush or sponge to apply the product.' },
      { title: 'Blend Well', icon: Hand, desc: 'Blend outward for a seamless, natural finish.' },
      { title: 'Set & Go', icon: Sparkles, desc: 'Set with powder if needed and enjoy all day.' },
    ],
    treatment: [
      { title: 'Cleanse First', icon: Wind, desc: 'Apply to freshly cleansed skin.' },
      { title: 'Spread Evenly', icon: Hand, desc: 'Apply an even layer to the desired area.' },
      { title: 'Leave On', icon: Clock, desc: 'Allow to absorb fully — no need to rinse.' },
      { title: 'Daily Use', icon: SunMoon, desc: 'Use consistently morning and night for results.' },
    ],
  };

  const routineStep = (product.usage?.routine_step ?? '').toLowerCase();
  const howToUseSteps = STEP_TEMPLATES[routineStep] ?? [
    { title: 'Cleanse First', icon: Wind, desc: 'Begin with clean, dry skin or hair.' },
    { title: 'Apply Product', icon: Droplets, desc: 'Dispense the recommended amount.' },
    { title: 'Massage In', icon: Hand, desc: 'Work in using gentle, circular motions.' },
    { title: 'Daily Ritual', icon: SunMoon, desc: 'Use consistently for the best results.' },
  ];

  const toggleAccordion = (id: string) => {
    setActiveAccordion((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-[#FDFBF7] min-h-screen text-dark-red">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 pt-24 sm:pt-28 lg:pt-32 pb-16 sm:pb-20">
        <button
          onClick={() => navigateTo('shop')}
          className="group flex items-center gap-1.5 text-[10px] sm:text-xs font-sans tracking-[0.18em] uppercase text-grey-beige hover:text-dark-red transition-colors mb-8 sm:mb-10"
        >
          <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Back to shop
        </button>

        <m.div
          className="grid grid-cols-1 xl:grid-cols-[minmax(0,620px)_minmax(0,560px)] gap-10 lg:gap-14 xl:gap-20 items-start"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          {/* Images Section */}
          <m.div variants={fadeUp} className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-start">
            {product.images.length > 1 && (
              <div className="order-2 lg:order-1 w-full lg:w-20 xl:w-24 shrink-0">
                <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto scrollbar-hide pb-1 lg:pb-0">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImage(idx)}
                      className={`relative w-16 h-16 sm:w-20 sm:h-20 lg:w-full lg:h-auto lg:aspect-[9/16] shrink-0 overflow-hidden bg-white/70 border rounded-sm ${
                        activeImage === idx
                          ? 'border-dark-red'
                          : 'border-silk/60 hover:border-silk-dark'
                      } transition-colors duration-200`}
                    >
                      <img
                        loading="lazy"
                        src={img}
                        alt={`${product.name} thumbnail ${idx + 1}`}
                        className="w-full h-full object-contain mix-blend-multiply p-1.5"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="order-1 lg:order-2 w-full max-w-[760px] mx-auto">
              <div
                className={`relative w-full aspect-[9/16] bg-white/60 overflow-hidden flex items-center justify-center ${activeImage === 0 ? 'cursor-pointer lg:cursor-crosshair' : ''} shadow-sm border border-silk/40 rounded-sm ${isZoomed ? 'touch-none' : ''}`}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleMobileTap}
                onTouchMove={handleTouchMove}
              >
                <img
                  src={product.images[activeImage]}
                  alt={product.name}
                  loading="eager"
                  decoding="async"
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    !showIngredientSidebar && activeImage === 0 && isZoomed ? 'opacity-0' : 'opacity-100'
                  }`}
                />

                {activeImage === 0 && (
                  <div
                    className={`absolute inset-0 bg-no-repeat pointer-events-none transition-opacity duration-300 z-10 ${
                      showIngredientSidebar || !isZoomed ? 'opacity-0' : 'opacity-100'
                    }`}
                    style={{
                      backgroundImage: `url("${product.images[activeImage]}")`,
                      backgroundSize: '180%',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: zoomStyle.backgroundPosition,
                      display: zoomStyle.display,
                    }}
                  />
                )}

                {ingredientsHighlights.length > 0 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowIngredientSidebar(!showIngredientSidebar);
                      }}
                      className={`absolute top-4 left-4 z-40 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
                        showIngredientSidebar
                          ? 'bg-ruby-red text-white'
                          : 'bg-white/85 text-dark-red hover:bg-white'
                      } backdrop-blur-sm focus:outline-none`}
                      aria-label="Toggle Ingredient Highlights"
                    >
                      <FlaskConical size={18} />
                    </button>

                    <div
                      className={`absolute top-0 left-0 bottom-0 w-[54%] sm:w-[45%] bg-black/60 backdrop-blur-sm pointer-events-none z-20 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        showIngredientSidebar ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'
                      }`}
                    >
                      <div className="h-full flex flex-col justify-end p-4 sm:p-5 lg:p-6">
                        <p className="text-[9px] md:text-[10px] font-sans tracking-[0.3em] uppercase text-[#FDFBF7]/80 mb-4 font-semibold">
                          Key Ingredients
                        </p>

                        <div className="flex flex-col gap-4 sm:gap-5">
                          {ingredientsHighlights.slice(0, 3).map((ing, i) => (
                            <div key={i} className="flex flex-col">
                              <span className="font-sans font-semibold text-[11px] md:text-xs text-[#FDFBF7] pb-1 tracking-wide line-clamp-1">
                                {ing.title}
                              </span>
                              <span className="font-sans text-[10px] md:text-xs text-white/75 line-clamp-2 leading-relaxed font-light">
                                {ing.desc}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {product.images.length > 1 && (
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-3 sm:px-4 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 z-30 pointer-events-none">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        prevImage();
                      }}
                      className="w-9 h-9 sm:w-10 sm:h-10 bg-white/90 hover:bg-white text-dark-red flex items-center justify-center rounded-full shadow-sm backdrop-blur-sm transition-all hover:scale-105 pointer-events-auto"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        nextImage();
                      }}
                      className="w-9 h-9 sm:w-10 sm:h-10 bg-white/90 hover:bg-white text-dark-red flex items-center justify-center rounded-full shadow-sm backdrop-blur-sm transition-all hover:scale-105 pointer-events-auto"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </m.div>

          {/* Product Info */}
          <m.div variants={fadeUp} className="w-full max-w-2xl xl:max-w-xl xl:pt-4">
            <p className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-3">
              {product.category === 'skin'
                ? 'Skin Care'
                : product.category === 'hair'
                  ? 'Hair Care'
                  : 'Body Care'}
            </p>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-dark-red mb-4 leading-[1.05]">
              {product.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-6">
              <StarRating rating={product.rating ?? 0} size={15} />
              <span className="text-xs font-sans text-grey-beige">
                ({product.ratingCount ?? 0} reviews)
              </span>
            </div>

            <p className="text-2xl sm:text-[30px] font-sans text-dark-red mb-5 sm:mb-6">
              {formatPrice(product.price)}
              {userCurrency === 'USD' && <span className="text-sm ml-1 opacity-60">*</span>}
            </p>

            <p className="text-dark-red/80 font-sans text-sm sm:text-base leading-7 mb-7 sm:mb-8 max-w-2xl">
              {product.description}
            </p>

            {product.skin_type_suitable && product.skin_type_suitable.length > 0 && (
              <div className="mb-8">
                <p className="text-[10px] font-sans tracking-[0.2em] uppercase text-grey-beige mb-3">
                  Suitable For
                </p>

                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    new Set(product.skin_type_suitable.map((s) => s.trim().toLowerCase()))
                  ).map((skinType, i) => {
                    let Icon = CheckCircle2;
                    const label = skinType
                      .split(' ')
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(' ');

                    if (skinType.includes('dry')) Icon = Droplet;
                    else if (skinType.includes('oily')) Icon = Sparkles;
                    else if (skinType.includes('sensitive')) Icon = ShieldCheck;
                    else if (skinType.includes('combination')) Icon = Layers;
                    else if (skinType.includes('normal')) Icon = CheckCircle2;
                    else if (skinType.includes('all')) Icon = Heart;

                    return (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-silk-light/50 border border-silk/60 rounded-full cursor-default hover:border-ruby-red/30 transition-colors"
                      >
                        <Icon size={14} className="text-ruby-red/80" strokeWidth={1.5} />
                        <span className="text-xs font-sans text-dark-red">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {product.stock > 0 ? (
              <div className="flex flex-col sm:flex-row sm:flex-wrap xl:flex-nowrap gap-3 sm:gap-4 mb-4 w-full">
                <div className="flex border border-silk/80 h-14 w-full sm:w-36 items-center justify-between px-4 bg-white/60 shadow-sm rounded-sm">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="text-dark-red/60 hover:text-dark-red transition-colors p-2 -ml-2"
                  >
                    <Minus size={14} />
                  </button>

                  <span className="font-sans text-sm font-semibold text-dark-red">{qty}</span>

                  <button
                    onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                    className="text-dark-red/60 hover:text-dark-red transition-colors p-2 -mr-2"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  className="flex-1 min-h-[56px] w-full sm:w-auto bg-ruby-red text-white px-6 sm:px-8 font-sans text-[11px] sm:text-xs tracking-[0.22em] uppercase hover:bg-dark-red transition-colors flex items-center justify-center gap-3 shadow-md border border-ruby-red rounded-sm"
                >
                  <ShoppingBag size={16} />
                  Add to Bag
                </button>

                <button
                  onClick={() => toggleWishlist(product)}
                  className={`h-14 w-full sm:w-14 border flex items-center justify-center transition-all shadow-sm rounded-sm ${
                    inWishlist
                      ? 'border-ruby-red bg-ruby-red text-white'
                      : 'border-silk/80 text-dark-red bg-white/60 hover:bg-white hover:border-dark-red'
                  }`}
                >
                  <Heart size={18} fill={inWishlist ? 'currentColor' : 'none'} />
                </button>
              </div>
            ) : (
              <div className="h-14 bg-silk/30 flex items-center justify-center text-dark-red/60 font-sans text-xs tracking-widest uppercase mb-4 rounded-sm">
                Out of Stock
              </div>
            )}

            <p className="text-[10px] font-sans text-grey-beige uppercase tracking-wider mb-8 sm:mb-10">
              {product.stock > 0 && product.stock <= 5
                ? `Only ${product.stock} left in stock`
                : product.stock > 5
                  ? 'In stock and ready to ship'
                  : 'We are restocking soon'}
            </p>

            {/* Trust Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-6 py-8 border-y border-silk/60 mb-10 bg-silk-light/20 rounded-sm px-4">
              {[
                { label: '7-Day Returns', icon: RefreshCw, desc: 'Hassle-free' },
                { label: 'Secure SSL', icon: ShieldCheck, desc: '100% Secure' },
                { label: 'Delivery SLA', icon: Truck, desc: 'Fast Shipping' },
                { label: 'Verified Science', icon: FlaskConical, desc: 'Derm Tested' },
              ].map((badge, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-1.5 group">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:bg-ruby-red group-hover:text-white transition-all duration-300">
                    <badge.icon size={18} strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-wider text-dark-red">
                      {badge.label}
                    </span>
                    <span className="text-[9px] font-sans text-grey-beige uppercase tracking-tight">
                      {badge.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Key Actives Highlight */}
            {ingredientsHighlights.length > 0 && (
              <div className="mb-10">
                <p className="text-[10px] font-sans tracking-[0.2em] uppercase text-grey-beige mb-5">
                  Key Actives
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ingredientsHighlights.slice(0, 2).map((ing, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-white/60 border border-silk/30 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-silk-light/30 shrink-0 border border-silk/20">
                        <img 
                          src={ing.imagePath} 
                          alt={ing.title} 
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover mix-blend-multiply group-hover:scale-110 transition-transform duration-500" 
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <IngredientTooltip name={ing.title} className="text-xs font-bold text-dark-red" />
                        <span className="text-[10px] text-grey-beige line-clamp-1 italic mt-0.5">{ing.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <AccordionItem
                title="Product Details"
                isOpen={activeAccordion === 'details'}
                onClick={() => toggleAccordion('details')}
                content={
                  <div>
                    <p className="mb-4">
                      Experience the ultimate luxury with our meticulously crafted formula.
                      Designed to deeply nourish and restore your skin&apos;s natural radiance,
                      {` ${product.name} `}
                      targets your most pressing skincare concerns with gentle, effective
                      botanical extracts and cutting-edge clinical ingredients.
                    </p>

                    <ul className="list-disc pl-4 space-y-2">
                      {(product.benefits ?? []).map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                }
              />

              <AccordionItem
                title="Full Ingredients"
                isOpen={activeAccordion === 'ingredients'}
                onClick={() => toggleAccordion('ingredients')}
                content={
                  <div className="flex flex-wrap gap-2">
                    {product.ingredients &&
                      Object.values(product.ingredients)
                        .flat()
                        .filter(Boolean)
                        .map((ing, idx) => (
                          <span
                            key={idx}
                            className="after:content-[','] last:after:content-[''] mr-1"
                          >
                            <IngredientTooltip name={String(ing)} className="text-sm" />
                          </span>
                        ))}
                  </div>
                }
              />

              <AccordionItem
                title="Shipping & Returns"
                isOpen={activeAccordion === 'shipping'}
                onClick={() => toggleAccordion('shipping')}
                content="Complimentary shipping on all orders over ₹1,500. We gladly accept returns of unused or gently used items within 7 days of purchase. Bodilicious is dedicated to your complete satisfaction."
              />
            </div>
          </m.div>
        </m.div>

        {/* Key Benefits Grid */}
        {benefitsMap.length > 0 && (
          <m.div
            className="mt-24 sm:mt-28 lg:mt-32 max-w-5xl mx-auto text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            <m.h2 variants={fadeUp} className="font-serif text-3xl md:text-4xl text-dark-red mb-12 sm:mb-16">
              Key Benefits
            </m.h2>

            <div
              className={`grid grid-cols-2 gap-4 sm:gap-6 ${
                benefitsMap.length <= 3
                  ? 'md:grid-cols-3'
                  : benefitsMap.length === 4
                    ? 'md:grid-cols-4'
                    : 'md:grid-cols-5'
              }`}
            >
              {benefitsMap.map((benefit, i) => (
                <m.div
                  key={i}
                  variants={fadeUp}
                  className="group flex flex-col items-center p-5 sm:p-6 bg-white/40 border border-silk/30 hover:border-ruby-red/30 transition-all shadow-sm hover:shadow-md hover:-translate-y-1"
                >
                  <div className="w-14 h-14 rounded-full bg-silk-light flex items-center justify-center mb-4 group-hover:bg-ruby-red group-hover:text-white transition-colors">
                    <benefit.icon
                      size={24}
                      strokeWidth={1.5}
                      className="group-hover:scale-110 transition-transform"
                    />
                  </div>
                  <p className="font-sans text-[10px] sm:text-xs uppercase tracking-[0.18em] text-dark-red">
                    {benefit.label}
                  </p>
                </m.div>
              ))}
            </div>
          </m.div>
        )}

        {/* Powered by Ingredients */}
        {ingredientsHighlights.length > 0 && (
          <m.div
            className="mt-24 sm:mt-28 lg:mt-32 max-w-6xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            <div className="text-center mb-14 sm:mb-16">
              <p className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-3">
                Science Meets Nature
              </p>
              <m.h2 variants={fadeUp} className="font-serif text-3xl md:text-4xl text-dark-red">
                Powered by Ingredients
              </m.h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
              {ingredientsHighlights.slice(0, 4).map((ing, i) => (
                <m.div
                  key={i}
                  variants={fadeUp}
                  className="bg-white/70 p-6 border border-silk/50 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col items-center text-center rounded-3xl mt-8 group"
                >
                  <div className="w-24 h-24 md:w-28 md:h-28 shrink-0 mb-4 relative -mt-14 rounded-full overflow-hidden bg-[#FDFBF7] shadow-sm border border-silk/30">
                    <img
                      src={ing.imagePath}
                      alt={ing.altText}
                      onError={(e) => {
                        e.currentTarget.src = '/ingredients/fallback.webp';
                      }}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                    />
                  </div>
                  <h3 className="font-serif text-lg md:text-xl mb-2 text-dark-red">{ing.title}</h3>
                  <p className="font-sans text-xs text-dark-red/70 leading-relaxed">{ing.desc}</p>
                </m.div>
              ))}
            </div>
          </m.div>
        )}

        {/* How to Use */}
        <m.div
          className="mt-24 sm:mt-28 lg:mt-32 max-w-6xl mx-auto bg-dark-red text-[#FDFBF7] px-6 py-12 sm:p-12 lg:p-20"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
        >
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="font-serif text-3xl md:text-4xl text-silk">How to Use</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-12 relative">
            <div className="hidden lg:block absolute top-8 left-1/4 right-1/4 h-px bg-silk/20" />

            {howToUseSteps.map((step, i) => (
              <m.div
                key={i}
                variants={fadeUp}
                className="relative z-10 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-[#FDFBF7]/10 flex items-center justify-center mb-6 border border-silk/30 backdrop-blur-sm">
                  <step.icon size={26} className="text-silk" strokeWidth={1.5} />
                </div>
                <h4 className="font-sans text-sm uppercase tracking-[0.18em] text-silk mb-2">
                  {step.title}
                </h4>
                <p className="font-sans text-xs text-silk-dark leading-relaxed max-w-[200px]">
                  {step.desc}
                </p>
              </m.div>
            ))}
          </div>
        </m.div>

        {/* Reviews Section */}
        <m.div
          className="mt-24 sm:mt-28 lg:mt-32 max-w-5xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
        >
          <m.div variants={fadeUp} className="text-center mb-14 sm:mb-16">
            <p className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-3">
              Real Results
            </p>
            <h2 className="font-serif text-dark-red text-3xl md:text-4xl">Customer Reviews</h2>
          </m.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-16 sm:mb-20">
            {product.reviews && product.reviews.length > 0 ? (
              product.reviews.map((review, idx) => (
                <m.div
                  key={idx}
                  variants={fadeUp}
                  className="bg-white/50 p-6 sm:p-8 lg:p-10 border border-silk/30 hover:border-ruby-red/30 transition-colors shadow-sm relative overflow-hidden"
                >
                  <StarRating rating={review.rating} size={14} />

                  <p className="font-sans text-dark-red/80 text-sm leading-relaxed mt-5 mb-8 italic relative z-10">
                    "{review.comment}"
                  </p>

                  <div className="border-t border-silk/60 pt-5 flex items-end justify-between gap-3 relative z-10">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-sans font-semibold text-dark-red">{review.user}</p>
                        {storeSettings.reviewVerifiedBadgeEnabled && review.isVerified && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-100 rounded-full text-[8px] font-bold uppercase tracking-tighter">
                            <CheckCircle2 size={10} strokeWidth={3} />
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-sans text-grey-beige uppercase tracking-widest leading-none">
                        {new Date((review as any).createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </m.div>
              ))
            ) : (
              <m.div
                variants={fadeUp}
                className="col-span-1 md:col-span-2 text-center py-12 bg-white/30 border border-silk/50 border-dashed"
              >
                <p className="text-sm font-sans italic text-dark-red/60">
                  No reviews yet. Be the first to share your thoughts!
                </p>
              </m.div>
            )}
          </div>

          <m.div variants={fadeUp} className="max-w-2xl mx-auto flex flex-col items-center">
            {!showReviewForm && (
              <button
                onClick={() => setShowReviewForm(true)}
                className="bg-white border border-dark-red text-dark-red px-8 py-4 uppercase font-sans text-xs tracking-widest hover:bg-dark-red hover:text-white transition-all shadow-sm hover:shadow-md"
              >
                Write a Review
              </button>
            )}

            <AnimatePresence>
              {showReviewForm && (
                <m.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-full max-w-2xl mx-auto mt-8 bg-white/80 backdrop-blur-md p-8 sm:p-12 border border-ruby-red/20 shadow-lg relative overflow-hidden"
                >
                  {/* Decorative elements */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-ruby-red/5 rounded-bl-full pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-dark-red/5 rounded-tr-full pointer-events-none" />

                  <h3 className="font-serif text-dark-red text-2xl mb-2">Write a Review</h3>
                  {storeSettings.reviewIncentiveEnabled && (
                    <div className="mb-6 bg-ruby-red/10 border border-ruby-red/20 rounded-xl p-3 flex items-start gap-2">
                      <span className="text-ruby-red mt-0.5">⭐</span>
                      <p className="text-xs font-sans text-dark-red">
                        <strong>Review & Save!</strong> Leave a review and get a {storeSettings.reviewIncentiveDiscountPercent}% off coupon on your next order.
                      </p>
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => setShowReviewForm(false)}
                    className="text-grey-beige hover:text-dark-red transition-colors text-xs uppercase tracking-widest font-sans"
                  >
                    Cancel
                  </button>

                  {authStatus === 'authenticated' ? (
                    <form onSubmit={submitReview} className="flex flex-col gap-6 relative z-10">
                      <div>
                        <label className="block text-[10px] font-sans tracking-[0.2em] uppercase text-ruby-red mb-3">
                          Overall Rating
                        </label>

                        <div className="flex items-center gap-2 flex-wrap">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              type="button"
                              key={star}
                              onClick={() => setReviewRating(star)}
                              className={`transition-all duration-300 hover:scale-110 ${
                                reviewRating >= star
                                  ? 'text-indian-red'
                                  : 'text-silk drop-shadow-sm'
                              }`}
                            >
                              <Star
                                size={24}
                                fill={reviewRating >= star ? 'currentColor' : 'currentColor'}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      {storeSettings.reviewSkinTypeTaggingEnabled && (
                        <div>
                          <label className="block text-[10px] font-sans tracking-[0.2em] uppercase text-ruby-red mb-3 opacity-50">
                            Your Skin Type
                          </label>
                          <div className="w-full bg-[#FDFBF7]/50 border border-silk/60 p-4 font-sans text-sm text-dark-red/50 cursor-not-allowed select-none shadow-inner italic" title="Skin type tagging coming soon">
                            Skin type selection (Coming Soon)
                          </div>
                        </div>
                      )}

                      {storeSettings.reviewBeforeAfterPhotosEnabled && (
                        <div>
                          <label className="block text-[10px] font-sans tracking-[0.2em] uppercase text-ruby-red mb-3 opacity-50">
                            Before & After Photos
                          </label>
                          <div className="border border-dashed border-silk/60 rounded-none p-6 text-center bg-[#FDFBF7]/30 cursor-not-allowed">
                            <p className="text-xs font-sans text-dark-red/50 italic">Photo uploads coming soon</p>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-sans tracking-[0.2em] uppercase text-ruby-red mb-3">
                          Share your experience
                        </label>

                        <textarea
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="What do you love about this product?"
                          autoComplete="off"
                          required
                          rows={4}
                          className="w-full bg-[#FDFBF7]/50 border border-silk/60 p-4 font-sans text-sm text-dark-red placeholder:text-grey-beige/50 focus:outline-none focus:border-ruby-red transition-colors resize-none shadow-inner"
                        />
                      </div>

                      {reviewFeedback && (
                        <div
                          className={`p-4 text-xs tracking-widest uppercase font-sans ${
                            reviewFeedback.type === 'error'
                              ? 'bg-indian-red/10 text-indian-red border border-indian-red/20'
                              : 'bg-green-50 text-green-700 border border-green-200'
                          }`}
                        >
                          {reviewFeedback.msg}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="bg-dark-red text-[#FDFBF7] py-4 uppercase font-sans text-xs tracking-widest hover:bg-ruby-red hover:shadow-lg transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
                      >
                        {isSubmittingReview ? <Loader2 size={16} className="animate-spin" /> : null}
                        Submit Review
                      </button>
                    </form>
                  ) : (
                    <div className="text-center py-10 bg-[#FDFBF7]/50 border border-silk/30 relative z-10">
                      <p className="text-sm font-sans text-dark-red mb-5 italic">
                        Please sign in to share your thoughts about this product.
                      </p>

                      <button
                        onClick={() => navigateTo('signin')}
                        className="inline-flex items-center gap-2 text-xs uppercase font-sans tracking-widest text-dark-red border-b border-dark-red pb-1 hover:text-ruby-red hover:border-ruby-red transition-colors"
                      >
                        Sign In to Review <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </m.div>
              )}
            </AnimatePresence>
          </m.div>
        </m.div>

        {/* Complete Ritual */}
        {(isRelatedLoading || relatedProducts.length > 0) && (
          <m.div
            className="mt-28 sm:mt-32 lg:mt-40 mb-10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            <m.div variants={fadeUp} className="flex items-end justify-between gap-4 mb-10 sm:mb-12 border-b border-silk/60 pb-6">
              <div>
                <p className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-2">
                  Complete your ritual
                </p>
                <h2 className="font-serif text-dark-red text-3xl md:text-4xl">You May Also Like</h2>
              </div>

              <button
                onClick={() => navigateTo('shop')}
                className="hidden md:flex items-center gap-1.5 text-xs font-sans tracking-widest uppercase text-grey-beige hover:text-dark-red transition-colors group"
              >
                View all <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </m.div>

            <div className="flex gap-4 md:gap-6 overflow-x-auto pb-8 snap-x snap-mandatory scrollbar-hide">
              {isRelatedLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="min-w-[78%] sm:min-w-[48%] md:min-w-[280px] lg:min-w-[300px] aspect-[4/5] bg-silk/10 animate-pulse rounded-lg" />
                ))
              ) : (
                relatedProducts.map((p) => (
                  <m.div
                    key={p.pid}
                    variants={fadeUp}
                    className="min-w-[78%] sm:min-w-[48%] md:min-w-[280px] lg:min-w-[300px] snap-start"
                  >
                    <ProductCard product={p} />
                  </m.div>
                ))
              )}
            </div>

            <div className="mt-4 text-center md:hidden">
              <button
                onClick={() => navigateTo('shop')}
                className="inline-flex items-center gap-1.5 text-xs font-sans tracking-widest uppercase text-dark-red border-b border-dark-red pb-1"
              >
                View all <ChevronRight size={14} />
              </button>
            </div>
          </m.div>
        )}
      </div>

      <Footer />
    </div>
  );
}
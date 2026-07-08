import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AppContext } from '../context/AppContext';
import { useCurrency } from '../hooks/useCurrency';
import {
  Search,
  ShoppingBag,
  UserCheck,
  Truck,
  CreditCard,
  PackageCheck,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Sparkles,
  Lock,
  Compass,
} from 'lucide-react';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';

interface Step {
  number: string;
  icon: any;
  title: string;
  subtitle: string;
  description: string;
  cta: { label: string; path: string } | null;
  highlight: string;
}

const steps: Step[] = [
  {
    number: '01',
    icon: Search,
    title: 'Discover Your Ritual',
    subtitle: 'Find the perfect match for your skin',
    description:
      'Browse our curated collection of clean, clinical formulations. Use the Ritual Finder to get recommendation profiles tailored to your specific skin concern, or explore by product category.',
        keywords: 'bodilicious, skincare, haircare, natural beauty, products, buy online',
    cta: { label: 'Explore Shop', path: '/shop' },
    highlight: 'Tip: Filter by skin concern (e.g. brightening, hydration) for faster discovery.',
  },
  {
    number: '02',
    icon: ShoppingBag,
    title: 'Add to Cart',
    subtitle: 'Build your customized skincare regime',
    description:
      'Select your size option on the product page and click "Add to Cart". Review your items, apply any coupon codes, and see your progress towards free shipping inside the sliding cart drawer.',
    cta: { label: 'View Cart', path: '/cart' },
    highlight: 'Tip: Add items to your Wishlist to save them for later.',
  },
  {
    number: '03',
    icon: UserCheck,
    title: 'Sign In to Proceed',
    subtitle: 'Access your customer profile',
    description:
      'Create a personal account or sign in to your existing profile. This allows you to save delivery addresses, check out faster, track order histories, and manage your tickets easily.',
    cta: { label: 'Sign In Now', path: '/signin' },
    highlight: 'Registered members get 10% off their first order automatically.',
  },
  {
    number: '04',
    icon: Truck,
    title: 'Shipping Details',
    subtitle: 'Safe, secure, and tracked transit',
    description:
      'Provide your full delivery address and current contact details. We ship securely to thousands of locations across India, with free standard shipping available for orders over ₹1,500. Every parcel is safely packed to preserve your items.',
    cta: null,
    highlight: 'Dispatched from our warehouse within 24–48 hours.',
  },
  {
    number: '05',
    icon: CreditCard,
    title: 'Secure Payment',
    subtitle: 'Fully encrypted transaction gateway',
    description:
      'Complete your checkout securely via Razorpay. We support UPI, all major credit/debit cards, Net Banking, and popular mobile wallets. Cash on Delivery (COD) is also available for all orders within India. Your credentials are fully protected.',
    cta: null,
    highlight: 'Look for the lock icon in the address bar. SSL Secured.',
  },
  {
    number: '06',
    icon: PackageCheck,
    title: 'Track Delivery',
    subtitle: 'Stay updated at every milestone',
    description:
      'Once dispatched, you will receive a tracking link via email and WhatsApp. Monitor the live location of your order on our Tracking page using your Order ID.',
    cta: { label: 'Track Order', path: '/tracking' },
    highlight: 'Raise a ticket from your dashboard if you face delivery delays.',
  },
];

export default function HowToOrderPage() {
  useSEO({
    title: 'How to Order — Bodilicious',
    description:
      'An interactive, step-by-step walkthrough to placing an order on Bodilicious. Discover, select, check out, and track your package.',
    canonical: '/how-to-order',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to Order from Bodilicious',
      description: 'A step-by-step guide to placing an order on the Bodilicious website.',
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Discover', text: 'Browse the shop or use the Ritual Finder to find products suited to your skin or hair concerns.' },
        { '@type': 'HowToStep', position: 2, name: 'Select', text: 'Add your chosen products to the cart and review product details, ingredients, and size options.' },
        { '@type': 'HowToStep', position: 3, name: 'Checkout', text: 'Enter your delivery address and complete payment securely via UPI, card, or COD.' },
        { '@type': 'HowToStep', position: 4, name: 'Track', text: 'Receive a tracking link by email and WhatsApp. Monitor your order live from the Tracking page.' },
      ],
    },
  });

  const appContext = useContext(AppContext);
  const { formatPrice } = useCurrency();
  
  const displayProduct = appContext?.products && appContext.products.length > 0 
    ? appContext.products[0] 
    : { name: 'Brightening Serum', price: 1850, product_weight_ml: 50, item_form: 'Regular Pack', images: [] };

  const [activeStep, setActiveStep] = useState(0);
  const [direction, setDirection] = useState(0); // -1 for prev, 1 for next

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleStepChange = (newStep: number) => {
    setDirection(newStep > activeStep ? 1 : -1);
    setActiveStep(newStep);
  };

  const nextStep = () => {
    if (activeStep < steps.length - 1) {
      handleStepChange(activeStep + 1);
    }
  };

  const prevStep = () => {
    if (activeStep > 0) {
      handleStepChange(activeStep - 1);
    }
  };

  // Variants for step contents animation
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -80 : 80,
      opacity: 0,
      transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
    }),
  };

  // Custom interactive mockups for the left display panel
  const renderVisualMockup = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return (
          <div className="w-full h-full flex flex-col justify-center p-6 space-y-4">
            <div className="flex items-center gap-2 px-3.5 py-2 bg-white/70 backdrop-blur-md border border-silk-dark/15 rounded-xl shadow-sm">
              <Search size={16} className="text-dark-red" />
              <span className="text-xs text-grey-beige font-sans">Search luxury rituals...</span>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-dark-red/60 block">Trending</span>
              <div className="flex flex-wrap gap-2">
                {['Vitamin C Serum', 'Body Scrub', 'Hydrating Gel', 'Rose Water'].map((item, idx) => (
                  <span key={idx} className="text-[11px] font-sans px-3 py-1.5 bg-white border border-silk/80 text-dark-red rounded-lg shadow-sm hover:border-ruby-red transition-all cursor-pointer">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-4 bg-white/40 border border-silk/60 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center text-ruby-red">
                <Compass size={18} />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-dark-red">Ritual Finder</h4>
                <p className="text-[10px] text-grey-beige">Find customized skin routine in 1 min</p>
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="w-full h-full flex flex-col justify-center p-6">
            <div className="bg-white/95 border border-silk rounded-xl shadow-lg overflow-hidden">
              <div className="px-4 py-3 bg-silk-light border-b border-silk flex items-center justify-between">
                <span className="text-xs font-bold text-dark-red font-serif">Shopping Cart (1)</span>
                <span className="text-[10px] text-ruby-red font-semibold bg-rose-50 px-2 py-0.5 rounded-full">Free Shipping!</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-3">
                  {displayProduct.images && displayProduct.images.length > 0 ? (
                    <img src={displayProduct.images[0]} alt={displayProduct.name} className="w-12 h-12 bg-rose-100 rounded-lg flex-shrink-0 object-cover" />
                  ) : (
                    <div className="w-12 h-12 bg-rose-100 rounded-lg flex-shrink-0 flex items-center justify-center font-serif text-ruby-red text-sm font-semibold">B</div>
                  )}
                  <div className="text-left flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-dark-red truncate">{displayProduct.name}</h4>
                    <p className="text-[10px] text-grey-beige">
                      {displayProduct.product_weight_ml ? `${displayProduct.product_weight_ml}ml | ` : ''}
                      {displayProduct.item_form || 'Regular Pack'}
                    </p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs font-bold text-dark-red">{formatPrice(displayProduct.price || 1850)}</span>
                      <div className="flex items-center border border-silk rounded-md bg-neutral-50 text-xs">
                        <button className="px-2 py-0.5 text-grey-beige hover:text-dark-red">-</button>
                        <span className="px-2 text-dark-red font-bold">1</span>
                        <button className="px-2 py-0.5 text-grey-beige hover:text-dark-red">+</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="w-full h-full flex flex-col justify-center p-6 space-y-3">
            <div className="bg-white/95 border border-silk rounded-xl shadow-lg p-5 text-center">
              <h4 className="text-xs font-bold text-dark-red mb-3">Welcome to Bodilicious</h4>
              <div className="space-y-2">
                <div className="w-full border border-silk rounded-lg p-2 text-left bg-neutral-50">
                  <span className="text-[9px] text-grey-beige block">Email Address</span>
                  <span className="text-xs text-dark-red font-medium">customer@example.com</span>
                </div>
                <div className="w-full border border-silk rounded-lg p-2 text-left bg-neutral-50">
                  <span className="text-[9px] text-grey-beige block">Password</span>
                  <span className="text-xs text-dark-red font-medium">••••••••••••</span>
                </div>
                <button className="w-full py-2 bg-dark-red hover:bg-ruby-red text-white text-xs font-semibold rounded-lg shadow transition-colors">
                  Sign In
                </button>
              </div>
              <div className="mt-3 text-[10px] text-grey-beige">
                Don&apos;t have an account? <span className="text-ruby-red font-semibold hover:underline cursor-pointer">Register</span>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="w-full h-full flex flex-col justify-center p-6 space-y-3">
            <div className="bg-white/95 border border-silk rounded-xl shadow-lg p-4 space-y-3">
              <h4 className="text-xs font-bold text-dark-red border-b border-silk pb-1.5">Shipping Method</h4>
              <div className="border border-ruby-red bg-rose-50/30 rounded-lg p-3 flex justify-between items-center cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-dark-red block">Standard Shipping</span>
                  <span className="text-[10px] text-grey-beige">Delivered in 3-5 business days</span>
                </div>
                <span className="text-xs font-bold text-ruby-red">Free</span>
              </div>
              <div className="border border-silk rounded-lg p-3 flex justify-between items-center opacity-60">
                <div>
                  <span className="text-xs font-bold text-dark-red block">International Shipping</span>
                  <span className="text-[10px] text-grey-beige">Varies by destination country</span>
                </div>
                <span className="text-xs font-bold text-dark-red">Calculated</span>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="w-full h-full flex flex-col justify-center p-6">
            <div className="bg-gradient-to-tr from-stone-900 to-stone-800 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full blur-xl" />
              <div className="flex justify-between items-start mb-6">
                <div className="w-8 h-6 bg-amber-400/80 rounded-md" />
                <Lock size={16} className="text-white/40" />
              </div>
              <div className="space-y-4">
                <span className="font-mono text-sm tracking-widest block">••••  ••••  ••••  4821</span>
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[8px] uppercase tracking-wider text-white/50 block">Card Holder</span>
                    <span className="text-xs font-sans">VALUED CUSTOMER</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] uppercase tracking-wider text-white/50 block">Expires</span>
                    <span className="text-xs font-sans">08/30</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1 text-[10px] text-grey-beige">
              <Lock size={10} />
              <span>Razorpay Secured Gateway</span>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="w-full h-full flex flex-col justify-center p-6">
            <div className="bg-white/95 border border-silk rounded-xl shadow-lg p-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-dark-red">Order ID: #BD-92714</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-100">In Transit</span>
              </div>
              <div className="space-y-3 relative">
                <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-silk" />
                
                <div className="flex gap-3 items-center relative">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 border-4 border-white shadow-sm flex-shrink-0" />
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-dark-red block">Order Placed</span>
                    <span className="text-[8px] text-grey-beige">June 09, 2:40 PM</span>
                  </div>
                </div>
                <div className="flex gap-3 items-center relative">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 border-4 border-white shadow-sm flex-shrink-0" />
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-dark-red block">Dispatched</span>
                    <span className="text-[8px] text-grey-beige">June 09, 6:10 PM</span>
                  </div>
                </div>
                <div className="flex gap-3 items-center relative">
                  <div className="w-5 h-5 rounded-full bg-ruby-red border-4 border-white shadow-sm flex-shrink-0 animate-pulse" />
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-ruby-red block">Out for Delivery</span>
                    <span className="text-[8px] text-grey-beige">Expected Today</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col font-sans selection:bg-rose-200">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <div className="pt-32 pb-12 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-rose-50 border border-rose-100 text-ruby-red text-[11px] font-sans font-bold tracking-widest uppercase">
            <Sparkles size={12} />
            Ordering Assistant
          </div>

          <h1 className="font-serif text-4xl lg:text-5xl text-dark-red mb-4 leading-tight">
            How to Place Your Order
          </h1>

          <p className="font-sans text-gray-500 text-sm md:text-base leading-relaxed max-w-xl mx-auto">
            Experience premium convenience. Discover how to purchase your favorite skincare rituals and track their journey to your home.
          </p>
        </div>
      </div>

      {/* ── Interactive Slideshow Dashboard ────────────────────── */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 pb-24">
        {/* Step Nav Bar */}
        <div className="relative mb-12 max-w-3xl mx-auto">
          {/* Background line */}
          <div className="absolute top-[21px] left-6 right-6 h-0.5 bg-silk" />
          
          {/* Active progress track */}
          <div 
            className="absolute top-[21px] left-6 h-0.5 bg-ruby-red transition-all duration-500" 
            style={{ width: `${(activeStep / (steps.length - 1)) * 86 + 5}%` }}
          />

          <div className="relative flex justify-between">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === activeStep;
              const isVisited = idx < activeStep;

              return (
                <button
                  key={step.number}
                  onClick={() => handleStepChange(idx)}
                  className="flex flex-col items-center group focus:outline-none"
                  aria-label={`Go to step ${idx + 1}`}
                >
                  <div 
                    className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative z-10 
                      ${isActive 
                        ? 'bg-ruby-red border-ruby-red text-white shadow-lg shadow-ruby-red/20 scale-110' 
                        : isVisited 
                          ? 'bg-white border-ruby-red text-ruby-red' 
                          : 'bg-white border-silk text-grey-beige group-hover:border-rose-300 group-hover:text-ruby-red'
                      }`}
                  >
                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span 
                    className={`mt-2 text-[10px] font-sans font-bold tracking-wider uppercase transition-colors duration-200 hidden sm:block
                      ${isActive ? 'text-dark-red' : 'text-grey-beige group-hover:text-ruby-red'}`}
                  >
                    {step.number}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Display Card */}
        <div className="bg-white border border-silk/80 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300 grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
          
          {/* Left panel: Simulated visual mockup / dynamic state representation */}
          <div className="lg:col-span-5 bg-gradient-to-b from-silk-light via-silk-light/40 to-neutral-50 border-b lg:border-b-0 lg:border-r border-silk flex items-center justify-center min-h-[260px] lg:min-h-0 relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-100/40 via-transparent to-transparent opacity-70" />
            <div className="w-full max-w-[280px] h-full flex items-center justify-center relative z-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, scale: 0.9, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -15 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="w-full"
                >
                  {renderVisualMockup(activeStep)}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Right panel: Content block */}
          <div className="lg:col-span-7 p-8 lg:p-12 flex flex-col justify-between">
            <div className="relative overflow-hidden flex-1">
              <AnimatePresence custom={direction} mode="wait">
                <motion.div
                  key={activeStep}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-6"
                >
                  <div>
                    <span className="text-[10px] font-sans font-bold tracking-[0.2em] uppercase text-ruby-red/70 block mb-1">
                      Step {steps[activeStep].number} of {steps.length}
                    </span>
                    <h2 className="font-serif text-2xl lg:text-3xl text-dark-red tracking-tight leading-tight">
                      {steps[activeStep].title}
                    </h2>
                    <p className="text-xs text-grey-beige font-sans italic mt-0.5">
                      {steps[activeStep].subtitle}
                    </p>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed font-light">
                    {steps[activeStep].description}
                  </p>

                  <div className="inline-flex items-start gap-2 text-xs font-sans text-amber-800 bg-amber-50 border border-amber-200/60 p-3 rounded-xl">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    <p className="leading-relaxed">{steps[activeStep].highlight}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Controls */}
            <div className="mt-8 pt-6 border-t border-silk flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={prevStep}
                  disabled={activeStep === 0}
                  className="w-10 h-10 border border-silk hover:border-dark-red hover:bg-rose-50 text-dark-red disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-silk rounded-xl transition-all flex items-center justify-center cursor-pointer"
                  aria-label="Previous step"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={nextStep}
                  disabled={activeStep === steps.length - 1}
                  className="w-10 h-10 border border-silk hover:border-dark-red hover:bg-rose-50 text-dark-red disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-silk rounded-xl transition-all flex items-center justify-center cursor-pointer"
                  aria-label="Next step"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Redirect Action or Finish CTA */}
              <div>
                {steps[activeStep].cta ? (
                  <Link
                    to={steps[activeStep].cta!.path}
                    className="inline-flex items-center gap-2 bg-dark-red hover:bg-ruby-red text-white text-xs font-semibold px-5 py-3 rounded-xl shadow transition-colors cursor-pointer"
                  >
                    {steps[activeStep].cta!.label}
                    <ArrowRight size={12} />
                  </Link>
                ) : activeStep === steps.length - 1 ? (
                  <Link
                    to="/shop"
                    className="inline-flex items-center gap-2 bg-dark-red hover:bg-ruby-red text-white text-xs font-semibold px-5 py-3 rounded-xl shadow transition-colors cursor-pointer"
                  >
                    Start Shopping
                    <ArrowRight size={12} />
                  </Link>
                ) : (
                  <button
                    onClick={nextStep}
                    className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold px-5 py-3 rounded-xl shadow transition-colors cursor-pointer"
                  >
                    Continue
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ── Still need help? ──────────────────────────────────── */}
        <div className="mt-16 rounded-3xl bg-gradient-to-br from-dark-red via-ruby-red to-rose-700 p-10 text-center text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 bottom-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
          <p className="text-[11px] font-sans tracking-widest uppercase font-semibold text-rose-200 mb-3">
            Still need help?
          </p>
          <h3 className="font-serif text-3xl mb-3">We&apos;re here for you</h3>
          <p className="text-rose-100 text-sm font-light leading-relaxed max-w-md mx-auto mb-8">
            Our support team is available on WhatsApp and typically replies within a few hours.
            You can also raise a support ticket from your account page.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <a
              id="how-to-order-whatsapp-cta"
              href="https://wa.me/919894451947?text=Hi%2C%20I%20need%20help%20placing%20my%20order."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1fba58] text-white px-7 py-3.5 rounded-xl font-medium tracking-wide transition-all duration-300 hover:-translate-y-0.5 shadow-md hover:shadow-lg text-sm cursor-pointer"
            >
              <MessageCircle size={18} />
              Chat on WhatsApp
            </a>
            <Link
              to="/contact"
              id="how-to-order-contact-cta"
              className="inline-flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white border border-white/30 hover:border-white/60 px-6 py-3.5 rounded-xl transition-all duration-300 cursor-pointer"
            >
              Contact Us
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

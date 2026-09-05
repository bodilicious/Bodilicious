import { useApp } from '../context/AppContext';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ShoppingBag,
  Gift,
  ChevronRight,
  Instagram,
  Facebook,
  Heart,
  Flower,
  Apple,
  Droplets,
  Copy,
} from 'lucide-react';
import { motion, useScroll, useTransform, Variants } from 'framer-motion';
import { useRef, useState } from 'react';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';

/* ─── Animation Variants ─────────────────────────────────────────────────── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

/* ─── Product Card ───────────────────────────────────────────────────────── */
interface ProductItem {
  icon: React.ReactNode;
  name: string;
  tagline: string;
  gradient: string;
  accentColor: string;
  emoji: string;
  pid: string;
}

function ProductCard({ product, index }: { product: ProductItem; index: number }) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -6, scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Link
        to={`/product/${product.pid}`}
        className="relative overflow-hidden rounded-3xl p-7 flex flex-col gap-4 h-full cursor-pointer block"
        style={{
          background: product.gradient,
          border: '1px solid rgba(255,255,255,0.5)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        {/* Number badge */}
        <span
          className="absolute top-5 right-6 font-sans text-[11px] font-bold tracking-[0.15em]"
          style={{ color: product.accentColor, opacity: 0.6 }}
        >
          0{index + 1}
        </span>

        {/* Emoji */}
        <span className="text-4xl" aria-hidden="true">{product.emoji}</span>

        {/* Icon */}
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.55)', color: product.accentColor }}
          aria-hidden="true"
        >
          {product.icon}
        </div>

        <div>
          <h3
            className="font-serif text-xl mb-1.5"
            style={{ color: '#2C1208' }}
          >
            {product.name}
          </h3>
          <p className="font-sans text-sm leading-relaxed" style={{ color: '#5D3820' }}>
            {product.tagline}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}


/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function OfferPage() {
  const { navigateTo } = useApp();
  const heroRef = useRef<HTMLElement>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText('BLOOM4TEACHERS');
      } else {
        const ta = document.createElement('textarea');
        ta.value = 'BLOOM4TEACHERS';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    } catch { /* silent */ }
  };

  useSEO({
    title: "Teachers Day Week — Fruity & Floral Edition | Bodilicious",
    description:
      "This Teachers Day week, Bodilicious bundles Banana Shampoo, Rose Face & Body Wash, and Strawberry Face & Body Wash into one gift-worthy Fruity & Floral Edition. 7 days only.",
    keywords:
      'bodilicious, teachers day, fruity floral, banana shampoo, rose face wash, strawberry body wash, skincare gift',
    canonical: '/offers',
    ogImage: 'https://bodilicious.in/og-image.png',
    ogImageAlt: 'Bodilicious Teachers Day — Fruity & Floral Edition',
  });

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '25%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const products: ProductItem[] = [
    {
      emoji: '🍌',
      icon: <Droplets size={18} />,
      name: 'Banana Shampoo',
      tagline: 'Nourishing, soft-scented, everyday hair care.',
      gradient: 'linear-gradient(135deg, #FEF9C3 0%, #FEF3C7 60%, #FDE68A 100%)',
      accentColor: '#92400E',
      pid: 'BD-SHAM-BANANA',
    },
    {
      emoji: '🌹',
      icon: <Flower size={18} />,
      name: 'Rose Face & Body Wash',
      tagline: 'Calming and floral, for a gentle daily cleanse.',
      gradient: 'linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 60%, #FECDD3 100%)',
      accentColor: '#9F1239',
      pid: 'BD-CLE-ROSE',
    },
    {
      emoji: '🍓',
      icon: <Apple size={18} />,
      name: 'Strawberry Face & Body Wash',
      tagline: 'Bright, sweet, and perfectly refreshing.',
      gradient: 'linear-gradient(135deg, #FFE4E6 0%, #FECDD3 60%, #FDA4AF 100%)',
      accentColor: '#BE123C',
      pid: 'BD-CLE-STRAW',
    },
  ];

  const terms = [
    'Valid for 7 days from launch — while stocks last.',
    'Limited to one bundle per customer.',
    'Cannot be combined with other ongoing offers.',
    'Available only in the Fruity & Floral bundle format.',
    'Use code BLOOM4TEACHERS at checkout to redeem your offer.',
  ];

  return (
    <main className="min-h-screen bg-[#FDF9F5] flex flex-col selection:bg-rose-200/40">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden"
        style={{ minHeight: 'min(620px, 80vh)' }}
        aria-label="Teachers Day Week Fruity and Floral Edition"
      >
        {/* Parallax background layer */}
        <motion.div
          style={{ y: heroY }}
          className="absolute inset-0 z-0"
          aria-hidden="true"
        >
          {/* Rich warm gradient */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, #3B1E0A 0%, #5C2D1E 25%, #7C3527 50%, #8B4513 75%, #4A1E0A 100%)',
            }}
          />
          {/* Overlay texture rings */}
          <div
            className="absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #F97316 0%, transparent 70%)' }}
          />
          <div
            className="absolute -bottom-12 -left-16 w-80 h-80 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #EC4899 0%, transparent 70%)' }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(ellipse, #FBBF24 0%, transparent 60%)' }}
          />
        </motion.div>

        {/* Floating emojis — decorative */}
        <motion.div
          className="absolute inset-0 overflow-hidden z-[1] pointer-events-none"
          aria-hidden="true"
          style={{ opacity: heroOpacity }}
        >
          {[
            { emoji: '🌸', top: '12%', left: '8%', delay: 0 },
            { emoji: '🍌', top: '20%', right: '10%', left: 'auto', delay: 0.4 },
            { emoji: '🌹', bottom: '20%', left: '6%', top: 'auto', delay: 0.2 },
            { emoji: '🍓', bottom: '15%', right: '8%', left: 'auto', top: 'auto', delay: 0.6 },
            { emoji: '🌺', top: '55%', left: '18%', delay: 0.3 },
          ].map(({ emoji, delay, ...pos }, i) => (
            <motion.span
              key={i}
              className="absolute text-3xl"
              style={pos as any}
              initial={{ opacity: 0, scale: 0.6, rotate: -10 }}
              animate={{
                opacity: [0, 0.7, 0.7, 0],
                scale: [0.6, 1, 1, 0.8],
                rotate: [-10, 5, -5, 10],
                y: [0, -8, 8, 0],
              }}
              transition={{
                duration: 6,
                delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              {emoji}
            </motion.span>
          ))}
        </motion.div>

        {/* Hero content */}
        <motion.div
          className="relative z-10 max-w-3xl mx-auto text-center px-6 py-24 flex flex-col items-center"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          {/* Eyebrow pill */}
          <motion.div variants={fadeUp} className="mb-7">
            <span
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-sans text-[10px] font-bold tracking-[0.2em] uppercase"
              style={{
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#FDE68A',
              }}
            >
              <Sparkles size={11} className="animate-pulse" aria-hidden="true" />
              Teachers Day Week
            </span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            variants={fadeUp}
            className="font-serif text-white leading-tight mb-5"
            style={{ fontSize: 'clamp(36px, 6vw, 64px)' }}
          >
            The Fruity &amp; Floral Edition
          </motion.h1>

          {/* Subhead */}
          <motion.p
            variants={fadeUp}
            className="font-sans leading-relaxed mb-8 max-w-xl"
            style={{ fontSize: 'clamp(15px, 2.5vw, 18px)', color: 'rgba(255,255,255,0.78)' }}
          >
            Some people shape more than our minds — they shape who we become. This Teachers Day week,
            we're bundling three of our best-loved essentials into one gift-worthy edition.
            <span className="text-amber-200 font-medium"> Fresh, fruity, floral,</span> and finished with a little gratitude.
          </motion.p>

          {/* Urgency banner */}
          <motion.div variants={fadeUp}>
            <span
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 font-sans text-sm font-semibold"
              style={{
                background: 'rgba(251,191,36,0.18)',
                border: '1px solid rgba(251,191,36,0.35)',
                color: '#FDE68A',
              }}
            >
              ⏰ Offer valid for 7 days · Ends soon
            </span>
          </motion.div>
        </motion.div>
      </section>

      {/* ── What's Inside ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto w-full px-6 py-20" aria-label="Products in the bundle">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="text-center mb-14"
        >
          <motion.p
            variants={fadeUp}
            className="font-sans text-[10px] uppercase tracking-[0.3em] font-bold mb-3"
            style={{ color: '#9A3412' }}
          >
            What's Inside
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="font-serif text-4xl md:text-5xl mb-4"
            style={{ color: '#2C1208' }}
          >
            Three Essentials, One Edition
          </motion.h2>
          <motion.div
            variants={fadeUp}
            className="h-px w-16 mx-auto"
            style={{ background: 'linear-gradient(90deg, transparent, #9A3412, transparent)' }}
          />
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {products.map((p, i) => (
            <ProductCard key={p.name} product={p} index={i} />
          ))}
        </motion.div>
      </section>

      {/* ── Why This Edition ──────────────────────────────────────────────── */}
      <section
        className="py-20 px-6"
        style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FFF1F2 100%)' }}
        aria-label="Why this edition"
      >
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-3xl mx-auto text-center"
        >
          <motion.p
            variants={fadeUp}
            className="font-sans text-[10px] uppercase tracking-[0.3em] font-bold mb-4"
            style={{ color: '#9A3412' }}
          >
            Why This Edition
          </motion.p>

          <motion.blockquote
            variants={fadeUp}
            className="font-serif leading-relaxed mb-8"
            style={{ fontSize: 'clamp(22px, 3.5vw, 32px)', color: '#3D0A05' }}
          >
            Teaching is a full-time act of patience.
          </motion.blockquote>

          <motion.p
            variants={fadeUp}
            className="font-sans leading-relaxed"
            style={{ fontSize: 'clamp(15px, 2vw, 17px)', color: '#7C3E2C', maxWidth: '560px', margin: '0 auto' }}
          >
            This week, we're saying thanks with a set that feels like a small reset — one for the hair,
            one for calm, one for freshness. Because good teachers deserve good things too.
          </motion.p>

          {/* Three pillars */}
          <motion.div
            variants={stagger}
            className="grid grid-cols-3 gap-4 mt-12"
          >
            {[
              { emoji: '🍌', label: 'For the hair' },
              { emoji: '🌹', label: 'For calm' },
              { emoji: '🍓', label: 'For freshness' },
            ].map((p) => (
              <motion.div
                key={p.label}
                variants={scaleIn}
                className="flex flex-col items-center gap-2 rounded-2xl p-5"
                style={{
                  background: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(239,171,132,0.3)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span className="text-2xl" aria-hidden="true">{p.emoji}</span>
                <span className="font-sans text-xs font-medium" style={{ color: '#5D3820' }}>
                  {p.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>
      {/* ── Offer Terms ───────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto w-full px-6 pb-16" aria-label="Offer terms and conditions">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl p-8 md:p-10"
          style={{
            background: 'linear-gradient(135deg, rgba(255,241,230,0.7) 0%, rgba(255,228,230,0.5) 100%)',
            border: '1px solid rgba(239,171,132,0.3)',
          }}
        >
          <div className="flex items-center gap-3 mb-8">
            <Gift size={20} style={{ color: '#9A3412' }} aria-hidden="true" />
            <h2 className="font-serif text-2xl" style={{ color: '#2C1208' }}>Offer Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {terms.map((term, i) => (
              <div key={i} className="flex items-start gap-3">
                <ChevronRight
                  size={14}
                  className="mt-0.5 shrink-0"
                  style={{ color: '#9A3412' }}
                  aria-hidden="true"
                />
                <p className="font-sans text-sm leading-relaxed" style={{ color: '#5D3820' }}>
                  {term}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
      <section
        className="py-20 px-6"
        style={{ background: 'linear-gradient(135deg, #3B1E0A 0%, #5C2D1E 60%, #7C3527 100%)' }}
        aria-label="Final call to action"
      >
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-3xl mx-auto text-center"
        >
          <motion.p
            variants={fadeUp}
            className="font-sans text-[10px] uppercase tracking-[0.25em] font-bold mb-4"
            style={{ color: '#FDE68A' }}
          >
            This Week Only
          </motion.p>

          <motion.h2
            variants={fadeUp}
            className="font-serif text-white leading-tight mb-5"
            style={{ fontSize: 'clamp(28px, 5vw, 48px)' }}
          >
            Because good teachers deserve good things too.
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="font-sans leading-relaxed"
            style={{ fontSize: '16px', color: 'rgba(255,255,255,0.72)', maxWidth: '480px', margin: '0 auto' }}
          >
            Grab the Fruity &amp; Floral Edition — bundled together for one week only.
          </motion.p>

          {/* ── Coupon Code Block ── */}
          <motion.div variants={fadeUp} className="mt-8 mb-8">
            <p className="font-sans text-xs mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Your exclusive code</p>
            <div className="inline-flex items-center gap-3 rounded-2xl px-6 py-3.5" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(251,191,36,0.4)', backdropFilter: 'blur(8px)' }}>
              <span className="font-mono font-bold tracking-[0.2em] text-xl" style={{ color: '#FDE68A' }}>BLOOM4TEACHERS</span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-sans text-xs font-bold transition-all duration-200 cursor-pointer"
                style={{
                  background: codeCopied ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.12)',
                  color: codeCopied ? '#FDE68A' : 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
                aria-label="Copy coupon code BLOOM4TEACHERS"
              >
                {codeCopied ? '✓ Copied' : <><Copy size={12} aria-hidden="true" /> Copy</>}
              </button>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <button
              onClick={() => navigateTo('shop')}
              className="inline-flex items-center gap-3 rounded-2xl px-10 py-4 font-sans font-bold text-sm tracking-wide transition-all duration-200 hover:scale-[1.03] cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)',
                color: '#2C1208',
                boxShadow: '0 6px 24px rgba(251,191,36,0.35)',
              }}
            >
              <ShoppingBag size={18} aria-hidden="true" />
              Shop the Edition
            </button>
            <p className="font-sans text-[11px] mt-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Use code <span className="font-bold tracking-widest" style={{ color: '#FDE68A' }}>BLOOM4TEACHERS</span> at checkout
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Social CTA ────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto w-full px-6 py-16" aria-label="Follow us on social media">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl p-8 md:p-10 relative overflow-hidden group transition-shadow duration-500 hover:shadow-[0_16px_48px_rgba(180,60,20,0.1)]"
          style={{
            background: 'linear-gradient(135deg, #FFF7ED 0%, #FFF1F2 100%)',
            border: '1px solid rgba(239,171,132,0.3)',
          }}
        >
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full -mr-32 -mt-32 transition-transform duration-700 group-hover:scale-150 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.18) 0%, transparent 70%)' }}
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6 flex-shrink-0"
                style={{ background: '#fff', color: '#F43F5E' }}
                aria-hidden="true"
              >
                <Heart size={32} strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="font-serif text-3xl mb-2" style={{ color: '#2C1208' }}>
                  Follow Our Social Media
                </h2>
                <p className="font-sans text-sm leading-relaxed" style={{ color: '#7C3E2C', maxWidth: '380px' }}>
                  Join our community for further offers, early access to new collections, and skincare rituals.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-shrink-0">
              <a
                href="https://www.instagram.com/bodilicious.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-sans text-xs font-bold uppercase tracking-widest shadow-sm transition-all duration-300 w-full sm:w-auto cursor-pointer"
                style={{ background: '#fff', border: '1px solid #FECDD3', color: '#BE185D' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'linear-gradient(135deg,#f43f5e,#ec4899)';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
                  (e.currentTarget as HTMLAnchorElement).style.border = '1px solid transparent';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.background = '#fff';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#BE185D';
                  (e.currentTarget as HTMLAnchorElement).style.border = '1px solid #FECDD3';
                }}
                aria-label="Follow Bodilicious on Instagram"
              >
                <Instagram size={16} aria-hidden="true" />
                <span>Instagram</span>
              </a>
              <a
                href="https://www.facebook.com/bodilicious.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-sans text-xs font-bold uppercase tracking-widest shadow-sm transition-all duration-300 w-full sm:w-auto cursor-pointer"
                style={{ background: '#fff', border: '1px solid #BFDBFE', color: '#1D4ED8' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.background = '#2563EB';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
                  (e.currentTarget as HTMLAnchorElement).style.border = '1px solid transparent';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.background = '#fff';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#1D4ED8';
                  (e.currentTarget as HTMLAnchorElement).style.border = '1px solid #BFDBFE';
                }}
                aria-label="Follow Bodilicious on Facebook"
              >
                <Facebook size={16} aria-hidden="true" />
                <span>Facebook</span>
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      <Footer />
    </main>
  );
}

import { useState, useEffect } from 'react';
import { m, AnimatePresence, Variants } from 'framer-motion';
import { X, ShoppingBag, ChevronRight, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Offer {
  _id: string;
  code: string;
  type: string;
  value: number;
  minOrderValue: number;
  description: string;
  expiresAt: string | null;
  applicableProducts: any[];
  tags?: string[];
}

/* ─── Floating Petal Particle ────────────────────────────────────────────── */
function Petal({ index }: { index: number }) {
  const emojis = ['🌸', '🍓', '🌹', '🍌', '🌺'];
  const emoji = emojis[index % emojis.length];
  const startX = Math.random() * 100;
  const duration = 4 + Math.random() * 3;
  const delay = Math.random() * 2;
  const size = 12 + Math.random() * 10;

  return (
    <m.span
      className="absolute pointer-events-none select-none"
      style={{ left: `${startX}%`, top: '-20px', fontSize: size, zIndex: 0 }}
      initial={{ y: 0, opacity: 0, rotate: 0 }}
      animate={{
        y: 200,
        opacity: [0, 0.9, 0.9, 0],
        rotate: [0, 180, 360],
        x: [0, 20, -15, 10],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      aria-hidden="true"
    >
      {emoji}
    </m.span>
  );
}

/* ─── Teachers Day Popup ─────────────────────────────────────────────────── */
function TeachersDayPopup({ onClose }: { onClose: () => void }) {
  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 60, scale: 0.92 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring' as const, damping: 22, stiffness: 280 },
    },
    exit: {
      opacity: 0,
      y: 80,
      scale: 0.9,
      transition: { duration: 0.25, ease: 'easeIn' as const },
    },
  };

  const staggerContainer: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
  };

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  const products = [
    { emoji: '🍌', label: 'Banana Shampoo' },
    { emoji: '🌹', label: 'Rose Face & Body Wash' },
    { emoji: '🍓', label: 'Strawberry Face & Body Wash' },
  ];

  return (
    <m.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[400px] z-[90]"
      role="dialog"
      aria-modal="true"
      aria-label="Teachers Day Week special offer"
    >
      {/* Card — sheet on mobile, floating card on sm+ */}
      <div
        className="teachers-popup-card relative overflow-hidden flex flex-col"
        style={{
          background: 'linear-gradient(145deg, #FFF8F3 0%, #FFF1E8 50%, #FEF2F2 100%)',
          borderRadius: '28px 28px 0 0',
          border: '1px solid rgba(239,171,132,0.35)',
          borderBottom: 'none',
          boxShadow: '0 -8px 40px rgba(180,60,20,0.12), 0 -2px 12px rgba(180,60,20,0.06)',
        }}
      >

        {/* Floating petals */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Petal key={i} index={i} />
          ))}
        </div>

        {/* Warm gradient orbs */}
        <div
          className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.25) 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-4 -left-6 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(244,114,182,0.2) 0%, transparent 70%)' }}
          aria-hidden="true"
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(239,171,132,0.3)' }}
          aria-label="Close Teachers Day offer popup"
        >
          <X size={14} strokeWidth={2.5} style={{ color: '#7C3E2C' }} />
        </button>

        {/* Content */}
        <m.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="relative z-10 px-6 pt-7 pb-5"
        >
          {/* Eyebrow */}
          <m.div variants={fadeUp} className="flex items-center gap-2 mb-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-bold tracking-[0.18em] uppercase"
              style={{ background: 'linear-gradient(90deg,#FDDCBC,#FEC5C5)', color: '#7C2D12' }}
            >
              <Sparkles size={9} className="animate-pulse" aria-hidden="true" />
              Teachers Day Week
            </span>
          </m.div>

          {/* Headline */}
          <m.h2
            variants={fadeUp}
            className="font-serif leading-tight mb-1"
            style={{ fontSize: 'clamp(22px,5vw,26px)', color: '#3D0A05' }}
          >
            The Fruity &amp; Floral Edition
          </m.h2>

          {/* Subhead */}
          <m.p
            variants={fadeUp}
            className="font-sans mb-4"
            style={{ fontSize: '13px', color: '#7C3E2C', lineHeight: 1.55 }}
          >
            A little thank-you, for the ones who never stop teaching.
          </m.p>

          {/* Product pills */}
          <m.div variants={fadeUp} className="flex flex-col gap-2 mb-5">
            {products.map((p, i) => (
              <m.div
                key={p.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-3 rounded-2xl px-4 py-2.5"
                style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(239,171,132,0.25)', backdropFilter: 'blur(4px)' }}
              >
                <span className="text-base" aria-hidden="true">{p.emoji}</span>
                <span className="font-sans text-sm font-medium" style={{ color: '#3D0A05' }}>{p.label}</span>
              </m.div>
            ))}
          </m.div>

          {/* Urgency */}
          <m.p
            variants={fadeUp}
            className="font-sans text-[11px] text-center mb-4"
            style={{ color: '#B45309', fontWeight: 600, letterSpacing: '0.04em' }}
          >
            ⏰ Offer valid for 7 days · Ends soon
          </m.p>

          {/* CTA */}
          <m.div variants={fadeUp}>
            <Link
              to="/offers"
              onClick={onClose}
              className="block w-full text-center py-3.5 rounded-2xl font-sans font-bold text-sm tracking-wide transition-all duration-200 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #B45309 0%, #9A3412 50%, #7C2D12 100%)',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(124,45,18,0.35)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 24px rgba(124,45,18,0.4)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.transform = '';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 16px rgba(124,45,18,0.35)';
              }}
            >
              Shop the Edition
            </Link>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="font-sans text-[10px]" style={{ color: '#9CA3AF' }}>Use code</span>
              <span
                className="font-mono font-bold text-[11px] tracking-widest rounded-lg px-2 py-0.5"
                style={{ background: 'rgba(180,83,9,0.1)', color: '#92400E' }}
              >
                BLOOM4TEACHERS
              </span>
              <span className="font-sans text-[10px]" style={{ color: '#9CA3AF' }}>at checkout</span>
            </div>
          </m.div>
        </m.div>

        {/* Footer link */}
        <Link
          to="/offers"
          onClick={onClose}
          className="relative z-10 flex items-center justify-center gap-1.5 py-3.5 px-6 font-sans text-xs font-medium transition-colors duration-200 cursor-pointer"
          style={{
            borderTop: '1px solid rgba(239,171,132,0.25)',
            color: '#9A3412',
            background: 'rgba(255,255,255,0.4)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.7)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.4)'; }}
        >
          View full offer details <ChevronRight size={13} aria-hidden="true" />
        </Link>
      </div>
    </m.div>
  );
}

/* ─── Standard Offer Popup ───────────────────────────────────────────────── */
function StandardOfferPopup({
  offer,
  isWelcomeEligible,
  onClose,
}: {
  offer: Offer | null;
  isWelcomeEligible: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (code: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement('textarea');
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent
    }
  };

  return (
    <m.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-label="Special offer"
    >
      <div className="bg-white border-t sm:border border-silk-light rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative group">
        {/* Background flourish */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" aria-hidden="true" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 bg-gray-50/80 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors z-10 cursor-pointer"
          aria-label="Close offers popup"
        >
          <X size={16} />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag size={16} className="text-ruby-red" aria-hidden="true" />
            <span className="text-[10px] font-sans font-bold tracking-[0.2em] uppercase text-ruby-red">
              Special Offer
            </span>
          </div>

          {offer ? (
            <>
              <h2 className="font-serif text-xl text-dark mb-1">
                {offer.type === 'percentage' ? `${offer.value}% OFF` :
                  offer.type === 'flat' ? `₹${offer.value} OFF` : 'Free Shipping'}
              </h2>
              <p className="font-sans text-sm text-grey-beige mb-5 line-clamp-2">
                {offer.description || 'Apply this code at checkout to claim your discount.'}
              </p>

              <div className="flex gap-2">
                <div className="flex-1 bg-silk-light/40 border border-silk-light rounded-xl px-4 py-3 font-mono font-bold text-dark flex items-center justify-center tracking-widest text-sm">
                  {offer.code}
                </div>
                <button
                  onClick={() => handleCopy(offer.code)}
                  className="bg-dark-red hover:bg-ruby-red text-white px-5 py-3 rounded-xl transition-colors flex items-center justify-center shrink-0 cursor-pointer text-xs font-bold font-sans"
                  aria-label={copied ? 'Code copied!' : 'Copy code'}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </>
          ) : isWelcomeEligible ? (
            <>
              <h2 className="font-serif text-xl text-dark mb-1">10% OFF Your First Order</h2>
              <p className="font-sans text-sm text-grey-beige mb-5">
                Welcome to Bodilicious! Your welcome gift will be applied automatically at checkout.
              </p>
              <Link
                to="/shop"
                onClick={onClose}
                className="block w-full bg-dark-red hover:bg-ruby-red text-white text-center py-3 rounded-xl font-sans text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
              >
                Shop Now
              </Link>
            </>
          ) : null}
        </div>

        <Link
          to="/offers"
          onClick={onClose}
          className="bg-silk-light/20 border-t border-silk-light py-3 px-6 flex items-center justify-center gap-2 text-xs font-medium text-dark-red hover:text-ruby-red hover:bg-silk-light/40 transition-colors cursor-pointer"
        >
          View all offers <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </m.div>
  );
}

/* ─── Root Export ────────────────────────────────────────────────────────── */
/* ─── Helpers ────────────────────────────────────────────────────────────── */
/** Returns true if today falls within the Teachers Day campaign window (Sep 1–10). */
function isTeachersDayWindow(): boolean {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-indexed
  const day = now.getDate();
  return month === 9 && day >= 1 && day <= 10;
}

/** Local-storage keys scoped to the popups. */
const TD_DISMISSED_KEY = 'td_2026_sep_popup_v2';
const OFFERS_DISMISSED_KEY = 'offers_popup_dismissed';

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

function shouldShow(key: string) {
  const last = localStorage.getItem(key);
  if (!last) return true;
  return Date.now() - Number(last) > COOLDOWN_MS;
}

function markDismissed(key: string) {
  localStorage.setItem(key, String(Date.now()));
}

export default function OffersPopup() {
  const { user } = useApp();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [isTeachersDay, setIsTeachersDay] = useState(false);

  const welcomeOffer = (user as any)?.welcomeOffer;
  const isWelcomeEligible = welcomeOffer?.eligible === true;

  const suppressOn = ['/offers', '/cart', '/payment', '/checkout'];
  const isSuppressed =
    suppressOn.includes(location.pathname) || location.pathname.startsWith('/admin');

  useEffect(() => {
    if (isSuppressed) {
      setIsOpen(false);
      return;
    }

    // Teachers Day fast-path — show after short delay
    if (isTeachersDayWindow()) {
      if (shouldShow(TD_DISMISSED_KEY)) {
        setIsTeachersDay(true);
        const t = setTimeout(() => setIsOpen(true), 1500);
        return () => clearTimeout(t);
      }
    }

    // Standard offer slow-path
    if (!shouldShow(OFFERS_DISMISSED_KEY)) return;

    let timer: ReturnType<typeof setTimeout>;

    const fetchOffers = async () => {
      try {
        const res = await fetch(`${API}/api/v1/offers`);
        const data = await res.json();
        let activeOffer: Offer | null = null;
        let isTDCampaign = false;

        if (data.success && data.data.length > 0) {
          activeOffer = data.data[0];
          isTDCampaign =
            activeOffer?.tags?.includes('teachers-day') ||
            /teacher/i.test(activeOffer?.description || '') ||
            /fruity.*floral|floral.*fruity/i.test(activeOffer?.description || '');
        }

        // If the API returned a Teachers Day offer, but we recently dismissed the TD popup, skip it
        if (isTDCampaign && !shouldShow(TD_DISMISSED_KEY)) {
          activeOffer = null;
          isTDCampaign = false;
        }

        if (activeOffer) {
          setOffer(activeOffer);
          setIsTeachersDay(isTDCampaign);
        }

        if (activeOffer || isWelcomeEligible) {
          timer = setTimeout(() => setIsOpen(true), 3000);
        }
      } catch {
        if (isWelcomeEligible) {
          timer = setTimeout(() => setIsOpen(true), 3000);
        }
      }
    };

    fetchOffers();
    return () => clearTimeout(timer);
  }, [isSuppressed]);

  const handleClose = () => {
    setIsOpen(false);
    if (isTeachersDay) {
      markDismissed(TD_DISMISSED_KEY);
    } else {
      markDismissed(OFFERS_DISMISSED_KEY);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        isTeachersDay ? (
          <TeachersDayPopup onClose={handleClose} />
        ) : (
          <StandardOfferPopup
            offer={offer}
            isWelcomeEligible={isWelcomeEligible}
            onClose={handleClose}
          />
        )
      )}
    </AnimatePresence>
  );
}

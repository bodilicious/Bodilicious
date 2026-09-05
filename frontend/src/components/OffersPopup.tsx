import { useState, useEffect } from 'react';
import { m, AnimatePresence, Variants } from 'framer-motion';
import { X, ChevronRight, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

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
    hidden: { opacity: 0, scale: 0.92 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { type: 'spring' as const, damping: 22, stiffness: 280 },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.2, ease: 'easeIn' as const },
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
    { emoji: '🍌', label: 'Banana Shampoo', pid: 'BD-SHAM-BANANA' },
    { emoji: '🌹', label: 'Rose Face & Body Wash', pid: 'BD-CLE-ROSE' },
    { emoji: '🍓', label: 'Strawberry Face & Body Wash', pid: 'BD-CLE-STRAW' },
  ];

  return (
    <>
      {/* Backdrop */}
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[89] bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Teachers Day Week special offer"
      >
        <div
          className="teachers-popup-card relative overflow-hidden flex flex-col w-full max-w-[400px] max-h-[90vh]"
          style={{
            background: 'linear-gradient(145deg, #FFF8F3 0%, #FFF1E8 50%, #FEF2F2 100%)',
            borderRadius: '28px',
            border: '1px solid rgba(239,171,132,0.35)',
            boxShadow: '0 20px 60px rgba(180,60,20,0.18), 0 8px 24px rgba(180,60,20,0.1)',
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
              >
                <Link
                  to={`/product/${p.pid}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-2xl px-4 py-2.5 hover:scale-[1.02] transition-transform cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(239,171,132,0.25)', backdropFilter: 'blur(4px)' }}
                >
                  <span className="text-base" aria-hidden="true">{p.emoji}</span>
                  <span className="font-sans text-sm font-medium" style={{ color: '#3D0A05' }}>{p.label}</span>
                </Link>
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
          className="relative z-10 flex items-center justify-center gap-1.5 py-3.5 px-6 font-sans text-xs font-medium transition-colors duration-200 cursor-pointer rounded-b-[28px]"
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
    </>
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

export default function OffersPopup() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Only show the popup on the home page
  const isSuppressed = location.pathname !== '/';

  useEffect(() => {
    if (isSuppressed || !isTeachersDayWindow()) {
      setIsOpen(false);
      return;
    }

    const t = setTimeout(() => setIsOpen(true), 1500);
    return () => clearTimeout(t);
  }, [isSuppressed]);

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <TeachersDayPopup onClose={handleClose} />
      )}
    </AnimatePresence>
  );
}

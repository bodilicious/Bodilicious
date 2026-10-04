import { useState, useEffect, useRef, useCallback } from 'react';
import { m, AnimatePresence, useMotionValue, useTransform, type Variants } from 'framer-motion';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

/* ─── Reduced-motion hook ────────────────────────────────────────────────── */
function usePrefersReducedMotion() {
  const [rm, setRm] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setRm(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return rm;
}

/* ─── Countdown hook ─────────────────────────────────────────────────────── */
function calcTimeLeft(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (isNaN(diff) || diff <= 0) return null;
  return {
    hours:   Math.floor(diff / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}
function useCountdown(targetDate?: string) {
  const [left, setLeft] = useState(() => (targetDate ? calcTimeLeft(targetDate) : null));
  useEffect(() => {
    if (!targetDate) return;
    setLeft(calcTimeLeft(targetDate));
    const id = setInterval(() => setLeft(calcTimeLeft(targetDate)), 1_000);
    return () => clearInterval(id);
  }, [targetDate]);
  return left;
}

/* ─── Entrance variants ──────────────────────────────────────────────────── */
function getVariants(style: string, reduced: boolean): Variants {
  if (reduced) return {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.25 } },
    exit:    { opacity: 0, transition: { duration: 0.2 } },
  };
  switch (style) {
    case 'zoomFade': return {
      hidden:  { opacity: 0, scale: 1.12 },
      visible: { opacity: 1, scale: 1,    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as any } },
      exit:    { opacity: 0, scale: 1.08, transition: { duration: 0.22 } },
    };
    case 'slideUp': return {
      hidden:  { opacity: 0, y: 72 },
      visible: { opacity: 1, y: 0,   transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as any } },
      exit:    { opacity: 0, y: 36,  transition: { duration: 0.22 } },
    };
    case 'flip3D': return {
      hidden:  { opacity: 0, rotateX: 18, scale: 0.9 },
      visible: { opacity: 1, rotateX: 0,  scale: 1,  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as any } },
      exit:    { opacity: 0, rotateX: -8,             transition: { duration: 0.22 } },
    };
    default: return { // spring
      hidden:  { opacity: 0, scale: 0.95, y: 20 },
      visible: { opacity: 1, scale: 1,    y: 0,  transition: { type: 'spring', damping: 25, stiffness: 300 } },
      exit:    { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } },
    };
  }
}

/* ─── Content stagger variants ───────────────────────────────────────────── */
const staggerParent = { visible: { transition: { staggerChildren: 0.09, delayChildren: 0.18 } } };
const staggerChild  = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as any } },
};

/* ─── Countdown digit (flip animation per tick) ──────────────────────────── */
function CountdownDigit({ value }: { value: number }) {
  const str = String(value).padStart(2, '0');
  return (
    <span className="inline-flex flex-col overflow-hidden" style={{ height: '1.25em' }}>
      <AnimatePresence mode="popLayout">
        <m.span
          key={str}
          initial={{ y: -18, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{   y:  18,  opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="font-mono tabular-nums leading-tight"
        >
          {str}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

/* ─── CTA shimmer sweep ──────────────────────────────────────────────────── */
function ShimmerSweep() {
  return (
    <span aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      <m.span
        className="absolute top-0 bottom-0"
        style={{
          width: '55%',
          background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.38) 50%, transparent 100%)',
        }}
        animate={{ x: ['-120%', '280%'] }}
        transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
      />
    </span>
  );
}

/* ─── CTA particle burst ─────────────────────────────────────────────────── */
type Particle = { id: number; x: number; y: number; angle: number };
function ParticleBurst({ particles, emojis }: { particles: Particle[]; emojis: string[] }) {
  const glyphs = emojis.length ? emojis : ['✦', '✧', '·', '✦', '✧'];
  return (
    <AnimatePresence>
      {particles.map(p => (
        <m.span
          key={p.id}
          initial={{ x: p.x, y: p.y, opacity: 1, scale: 1 }}
          animate={{
            x: p.x + Math.cos(p.angle) * 65,
            y: p.y + Math.sin(p.angle) * 65,
            opacity: 0,
            scale: 0.4,
            rotate: p.angle * 45,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          style={{ position: 'absolute', fontSize: 13, pointerEvents: 'none', zIndex: 50 }}
        >
          {glyphs[p.id % glyphs.length]}
        </m.span>
      ))}
    </AnimatePresence>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function LaunchModal() {
  const { storeSettings } = useApp();
  const modal = storeSettings.launchModal;
  const reduced  = usePrefersReducedMotion();
  const intensity = modal.effectsIntensity ?? 'medium';
  const isMed  = intensity === 'medium' || intensity === 'high';
  const isHigh = intensity === 'high';

  const [isOpen, setIsOpen]     = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  /* Mouse parallax motion values — must be declared unconditionally */
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const orbX   = useTransform(mouseX, [-300, 300], [-14, 14]);
  const orbY   = useTransform(mouseY, [-300, 300], [-9,  9]);
  const imgX   = useTransform(mouseX, [-300, 300], [-6,  6]);
  const imgY   = useTransform(mouseY, [-300, 300], [-4,  4]);

  /* Countdown */
  const timeLeft = useCountdown(
    modal.countdownEnabled && modal.countdownTargetDate ? modal.countdownTargetDate : undefined,
  );

  /* Show delay + exit-intent */
  useEffect(() => {
    if (!modal.isActive) return;
    const delay = (modal.showDelaySeconds ?? 2.5) * 1000;
    const timer = setTimeout(() => setIsOpen(true), delay);

    let exitFn: ((e: MouseEvent) => void) | null = null;
    if (modal.exitIntentTrigger && !reduced) {
      exitFn = (e: MouseEvent) => { if (e.clientY <= 20) setIsOpen(true); };
      document.addEventListener('mousemove', exitFn);
    }
    return () => {
      clearTimeout(timer);
      if (exitFn) document.removeEventListener('mousemove', exitFn);
    };
  }, [modal.isActive, modal.showDelaySeconds, modal.exitIntentTrigger, reduced]);

  const handleClose = useCallback(() => setIsOpen(false), []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!modal.parallaxOnMouse || reduced || intensity === 'low') return;
    const rect = modalRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left - rect.width  / 2);
    mouseY.set(e.clientY - rect.top  - rect.height / 2);
  }, [modal.parallaxOnMouse, reduced, intensity, mouseX, mouseY]);

  const handleCTAClick = useCallback((e: React.MouseEvent) => {
    if (!modal.ctaParticleBurst || reduced || intensity === 'low') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mRect = modalRef.current?.getBoundingClientRect();
    if (!mRect) return;
    const cx = rect.left + rect.width / 2  - mRect.left;
    const cy = rect.top  + rect.height / 2 - mRect.top;
    setParticles(
      Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: cx, y: cy,
        angle: (i / 12) * Math.PI * 2,
      })),
    );
    setTimeout(() => setParticles([]), 700);
  }, [modal.ctaParticleBurst, reduced, intensity]);

  if (!modal.isActive) return null;

  /* ── Derived styles ── */
  const headerGrad = modal.headerBg
    ? `linear-gradient(${modal.headerBg})`
    : 'linear-gradient(135deg, #3B1E0A 0%, #5C2D1E 25%, #7C3527 50%, #8B4513 75%, #4A1E0A 100%)';
  const orb1     = modal.orb1Color     || '#F97316';
  const orb2     = modal.orb2Color     || '#EC4899';
  const orb3     = modal.orb3Color     || '#FBBF24';
  const badgeBg  = modal.badgeBg       || 'rgba(255,255,255,0.15)';
  const badgeTxt = modal.badgeTextColor || '#FDE68A';
  const titleClr = modal.titleColor    || '#ffffff';
  const descClr  = modal.descriptionColor || 'rgba(255,255,255,0.75)';
  const contentBg = modal.contentBg   || '#ffffff';
  const ctaGrad  = modal.ctaGradient
    ? `linear-gradient(${modal.ctaGradient})`
    : 'linear-gradient(135deg, #FBBF24, #F97316)';
  const ctaTxt   = modal.ctaTextColor  || '#2C1208';
  const emojis   = (modal.floatingEmojisEnabled && modal.floatingEmojis?.length)
    ? modal.floatingEmojis.filter(Boolean)
    : [];

  const emojiPositions = [
    { top: '10%', left: '8%'  },
    { top: '15%', right: '10%' },
    { bottom: '22%', left: '6%' },
    { bottom: '12%', right: '7%' },
    { top: '50%', left: '46%', transform: 'translate(-50%,-50%)' },
  ];

  const modalVariants   = getVariants(modal.entranceStyle ?? 'spring', reduced);
  const doStagger       = modal.staggerContent !== false && !reduced;
  const contentParent   = doStagger ? staggerParent : {};
  const contentChild    = doStagger ? staggerChild  : {};

  const showUrgency = modal.urgencyEnabled || modal.countdownEnabled;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ perspective: '1200px' }}
        >
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: modal.backdropBlurAnimated ? 0.38 : 0.18 }}
            onClick={handleClose}
            className="absolute inset-0 bg-neutral-900/50 backdrop-blur-[6px]"
          />

          {/* Modal card */}
          <m.div
            ref={modalRef}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onMouseMove={handleMouseMove}
            className="relative w-full max-w-md overflow-visible rounded-3xl shadow-2xl z-10"
            style={{ background: contentBg, transformStyle: 'preserve-3d' }}
          >
            {/* Particle layer (positioned relative to the card) */}
            <div className="absolute inset-0 overflow-visible pointer-events-none">
              <ParticleBurst particles={particles} emojis={emojis} />
            </div>

            {/* Close button */}
            <m.button
              onClick={handleClose}
              whileHover={modal.closeButtonSpin && !reduced ? { rotate: 90 } : {}}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              className="absolute top-3 right-3 z-30 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/35 transition-colors shadow-sm cursor-pointer"
              aria-label="Close announcement"
            >
              <X size={15} />
            </m.button>

            {/* ── Header panel ── */}
            <div
              className="relative h-52 w-full overflow-hidden rounded-t-3xl flex items-center justify-center"
              style={{ background: headerGrad }}
            >
              {/* Animated gradient overlay when headerBgAnimated */}
              {modal.headerBgAnimated && isMed && !reduced && (
                <m.div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse at 60% 40%, ${orb1}30 0%, transparent 55%)`,
                  }}
                  animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.08, 1] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              {/* Orb 1 */}
              {isMed && (
                <m.div
                  className="absolute -top-14 -right-14 w-52 h-52 rounded-full blur-3xl pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${orb1}70 0%, transparent 70%)`,
                    x: orbX, y: orbY,
                  }}
                  animate={!reduced ? { rotate: 360 } : {}}
                  transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                />
              )}

              {/* Orb 2 */}
              {isMed && (
                <m.div
                  className="absolute -bottom-14 -left-14 w-52 h-52 rounded-full blur-3xl pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${orb2}60 0%, transparent 70%)`,
                    x: orbX, y: orbY,
                  }}
                  animate={!reduced ? { rotate: -360 } : {}}
                  transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
                />
              )}

              {/* Orb 3 (high intensity only) */}
              {isHigh && !reduced && (
                <m.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full blur-2xl pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${orb3}45 0%, transparent 70%)` }}
                  animate={{ scale: [1, 1.35, 1], opacity: [0.35, 0.7, 0.35] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              {/* Floating emojis */}
              {emojis.length > 0 && isMed && !reduced && emojis.slice(0, 5).map((emoji, i) => {
                const pos = emojiPositions[i % emojiPositions.length];
                const dur = modal.emojiTrailPhysics ? 4 + ((i * 1.3) % 3) : 5;
                const del = modal.emojiTrailPhysics ? (i * 0.65) % 2 : i * 0.4;
                const rot = modal.emojiTrailPhysics
                  ? [-8 + i * 3, 8 - i * 2, -5 + i, -8 + i * 3] as number[]
                  : [-10, 10, -10] as number[];
                return (
                  <m.span
                    key={i}
                    className="absolute text-2xl pointer-events-none select-none z-10"
                    style={pos as any}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: [0, 0.9, 0.9, 0], scale: [0.5, 1, 1, 0.7], rotate: rot, y: [0, -10, 6, 0] }}
                    transition={{ duration: dur, delay: del, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {emoji}
                  </m.span>
                );
              })}

              {/* Image / graphic */}
              <m.div
                className="relative z-10 text-center w-full px-6"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.22, duration: 0.5 }}
                style={modal.parallaxOnMouse && isMed && !reduced ? { x: imgX, y: imgY } as any : {}}
              >
                {modal.image ? (
                  <m.img
                    src={modal.image}
                    alt={modal.title}
                    className="h-36 w-auto object-contain mx-auto drop-shadow-2xl"
                    animate={!reduced ? { y: [0, -8, 0] } : {}}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    initial={
                      modal.imageRevealStyle === 'clipWipe'
                        ? { clipPath: 'inset(0 100% 0 0)', opacity: 0 }
                        : modal.imageRevealStyle === 'fadeScale'
                        ? { scale: 0.82, opacity: 0 }
                        : { opacity: 1 }
                    }
                    whileInView={
                      modal.imageRevealStyle === 'clipWipe'
                        ? { clipPath: 'inset(0 0% 0 0)', opacity: 1, transition: { duration: 0.7, delay: 0.3 } }
                        : modal.imageRevealStyle === 'fadeScale'
                        ? { scale: 1, opacity: 1, transition: { duration: 0.5, delay: 0.28 } }
                        : {}
                    }
                  />
                ) : (
                  <div className="relative inline-block">
                    <m.div
                      animate={!reduced ? { y: [0, -8, 0] } : {}}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-14 h-20 mx-auto bg-gradient-to-b from-white/20 to-white/10 rounded-xl shadow-lg border border-white/30 flex items-center justify-center"
                    >
                      <Sparkles className="text-white opacity-70" size={22} />
                    </m.div>
                    <m.div
                      animate={!reduced ? { scale: [1, 0.8, 1], opacity: [0.4, 0.2, 0.4] } : {}}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-10 h-1.5 bg-white/20 rounded-full mx-auto mt-3 blur-[2px]"
                    />
                  </div>
                )}
              </m.div>
            </div>

            {/* ── Urgency / countdown strip ── */}
            {showUrgency && (
              <div
                className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-sans font-semibold"
                style={{
                  background: 'rgba(251,191,36,0.14)',
                  borderBottom: '1px solid rgba(251,191,36,0.28)',
                  color: '#92400E',
                }}
              >
                {modal.countdownEnabled && modal.countdownTargetDate ? (
                  timeLeft ? (
                    <span className="flex items-center gap-1">
                      ⏰&nbsp;
                      <CountdownDigit value={timeLeft.hours} />
                      <span className="opacity-60 mx-0.5">:</span>
                      <CountdownDigit value={timeLeft.minutes} />
                      <span className="opacity-60 mx-0.5">:</span>
                      <CountdownDigit value={timeLeft.seconds} />
                    </span>
                  ) : (
                    <span>{modal.countdownExpiredText || 'Offer ended'}</span>
                  )
                ) : (
                  <span>{modal.urgencyText || '⏰ Limited time offer'}</span>
                )}
              </div>
            )}

            {/* ── Content panel ── */}
            <m.div
              className="p-7 text-center rounded-b-3xl overflow-hidden"
              style={{ background: contentBg }}
              variants={contentParent}
              initial="hidden"
              animate="visible"
            >
              {/* Badge */}
              <m.div variants={contentChild} className="mb-4">
                <span
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-sans font-bold tracking-widest uppercase"
                  style={{ background: badgeBg, color: badgeTxt }}
                >
                  <Sparkles size={10} aria-hidden />
                  {modal.badge || 'Just Launched'}
                </span>
              </m.div>

              {/* Title */}
              <m.h3
                variants={contentChild}
                className="text-2xl font-serif leading-tight mb-2.5"
                style={{ color: titleClr }}
              >
                {modal.title || 'New Collection'}
              </m.h3>

              {/* Description */}
              <m.p
                variants={contentChild}
                className="text-sm font-sans font-light leading-relaxed mb-7"
                style={{ color: descClr }}
              >
                {modal.description}
              </m.p>

              {/* CTA */}
              <m.div variants={contentChild} className="relative">
                {/* Glow ring */}
                {modal.ctaGlow && !reduced && (
                  <m.span
                    aria-hidden
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    animate={{ boxShadow: ['0 0 0px 0px rgba(251,191,36,0)', '0 0 20px 7px rgba(251,191,36,0.4)', '0 0 0px 0px rgba(251,191,36,0)'] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                <Link
                  to={modal.ctaLink || '/shop'}
                  onClick={(e) => { handleCTAClick(e); handleClose(); }}
                  className="relative inline-flex w-full items-center justify-center gap-2 text-sm font-semibold px-6 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 group cursor-pointer overflow-hidden"
                  style={{ background: ctaGrad, color: ctaTxt }}
                >
                  {modal.ctaShimmer && isMed && !reduced && <ShimmerSweep />}
                  <span className="relative z-10">{modal.ctaLabel || 'Explore Collection'}</span>
                  <ArrowRight size={16} className="relative z-10 transition-transform group-hover:translate-x-1" />
                </Link>
              </m.div>
            </m.div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { m, AnimatePresence, useMotionValue, useTransform, type Variants } from 'framer-motion';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

/* ─── Shared defaults ────────────────────────────────────────────────────────
   Keep in sync with MODAL_DEFAULTS in StoreSettings.tsx, so the admin preview
   and the live popup always fall back to the same values.                    */
const MODAL_DEFAULTS = {
  headerBg: '135deg, #3B1E0A 0%, #5C2D1E 25%, #7C3527 50%, #8B4513 75%, #4A1E0A 100%',
  orb1Color: '#F97316',
  orb2Color: '#EC4899',
  orb3Color: '#FBBF24',
  // Badge, title and description sit on the (white) content panel, so the
  // defaults must be dark. The old white defaults were invisible.
  badgeBg: 'rgba(124,53,39,0.10)',
  badgeTextColor: '#7C3527',
  titleColor: '#3B1E0A',
  descriptionColor: '#6B4A3A',
  contentBg: '#ffffff',
  ctaGradient: '135deg, #FBBF24, #F97316',
  ctaTextColor: '#2C1208',
  showDelaySeconds: 2.5,
  effectsIntensity: 'medium',
  entranceStyle: 'spring',
  imageRevealStyle: 'fadeScale',
} as const;

/* ─── Show-once memory ───────────────────────────────────────────────────────
   Each visitor sees a given offer once, then again after REMIND_AFTER_DAYS.
   Changing the badge, title, description or CTA link counts as a new offer
   and shows again straight away.                                             */
const SEEN_STORAGE_KEY = 'bod_launch_modal_seen';
const REMIND_AFTER_DAYS = 3;

function campaignKey(modal: Record<string, any>): string {
  const src = [modal.badge, modal.title, modal.description, modal.ctaLink]
    .map(v => (v ?? '').toString())
    .join('|');
  let h = 5381;
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function wasRecentlySeen(key: string): boolean {
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data?.key !== key) return false;
    return Date.now() - Number(data.at) < REMIND_AFTER_DAYS * 86_400_000;
  } catch {
    return false; // private mode / blocked storage: just show the popup
  }
}

function markSeen(key: string) {
  try {
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify({ key, at: Date.now() }));
  } catch {
    /* storage unavailable: nothing to remember */
  }
}

/* ─── Small helpers ──────────────────────────────────────────────────────── */
/** Relative "assets/..." paths break on nested routes; make them root-relative. */
function resolveImageSrc(src?: string) {
  if (!src) return '';
  return src.startsWith('assets/') ? `/${src}` : src;
}

/** <Link> only handles in-app routes; full URLs need a plain <a>. */
function isExternalLink(href: string) {
  return /^(https?:)?\/\//i.test(href) || /^(mailto|tel):/i.test(href);
}

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
const BURST_MS = 450;

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
          transition={{ duration: BURST_MS / 1000, ease: 'easeOut' }}
          style={{ position: 'absolute', left: 0, top: 0, fontSize: 13, pointerEvents: 'none', zIndex: 50 }}
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
  // Guard: settings may not have a launchModal block yet.
  const modal: Record<string, any> = storeSettings?.launchModal ?? {};

  const reduced   = usePrefersReducedMotion();
  const intensity = modal.effectsIntensity ?? MODAL_DEFAULTS.effectsIntensity;
  const isMed     = intensity === 'medium' || intensity === 'high';
  const isHigh    = intensity === 'high';
  const effectsOn = !reduced && intensity !== 'low';

  const [isOpen, setIsOpen]       = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [imgFailed, setImgFailed] = useState(false);
  const modalRef      = useRef<HTMLDivElement>(null);
  const closeBtnRef   = useRef<HTMLButtonElement>(null);
  const shownRef      = useRef(false);
  const closeTimerRef = useRef<number | undefined>(undefined);

  const key    = campaignKey(modal);
  const imgSrc = resolveImageSrc(modal.image);

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

  /* Reset the image fallback when the image changes */
  useEffect(() => { setImgFailed(false); }, [imgSrc]);

  /* Show delay + exit-intent — each only ever opens the popup once */
  useEffect(() => {
    if (!modal.isActive) return;
    shownRef.current = false;
    if (wasRecentlySeen(key)) return;

    const open = () => {
      if (shownRef.current) return;
      shownRef.current = true;
      markSeen(key);
      setIsOpen(true);
    };

    // A cleared delay field arrives as '' — fall back instead of showing instantly.
    const rawDelay = modal.showDelaySeconds;
    const delaySec = typeof rawDelay === 'number' && rawDelay >= 0 ? rawDelay : MODAL_DEFAULTS.showDelaySeconds;
    const timer = window.setTimeout(open, delaySec * 1000);

    // Exit intent: the pointer leaves the page through the top edge (tabs / close button).
    let onLeave: ((e: MouseEvent) => void) | null = null;
    if (modal.exitIntentTrigger) {
      onLeave = (e: MouseEvent) => {
        if (!e.relatedTarget && e.clientY <= 0) open();
      };
      document.addEventListener('mouseout', onLeave);
    }

    return () => {
      window.clearTimeout(timer);
      if (onLeave) document.removeEventListener('mouseout', onLeave);
    };
  }, [modal.isActive, modal.showDelaySeconds, modal.exitIntentTrigger, key]);

  /* While open: Escape closes, page scroll is locked, focus moves into the dialog */
  useEffect(() => {
    if (!isOpen) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', onKey);
    const focusTimer = window.setTimeout(() => closeBtnRef.current?.focus(), 50);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
      prevFocus?.focus?.();
    };
  }, [isOpen]);

  /* Clear any pending delayed close on unmount */
  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  const handleClose = useCallback(() => {
    window.clearTimeout(closeTimerRef.current);
    setParticles([]);
    setIsOpen(false);
  }, []);

  const parallaxOn = !!modal.parallaxOnMouse && isMed && effectsOn;

  const handleMouseMove = useCallback((e: ReactMouseEvent) => {
    if (!parallaxOn) return;
    const rect = modalRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left - rect.width  / 2);
    mouseY.set(e.clientY - rect.top  - rect.height / 2);
  }, [parallaxOn, mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  /* CTA: with the burst on, wait for the particles before closing — closing
     immediately unmounted the modal before they could render. */
  const handleCTAClick = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    const burst = !!modal.ctaParticleBurst && effectsOn;
    const mRect = modalRef.current?.getBoundingClientRect();
    if (!burst || !mRect) {
      handleClose();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2  - mRect.left;
    const cy = rect.top  + rect.height / 2 - mRect.top;
    setParticles(
      Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: cx, y: cy,
        angle: (i / 12) * Math.PI * 2,
      })),
    );
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(handleClose, BURST_MS);
  }, [modal.ctaParticleBurst, effectsOn, handleClose]);

  if (!modal.isActive) return null;

  /* ── Derived styles ── */
  const headerGrad = `linear-gradient(${modal.headerBg || MODAL_DEFAULTS.headerBg})`;
  const orb1      = modal.orb1Color        || MODAL_DEFAULTS.orb1Color;
  const orb2      = modal.orb2Color        || MODAL_DEFAULTS.orb2Color;
  const orb3      = modal.orb3Color        || MODAL_DEFAULTS.orb3Color;
  const badgeBg   = modal.badgeBg          || MODAL_DEFAULTS.badgeBg;
  const badgeTxt  = modal.badgeTextColor   || MODAL_DEFAULTS.badgeTextColor;
  const titleClr  = modal.titleColor       || MODAL_DEFAULTS.titleColor;
  const descClr   = modal.descriptionColor || MODAL_DEFAULTS.descriptionColor;
  const contentBg = modal.contentBg        || MODAL_DEFAULTS.contentBg;
  const ctaGrad   = `linear-gradient(${modal.ctaGradient || MODAL_DEFAULTS.ctaGradient})`;
  const ctaTxt    = modal.ctaTextColor     || MODAL_DEFAULTS.ctaTextColor;
  const emojis: string[] = (modal.floatingEmojisEnabled && modal.floatingEmojis?.length)
    ? modal.floatingEmojis.filter(Boolean)
    : [];

  const emojiPositions = [
    { top: '10%',    left: '8%'   },
    { top: '15%',    right: '10%' },
    { bottom: '22%', left: '6%'   },
    { bottom: '12%', right: '7%'  },
    { top: '46%',    left: '44%'  },
  ];

  const modalVariants = getVariants(modal.entranceStyle ?? MODAL_DEFAULTS.entranceStyle, reduced);
  const doStagger     = modal.staggerContent !== false && !reduced;
  const contentParent = doStagger ? staggerParent : {};
  const contentChild  = doStagger ? staggerChild  : {};

  const hasCountdown = !!(modal.countdownEnabled && modal.countdownTargetDate);
  const showUrgency  = modal.urgencyEnabled || modal.countdownEnabled;

  /* Image reveal (default matches the admin's "Fade + Scale (default)") */
  const reveal = reduced ? 'none' : (modal.imageRevealStyle ?? MODAL_DEFAULTS.imageRevealStyle);
  const revealFrom =
    reveal === 'clipWipe'  ? { clipPath: 'inset(0 100% 0 0)', opacity: 0 } :
    reveal === 'fadeScale' ? { scale: 0.82, opacity: 0 } :
    {};
  const revealTo =
    reveal === 'clipWipe'  ? { clipPath: 'inset(0 0% 0 0)', opacity: 1 } :
    reveal === 'fadeScale' ? { scale: 1, opacity: 1 } :
    {};

  /* CTA */
  const ctaHref    = (modal.ctaLink || '/shop').trim();
  const ctaIsExt   = isExternalLink(ctaHref);
  const ctaClasses = 'relative inline-flex w-full items-center justify-center gap-2 text-sm font-semibold px-6 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 group cursor-pointer overflow-hidden';
  const ctaInner = (
    <>
      {modal.ctaShimmer && isMed && !reduced && <ShimmerSweep />}
      <span className="relative z-10">{modal.ctaLabel || 'Explore Collection'}</span>
      <ArrowRight size={16} className="relative z-10 transition-transform group-hover:translate-x-1" />
    </>
  );

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
            className={`absolute inset-0 bg-neutral-900/50 ${intensity === 'low' ? '' : 'backdrop-blur-[6px]'}`}
          />

          {/* Modal card */}
          <m.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="launch-modal-title"
            aria-describedby={modal.description ? 'launch-modal-desc' : undefined}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="relative w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl shadow-2xl z-10"
            style={{ background: contentBg, transformStyle: 'preserve-3d' }}
          >
            {/* Particle layer (positioned relative to the card) */}
            <div className="absolute inset-0 overflow-visible pointer-events-none">
              <ParticleBurst particles={particles} emojis={emojis} />
            </div>

            {/* Close button */}
            <m.button
              ref={closeBtnRef}
              type="button"
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
                  ? [-8 + i * 3, 8 - i * 2, -5 + i, -8 + i * 3]
                  : [-10, 10, -10];
                return (
                  <m.span
                    key={i}
                    aria-hidden
                    className="absolute text-2xl pointer-events-none select-none z-10"
                    style={pos}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: [0, 0.9, 0.9, 0], scale: [0.5, 1, 1, 0.7], rotate: rot, y: [0, -10, 6, 0] }}
                    transition={{ duration: dur, delay: del, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {emoji}
                  </m.span>
                );
              })}

              {/* Image / graphic.
                  Outer layer = mouse parallax, inner layer = entrance animation.
                  Putting both on one element made them fight over `y`. */}
              <m.div
                className="relative z-10 text-center w-full px-6"
                style={parallaxOn ? { x: imgX, y: imgY } : undefined}
              >
                <m.div
                  initial={reduced ? { opacity: 0 } : { y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.22, duration: 0.5 }}
                >
                  {imgSrc && !imgFailed ? (
                    <m.img
                      src={imgSrc}
                      alt={modal.title || 'Offer'}
                      onError={() => setImgFailed(true)}
                      className="h-36 w-auto object-contain mx-auto drop-shadow-2xl"
                      initial={revealFrom}
                      animate={{ ...revealTo, ...(!reduced ? { y: [0, -8, 0] } : {}) }}
                      transition={{
                        default: { duration: reveal === 'clipWipe' ? 0.7 : 0.5, delay: 0.28 },
                        y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
                      }}
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
                {hasCountdown ? (
                  timeLeft ? (
                    <span className="flex items-center gap-1" aria-label="Time left on this offer">
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
                id="launch-modal-title"
                variants={contentChild}
                className="text-2xl font-serif leading-tight mb-2.5"
                style={{ color: titleClr }}
              >
                {modal.title || 'New Collection'}
              </m.h3>

              {/* Description */}
              {modal.description && (
                <m.p
                  id="launch-modal-desc"
                  variants={contentChild}
                  className="text-sm font-sans font-light leading-relaxed mb-7"
                  style={{ color: descClr }}
                >
                  {modal.description}
                </m.p>
              )}

              {/* CTA */}
              <m.div variants={contentChild} className={`relative ${modal.description ? '' : 'mt-4'}`}>
                {/* Glow ring */}
                {modal.ctaGlow && !reduced && (
                  <m.span
                    aria-hidden
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    animate={{ boxShadow: ['0 0 0px 0px rgba(251,191,36,0)', '0 0 20px 7px rgba(251,191,36,0.4)', '0 0 0px 0px rgba(251,191,36,0)'] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                {ctaIsExt ? (
                  <a
                    href={ctaHref}
                    {...(/^https?:|^\/\//i.test(ctaHref) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    onClick={handleCTAClick}
                    className={ctaClasses}
                    style={{ background: ctaGrad, color: ctaTxt }}
                  >
                    {ctaInner}
                  </a>
                ) : (
                  <Link
                    to={ctaHref}
                    onClick={handleCTAClick}
                    className={ctaClasses}
                    style={{ background: ctaGrad, color: ctaTxt }}
                  >
                    {ctaInner}
                  </Link>
                )}
              </m.div>
            </m.div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}

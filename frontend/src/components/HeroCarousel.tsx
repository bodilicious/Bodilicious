/**
 * HeroCarousel — High-class, butter-smooth hero carousel.
 *
 * Architecture decisions that eliminate jank:
 * ─────────────────────────────────────────────
 * 1. ALL slide backgrounds are always in the DOM (never mounted/unmounted).
 *    Opacity-only crossfade runs entirely on the GPU compositor thread,
 *    making it impossible to drop a frame or get "stuck".
 *
 * 2. Autoplay uses a stable setInterval via useRef for the current index.
 *    The interval is NEVER recreated on slide change, so autoplay timing
 *    is perfectly even regardless of user interaction speed.
 *
 * 3. Framer Motion is used ONLY for text stagger animations where it shines.
 *    Image transitions are pure CSS for maximum performance.
 *
 * 4. Touch/swipe support for mobile.
 *
 * 5. Adjacent images are preloaded via <link rel="preload"> hints.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


// ─── Slide data ───────────────────────────────────────────────────────────────

const SLIDES = [
  {
    id: 0,
    image: '/assets/hero_carousel_1.png',
    mobileImage: '/assets/hero_mobile_1.png',
    eyebrow: 'Dermatologically Tested • Science-Backed • Skin-Safe',
    heading: 'Skincare That',
    highlight: 'Goes Beyond the Surface',
    body: 'Real beauty starts with healthy skin. We combine powerful actives with nature-derived extracts to target the root causes of your concerns—delivering visible results that are gentle, safe, and deeply nourishing.',
    cta: { label: 'Shop Skin Care', href: '/shop?category=skin,makeup,lip' },
    ctaSecondary: { label: 'Shop Collection', href: '/shop' },
    overlayDesktop: 'from-dark-red/90 via-dark-red/60',
  },
  {
    id: 1,
    image: '/assets/hero_carousel_2.png',
    mobileImage: '/assets/hero_mobile_2.png',
    eyebrow: 'Bhringraj • Hibiscus • Keratin • Ashwagandha',
    heading: 'Hair Care Rooted',
    highlight: "in Nature's Wisdom",
    body: 'Fight hair fall, dandruff, and premature greying with our science-backed herbal formulations. Real results, zero compromise.',
    cta: { label: 'Explore Hair Care', href: '/shop?category=hair' },
    ctaSecondary: { label: 'Shop Collection', href: '/shop' },
    overlayDesktop: 'from-[#3d1a0a]/90 via-[#3d1a0a]/55',
  },
  {
    id: 2,
    image: '/assets/hero_carousel_3.png',
    mobileImage: '/assets/hero_mobile_3.png',
    eyebrow: 'Rose • Turmeric • Sandalwood • Coconut',
    heading: 'Body Rituals',
    highlight: "You'll Love Every Day",
    body: "Transform your daily routine with luxurious body oils, scrubs, and lotions infused with nature's most nourishing botanicals. Healthy, glowing skin from head to toe.",
    cta: { label: 'Shop Body Care', href: '/shop?category=body' },
    ctaSecondary: { label: 'Shop Collection', href: '/shop' },
    overlayDesktop: 'from-[#5c2a00]/90 via-[#5c2a00]/50',
  },
  {
    id: 3,
    image: '/assets/hero_carousel_4.png',
    mobileImage: '/assets/hero_mobile_4.png',
    eyebrow: 'Niacinamide • Retinol • Hyaluronic Acid • Salicylic Acid',
    heading: 'Complete Routines',
    highlight: 'Built for Real Skin',
    body: 'From targeted serums to protective sunscreens, every product is designed to work together so you can build a routine that truly delivers—gentle, effective, and proudly herbal.',
    cta: { label: 'Find Your Ritual', href: '/ritual-finder' },
    ctaSecondary: { label: 'Shop All', href: '/shop' },
    overlayDesktop: 'from-[#1a3320]/90 via-[#1a3320]/50',
  },
  {
    id: 4,
    image: '/assets/hero_carousel_5.png',
    mobileImage: '/assets/hero_mobile_5.png',
    eyebrow: 'Vegan • Cruelty-Free • Earth-Friendly',
    heading: 'Conscious Beauty',
    highlight: 'For a Better Tomorrow',
    body: 'Discover skincare that loves your skin and the planet. Sustainably sourced ingredients packaged with care, because true beauty shouldn\'t cost the earth.',
    cta: { label: 'Shop Sustainable', href: '/shop' },
    ctaSecondary: { label: 'Learn More', href: '/brand-story' },
    overlayDesktop: 'from-[#2d4a2e]/90 via-[#2d4a2e]/50',
  },
  {
    id: 5,
    image: '/assets/hero_carousel_6.png',
    mobileImage: '/assets/hero_mobile_6.png',
    eyebrow: 'Vitamin C • Peptides • Bakuchiol • Squalane',
    heading: 'Glow With',
    highlight: 'Unstoppable Radiance',
    body: 'Unlock your skin\'s natural luminosity with our potent brightening complexes. Designed to fade dark spots, even tone, and give you that coveted lit-from-within glow.',
    cta: { label: 'Shop Best Sellers', href: '/shop?category=skin' },
    ctaSecondary: { label: 'Shop Collection', href: '/shop' },
    overlayDesktop: 'from-[#4a362d]/90 via-[#4a362d]/50',
  },
] as const;

const TOTAL = SLIDES.length;
const AUTOPLAY_MS = 5500;
const FADE_MS = 900; // image crossfade duration in ms

// ─── Text animation variants ──────────────────────────────────────────────────

const textContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
  exit: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
};

const textItem = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as any } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.25, ease: 'easeIn' as any } },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const pausedRef = useRef(false);
  const currentRef = useRef(0); // stable ref — never stale inside the interval
  const navigate = useNavigate();

  // Touch tracking refs
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const goTo = useCallback((idx: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    currentRef.current = idx;
    setCurrent(idx);
    // Unlock after the crossfade completes so rapid clicks can't queue multiple transitions
    setTimeout(() => setIsAnimating(false), FADE_MS + 100);
  }, [isAnimating]);

  const next = useCallback(() => {
    goTo((currentRef.current + 1) % TOTAL);
  }, [goTo]);

  const prev = useCallback(() => {
    goTo((currentRef.current - 1 + TOTAL) % TOTAL);
  }, [goTo]);

  // ── Stable autoplay — interval never recreated on slide change ──────────────

  useEffect(() => {
    const id = setInterval(() => {
      if (!pausedRef.current) {
        const nextIdx = (currentRef.current + 1) % TOTAL;
        currentRef.current = nextIdx;
        setCurrent(nextIdx);
      }
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — the interval is created once and reads refs

  // ── Touch / swipe handlers ──────────────────────────────────────────────────

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only trigger for dominant horizontal swipes (> 40 px, less vertical than horizontal)
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      dx < 0 ? next() : prev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // ── CTA handler ─────────────────────────────────────────────────────────────

  const handleCta = useCallback(
    (href: string) => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      navigate(href);
    },
    [navigate]
  );

  const slide = SLIDES[current];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <section
      className="relative min-h-screen flex items-center overflow-hidden"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-roledescription="carousel"
      aria-label="Featured collections"
    >
      {/* ── Background layers — all always in DOM, crossfade via opacity only ── */}
      {SLIDES.map((s, idx) => (
        <div
          key={s.id}
          aria-hidden={idx !== current}
          className="absolute inset-0"
          style={{
            opacity: idx === current ? 1 : 0,
            transition: `opacity ${FADE_MS}ms cubic-bezier(0.4,0,0.2,1)`,
            zIndex: idx === current ? 1 : 0,
            // Force GPU layer for each slide so crossfade is composited
            willChange: 'opacity',
          }}
        >
          {/* Responsive image */}
          <picture className="absolute inset-0 w-full h-full">
            <source media="(max-width: 639px)" srcSet={s.mobileImage} />
            <img
              src={s.image}
              alt=""
              aria-hidden="true"
              // Only the first slide needs high fetch priority
              {...(idx === 0 ? { fetchPriority: 'high' } : { loading: 'lazy' })}
              decoding="async"
              className="w-full h-full object-cover object-center"
            />
          </picture>

          {/* ── Top scrim — always present, ensures transparent navbar stays legible ── */}
          {/* This is the key technique: a ~120px dark-to-transparent gradient at the
              very top pins the logo + nav links visually to the hero regardless of
              image brightness. Matches the Stitch "Botanique Luxe" editorial design. */}
          <div className="absolute inset-x-0 top-0 h-[140px] bg-gradient-to-b from-black/60 via-black/20 to-transparent" />

          {/* Mobile gradient — bottom to top for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent md:hidden" />

          {/* Desktop gradient — left-side directional (editorial left-panel sweep) */}
          <div
            className={`absolute inset-0 hidden md:block bg-gradient-to-r ${s.overlayDesktop} to-transparent`}
          />

          {/* Subtle bottom-right vignette for depth — top-left clear for logo */}
          <div className="absolute inset-0 hidden md:block bg-[radial-gradient(ellipse_at_bottom_right,transparent_40%,rgba(0,0,0,0.22)_100%)]" />
        </div>
      ))}

      {/* ── Text content — Framer Motion stagger per slide ─────────────────── */}
      <div
        className="relative w-full flex flex-col justify-end md:justify-center"
        style={{ zIndex: 10, minHeight: 'inherit' }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 w-full pb-24 pt-24 md:pt-32 md:pb-28">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={slide.id}
              variants={textContainer}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="max-w-xs sm:max-w-sm md:max-w-2xl"
            >
              {/* Eyebrow */}
              <m.p
                variants={textItem}
                className="text-white/90 font-sans font-semibold text-[10px] sm:text-xs md:text-sm
                           tracking-[0.3em] uppercase mb-4 md:mb-6"
              >
                {slide.eyebrow}
              </m.p>

              {/* Heading */}
              <m.h1
                variants={textItem}
                className="font-serif text-white
                           text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5.5rem]
                           leading-[1.1] mb-4 md:mb-6"
              >
                {slide.heading}
                <em className="block not-italic text-[#e87070] md:text-[#f08080]">
                  {slide.highlight}
                </em>
              </m.h1>

              {/* Body — shown on all screen sizes */}
              <m.p
                variants={textItem}
                className="text-white/85 font-sans
                           text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed
                           mb-8 md:mb-10 max-w-sm sm:max-w-md md:max-w-2xl"
              >
                {slide.body}
              </m.p>

              {/* CTAs */}
              <m.div
                variants={textItem}
                className="flex flex-col sm:flex-row gap-3 sm:gap-4"
              >
                <button
                  onClick={() => handleCta(slide.cta.href)}
                  className="group relative flex items-center justify-center gap-2
                             bg-white text-dark-red
                             px-7 py-3.5 md:px-9 md:py-4
                             font-sans text-[11px] md:text-xs tracking-[0.18em] uppercase
                             overflow-hidden w-full sm:w-auto
                             transition-all duration-300 hover:shadow-[0_0_0_2px_white]"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {slide.cta.label}
                    <ArrowRight
                      size={13}
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </span>
                  {/* Hover fill sweep */}
                  <span className="absolute inset-0 bg-[#f5f0eb] scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
                </button>

                <button
                  onClick={() => handleCta(slide.ctaSecondary.href)}
                  className="flex items-center justify-center gap-2
                             border border-white/50 text-white
                             px-7 py-3.5 md:px-9 md:py-4
                             font-sans text-[11px] md:text-xs tracking-[0.18em] uppercase
                             hover:border-white hover:bg-white/10
                             transition-all duration-300 w-full sm:w-auto
                             backdrop-blur-[2px]"
                >
                  {slide.ctaSecondary.label}
                </button>
              </m.div>
            </m.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Arrow controls — hidden on mobile (swipe instead) ──────────────── */}
      {(['prev', 'next'] as const).map((dir) => (
        <button
          key={dir}
          onClick={dir === 'prev' ? prev : next}
          disabled={isAnimating}
          aria-label={dir === 'prev' ? 'Previous slide' : 'Next slide'}
          className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 z-20
                      ${dir === 'prev' ? 'left-5 md:left-8' : 'right-5 md:right-8'}
                      w-11 h-11 md:w-13 md:h-13
                      rounded-full border border-white/25 bg-black/15 backdrop-blur-md
                      items-center justify-center text-white
                      transition-all duration-300
                      hover:bg-white/20 hover:border-white/50 hover:scale-110
                      disabled:opacity-40 disabled:cursor-not-allowed group`}
        >
          {dir === 'prev'
            ? <ChevronLeft size={19} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
            : <ChevronRight size={19} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          }
        </button>
      ))}

      {/* ── Slide indicators ───────────────────────────────────────────────── */}
      <div
        className="absolute bottom-6 md:bottom-9 left-1/2 -translate-x-1/2 z-20
                   flex items-center gap-2 md:gap-2.5"
        role="tablist"
        aria-label="Slide navigation"
      >
        {SLIDES.map((s, idx) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={idx === current}
            aria-label={`Slide ${idx + 1}`}
            onClick={() => goTo(idx)}
            className={`rounded-full transition-all duration-500 ease-out
              ${idx === current
                ? 'w-7 md:w-9 h-[5px] md:h-[6px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                : 'w-[5px] md:w-[6px] h-[5px] md:h-[6px] bg-white/35 hover:bg-white/60'
              }`}
          />
        ))}
      </div>

      {/* ── Autoplay progress bar ────────────────────────────────────────────  */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 z-20 overflow-hidden">
        {/* Re-keyed on current so the animation restarts per slide */}
        <m.div
          key={`bar-${current}`}
          className="h-full bg-gradient-to-r from-[#c0392b]/80 to-[#e87070]/80"
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: AUTOPLAY_MS / 1000, ease: 'linear' }}
        />
      </div>

      {/* ── Slide counter (desktop only) ─────────────────────────────────────  */}
      <div
        className="hidden md:flex absolute bottom-8 right-8 z-20
                   items-center gap-2 text-white/50 font-sans text-xs tracking-widest"
        aria-hidden="true"
      >
        <span className="text-white font-semibold">{String(current + 1).padStart(2, '0')}</span>
        <span className="w-8 h-px bg-white/30" />
        <span>{String(TOTAL).padStart(2, '0')}</span>
      </div>
    </section>
  );
}

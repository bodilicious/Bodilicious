import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EditableBlock from './EditableBlock';
import ImageUploadField from './ImageUploadField';

const FALLBACK_SLIDES = [
  {
    id: 's1',
    imageUrl: '/assets/hero_carousel_1.webp',
    mobileImage: '/assets/hero_mobile_1.webp',
    eyebrow: 'Dermatologically Tested • Science-Backed • Skin-Safe',
    title: 'Skincare That',
    highlight: 'Goes Beyond the Surface',
    subtitle: 'Real beauty starts with healthy skin. We combine powerful actives with nature-derived extracts to target the root causes of your concerns—delivering visible results that are gentle, safe, and deeply nourishing.',
    ctaText: 'Shop Skin Care',
    ctaLink: '/shop?category=skin,makeup,lip',
    ctaSecondaryText: 'Shop Collection',
    ctaSecondaryLink: '/shop',
    overlayDesktop: 'from-dark-red/90 via-dark-red/60',
  },
  {
    id: 's2',
    imageUrl: '/assets/hero_carousel_2.webp',
    mobileImage: '/assets/hero_mobile_2.webp',
    eyebrow: 'Bhringraj • Hibiscus • Keratin • Ashwagandha',
    title: 'Hair Care Rooted',
    highlight: "in Nature's Wisdom",
    subtitle: 'Fight hair fall, dandruff, and premature greying with our science-backed formulations. Real results, zero compromise.',
    ctaText: 'Explore Hair Care',
    ctaLink: '/shop?category=hair',
    ctaSecondaryText: 'Shop Collection',
    ctaSecondaryLink: '/shop',
    overlayDesktop: 'from-[#3d1a0a]/90 via-[#3d1a0a]/55',
  },
  {
    id: 's3',
    imageUrl: '/assets/hero_carousel_3.webp',
    mobileImage: '/assets/hero_mobile_3.webp',
    eyebrow: 'Rose • Turmeric • Sandalwood • Coconut',
    title: 'Body Rituals',
    highlight: "You'll Love Every Day",
    subtitle: "Transform your daily routine with luxurious body oils, scrubs, and lotions infused with nature's most nourishing botanicals. Healthy, glowing skin from head to toe.",
    ctaText: 'Shop Body Care',
    ctaLink: '/shop?category=body',
    ctaSecondaryText: 'Shop Collection',
    ctaSecondaryLink: '/shop',
    overlayDesktop: 'from-[#5c2a00]/90 via-[#5c2a00]/50',
  },
  {
    id: 's4',
    imageUrl: '/assets/hero_carousel_4.webp',
    mobileImage: '/assets/hero_mobile_4.webp',
    eyebrow: 'Niacinamide • Retinol • Hyaluronic Acid • Salicylic Acid',
    title: 'Complete Routines',
    highlight: 'Built for Real Skin',
    subtitle: 'From targeted serums to protective sunscreens, every product is designed to work together so you can build a routine that truly delivers—gentle, effective, and proudly.',
    ctaText: 'Find Your Ritual',
    ctaLink: '/ritual-finder',
    ctaSecondaryText: 'Shop All',
    ctaSecondaryLink: '/shop',
    overlayDesktop: 'from-[#1a3320]/90 via-[#1a3320]/50',
  },
  {
    id: 's5',
    imageUrl: '/assets/hero_carousel_5.webp',
    mobileImage: '/assets/hero_mobile_5.webp',
    eyebrow: 'Vegan • Cruelty-Free • Earth-Friendly',
    title: 'Conscious Beauty',
    highlight: 'For a Better Tomorrow',
    subtitle: 'Discover skincare that loves your skin and the planet. Sustainably sourced ingredients packaged with care, because true beauty shouldn\'t cost the earth.',
    ctaText: 'Shop Sustainable',
    ctaLink: '/shop',
    ctaSecondaryText: 'Learn More',
    ctaSecondaryLink: '/brand-story',
    overlayDesktop: 'from-[#2d4a2e]/90 via-[#2d4a2e]/50',
  },
  {
    id: 's6',
    imageUrl: '/assets/hero_carousel_6.webp',
    mobileImage: '/assets/hero_mobile_6.webp',
    eyebrow: 'Vitamin C • Peptides • Bakuchiol • Squalane',
    title: 'Glow With',
    highlight: 'Unstoppable Radiance',
    subtitle: 'Unlock your skin\'s natural luminosity with our potent brightening complexes. Designed to fade dark spots, even tone, and give you that coveted lit-from-within glow.',
    ctaText: 'Shop Best Sellers',
    ctaLink: '/shop?category=skin',
    ctaSecondaryText: 'Shop Collection',
    ctaSecondaryLink: '/shop',
    overlayDesktop: 'from-[#4a362d]/90 via-[#4a362d]/50',
  },
];

const AUTOPLAY_MS = 5500;
const FADE_MS = 900;

const textContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
  exit: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
};

interface HeroCarouselProps {
  slides?: any[];
  isEditing?: boolean;
  onSlidesChange?: (newSlides: any[]) => void;
}

export default function HeroCarousel({ slides: propSlides, isEditing, onSlidesChange }: HeroCarouselProps) {
  const isPlaceholderSlides =
    !propSlides ||
    propSlides.length === 0 ||
    (propSlides.length === 1 && propSlides[0]?.seeded);

  const rawActiveSlides = isPlaceholderSlides && !isEditing ? FALLBACK_SLIDES : (propSlides || []);
  const activeSlides = rawActiveSlides.map(slide => ({
    ...slide,
    imageUrl: slide.imageUrl ? slide.imageUrl.replace('.png', '.webp') : slide.imageUrl,
    mobileImage: slide.mobileImage ? slide.mobileImage.replace('.png', '.webp') : slide.mobileImage
  }));
  const TOTAL = activeSlides?.length || 0;

  const [current, setCurrent] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const [isAnimating, setIsAnimating] = useState(false);
  const pausedRef = useRef(false);
  const currentRef = useRef(0);
  const navigate = useNavigate();

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const goTo = useCallback((idx: number) => {
    if (isAnimating || isEditing) return;
    setIsAnimating(true);
    currentRef.current = idx;
    setCurrent(idx);
    setVisited(prev => new Set(prev).add(idx));
    setTimeout(() => setIsAnimating(false), FADE_MS + 100);
  }, [isAnimating, isEditing]);

  const next = useCallback(() => {
    goTo((currentRef.current + 1) % TOTAL);
  }, [goTo, TOTAL]);

  const prev = useCallback(() => {
    goTo((currentRef.current - 1 + TOTAL) % TOTAL);
  }, [goTo, TOTAL]);

  useEffect(() => {
    if (isEditing) return;
    const id = setInterval(() => {
      if (!pausedRef.current) {
        const nextIdx = (currentRef.current + 1) % TOTAL;
        currentRef.current = nextIdx;
        setCurrent(nextIdx);
        setVisited(prev => new Set(prev).add(nextIdx));
      }
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [isEditing, TOTAL]);

  useEffect(() => {
    if (current >= TOTAL) {
      setCurrent(Math.max(0, TOTAL - 1));
      currentRef.current = Math.max(0, TOTAL - 1);
      setVisited(prev => new Set(prev).add(Math.max(0, TOTAL - 1)));
    }
  }, [TOTAL, current]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!e.touches || e.touches.length === 0) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || isEditing) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      dx < 0 ? next() : prev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const handleCta = useCallback(
    (href: string) => {
      if (isEditing) return;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      navigate(href);
    },
    [navigate, isEditing]
  );

  if (TOTAL === 0) {
    if (isEditing) {
      return (
        <section className="relative min-h-[50vh] flex items-center justify-center bg-slate-50 ring-2 ring-blue-400">
          <button 
            onClick={() => {
              if (onSlidesChange) {
                onSlidesChange([{ 
                  _id: Array.from({length:24}, () => Math.floor(Math.random()*16).toString(16)).join(''), 
                  imageUrl: '', 
                  eyebrow: '',
                  title: 'New Slide', 
                  highlight: '',
                  subtitle: 'Description', 
                  ctaText: 'Shop', 
                  ctaLink: '/',
                  overlayDesktop: 'from-dark-red/90 via-dark-red/60',
                }]);
              }
            }}
            className="flex items-center gap-2 px-6 py-3 bg-white text-dark-red shadow-sm border border-slate-200 rounded-full font-sans uppercase tracking-widest text-sm hover:bg-slate-50 transition-colors"
          >
            <Plus size={18} /> Add First Slide
          </button>
        </section>
      );
    }
    return null;
  }

  const slide = activeSlides[current];
  if (!slide) return null;

  const handleTextChange = (field: string, value: string) => {
    if (!onSlidesChange) return;
    const newSlides = [...activeSlides];
    newSlides[current] = { ...newSlides[current], [field]: value };
    onSlidesChange(newSlides);
  };

  return (
    <section
      className={`relative min-h-screen flex items-center overflow-hidden ${isEditing ? 'ring-2 ring-blue-400' : ''}`}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {isEditing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-white shadow-xl rounded-full px-6 py-3 flex items-center gap-4">
          <button onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0} className="text-slate-400 hover:text-dark-red disabled:opacity-30"><ChevronLeft size={20} /></button>
          <span className="font-sans text-xs font-bold text-slate-700 uppercase tracking-widest whitespace-nowrap">Slide {current + 1} / {TOTAL}</span>
          <button onClick={() => setCurrent(Math.min(TOTAL - 1, current + 1))} disabled={current === TOTAL - 1} className="text-slate-400 hover:text-dark-red disabled:opacity-30"><ChevronRight size={20} /></button>
          <div className="w-px h-4 bg-slate-200" />
          <button 
            onClick={() => {
              if (onSlidesChange) {
                const newSlides = [...activeSlides, { 
                  _id: Array.from({length:24}, () => Math.floor(Math.random()*16).toString(16)).join(''), 
                  imageUrl: '', 
                  eyebrow: '',
                  title: 'New Slide', 
                  highlight: '',
                  subtitle: 'Description', 
                  ctaText: 'Shop', 
                  ctaLink: '/',
                  overlayDesktop: 'from-dark-red/90 via-dark-red/60'
                }];
                onSlidesChange(newSlides);
                setCurrent(newSlides.length - 1);
                setVisited(prev => new Set(prev).add(newSlides.length - 1));
              }
            }}
            className="flex items-center gap-1 text-xs font-sans text-green-600 hover:text-green-700 whitespace-nowrap font-bold uppercase tracking-widest"
          >
            <Plus size={16} /> Add Slide
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <button 
            onClick={() => {
              if (TOTAL <= 1) return alert('Cannot delete the last slide.');
              if (onSlidesChange) {
                const newSlides = activeSlides.filter((_, i) => i !== current);
                onSlidesChange(newSlides);
                setCurrent(Math.min(current, newSlides.length - 1));
              }
            }}
            className="text-xs font-sans text-red-500 hover:text-red-700 whitespace-nowrap uppercase tracking-widest font-bold"
          >
            Delete
          </button>
        </div>
      )}

      {activeSlides.map((s, idx) => (
        <div
          key={s._id || s.id || idx}
          className="absolute inset-0"
          style={{
            opacity: idx === current ? 1 : 0,
            transition: isEditing ? 'none' : `opacity ${FADE_MS}ms cubic-bezier(0.4,0,0.2,1)`,
            zIndex: idx === current ? 1 : 0,
            pointerEvents: idx === current ? 'auto' : 'none'
          }}
        >
          {isEditing && idx === current ? (
            <ImageUploadField
              isEditing={true}
              imageUrl={s.imageUrl}
              imageAlt={s.imageAlt || ''}
              onImageChange={(url) => handleTextChange('imageUrl', url)}
              onAltChange={(alt) => handleTextChange('imageAlt', alt)}
              className="absolute inset-0 w-full h-full object-cover"
              containerClassName="absolute inset-0"
            />
          ) : visited.has(idx) ? (
            <picture className="absolute inset-0 w-full h-full">
              <img src={s.imageUrl} alt={s.imageAlt} className="w-full h-full object-cover object-center" loading={idx === 0 ? "eager" : "lazy"} />
            </picture>
          ) : null}


          <div className="absolute inset-x-0 top-0 h-[140px] bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent md:hidden pointer-events-none" />
          <div className={`absolute inset-0 hidden md:block bg-gradient-to-r ${s.overlayDesktop || 'from-[#1a3320]/90 via-[#1a3320]/50'} to-transparent pointer-events-none`} />
        </div>
      ))}

      <div className="relative w-full flex flex-col justify-end md:justify-center pointer-events-none" style={{ zIndex: 10, minHeight: 'inherit' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 w-full pb-24 pt-24 md:pt-32 md:pb-28">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={slide._id || slide.id || current}
              variants={isEditing ? undefined : textContainer}
              initial={isEditing ? false : "hidden"}
              animate={isEditing ? undefined : "visible"}
              exit={isEditing ? undefined : "exit"}
              className="max-w-xs sm:max-w-sm md:max-w-2xl pointer-events-auto"
            >
              <EditableBlock
                isEditing={!!isEditing}
                value={slide.eyebrow || 'New Slide Eyebrow'}
                onChange={(v) => handleTextChange('eyebrow', v)}
                tagName="p"
                className="text-white/90 font-sans font-semibold text-[10px] sm:text-xs md:text-sm tracking-[0.3em] uppercase mb-4 md:mb-6 block"
              />

              <h1 className="font-serif text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5.5rem] leading-[1.1] mb-4 md:mb-6 flex flex-col">
                <EditableBlock
                  isEditing={!!isEditing}
                  value={slide.title || 'New Title'}
                  onChange={(v) => handleTextChange('title', v)}
                  tagName="span"
                />
                <EditableBlock
                  isEditing={!!isEditing}
                  value={slide.highlight || 'Highlight Text'}
                  onChange={(v) => handleTextChange('highlight', v)}
                  tagName="em"
                  className="not-italic text-[#e87070] md:text-[#f08080]"
                />
              </h1>

              <EditableBlock
                isEditing={!!isEditing}
                value={slide.subtitle || slide.body || 'Slide body text...'}
                onChange={(v) => handleTextChange('subtitle', v)}
                tagName="p"
                multiline
                className="text-white/85 font-sans text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed mb-8 md:mb-10 max-w-sm sm:max-w-md md:max-w-2xl block"
              />

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button onClick={() => handleCta(slide.ctaLink)} className="group relative flex items-center justify-center gap-2 bg-white text-dark-red px-7 py-3.5 md:px-9 md:py-4 font-sans text-[11px] md:text-xs tracking-[0.18em] uppercase overflow-hidden w-full sm:w-auto transition-all duration-300 hover:shadow-[0_0_0_2px_white]">
                  <span className="relative z-10 flex items-center gap-2">
                    <EditableBlock
                      isEditing={!!isEditing} value={slide.ctaText || slide.cta?.label || 'Shop Now'}
                      onChange={(v) => handleTextChange('ctaText', v)} tagName="span"
                    />
                    <ArrowRight size={13} className="transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </button>
                {(slide.ctaSecondaryText || slide.ctaSecondary?.label) && (
                  <button onClick={() => handleCta(slide.ctaSecondaryLink || slide.ctaSecondary?.href || '/shop')} className="group relative flex items-center justify-center gap-2 bg-transparent text-white border border-white/30 hover:border-white/80 hover:bg-white/10 px-7 py-3.5 md:px-9 md:py-4 font-sans text-[11px] md:text-xs tracking-[0.18em] uppercase overflow-hidden w-full sm:w-auto transition-all duration-300">
                    <span className="relative z-10 flex items-center gap-2">
                      <EditableBlock
                        isEditing={!!isEditing} value={slide.ctaSecondaryText || slide.ctaSecondary?.label}
                        onChange={(v) => handleTextChange('ctaSecondaryText', v)} tagName="span"
                      />
                    </span>
                  </button>
                )}
              </div>
            </m.div>
          </AnimatePresence>
        </div>
      </div>

      {!isEditing && (['prev', 'next'] as const).map((dir) => (
        <button
          key={dir} onClick={dir === 'prev' ? prev : next} disabled={isAnimating}
          className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 z-20 ${dir === 'prev' ? 'left-5 md:left-8' : 'right-5 md:right-8'} w-11 h-11 md:w-13 md:h-13 rounded-full border border-white/25 bg-black/15 backdrop-blur-md items-center justify-center text-white transition-all duration-300 hover:bg-white/20 hover:border-white/50 hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed group`}
        >
          {dir === 'prev' ? <ChevronLeft size={19} /> : <ChevronRight size={19} />}
        </button>
      ))}

      {!isEditing && (
        <div className="absolute bottom-6 md:bottom-9 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 md:gap-2.5">
          {activeSlides.map((s, idx) => (
            <button
              key={s._id || s.id || idx} onClick={() => goTo(idx)}
              className={`rounded-full transition-all duration-500 ease-out ${idx === current ? 'w-7 md:w-9 h-[5px] md:h-[6px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'w-[5px] md:w-[6px] h-[5px] md:h-[6px] bg-white/35 hover:bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}


import { memo, useState } from 'react';
import { Heart, ShoppingBag, Eye } from 'lucide-react';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import { useCurrency } from '../hooks/useCurrency';
import { Link } from 'react-router-dom';
import StarRating from './StarRating';
import { m, useReducedMotion, AnimatePresence } from 'framer-motion';
import { hoverLift, hoverLiftSubtle } from '../utils/motionTokens';

interface ProductCardProps {
  product: Product;
  badge?: 'bestseller' | 'new' | 'sale';
  concerns?: string[];        // e.g. ['acne', 'oily skin']
  salePercent?: number;       // e.g. 20 → "20% off"
}

const CONCERN_COLORS: Record<string, { bg: string; text: string }> = {
  acne:          { bg: 'bg-rose-50',   text: 'text-rose-600' },
  'dark circles':{ bg: 'bg-violet-50', text: 'text-violet-600' },
  pigmentation:  { bg: 'bg-amber-50',  text: 'text-amber-700' },
  hydration:     { bg: 'bg-sky-50',    text: 'text-sky-600' },
  aging:         { bg: 'bg-teal-50',   text: 'text-teal-700' },
  brightening:   { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  'oily skin':   { bg: 'bg-green-50',  text: 'text-green-700' },
  default:       { bg: 'bg-stone-100', text: 'text-stone-500' },
};

const BADGE_CONFIG = {
  bestseller: { label: 'Bestseller', className: 'bg-dark-red/90 text-silk' },
  new:        { label: 'New',        className: 'bg-emerald-700/90 text-white' },
  sale:       { label: 'Sale',       className: 'bg-indian-red/90 text-white' },
};

export default memo(function ProductCard({
  product,
  badge,
  concerns = [],
  salePercent,
}: ProductCardProps) {
  const { addToCart, toggleWishlist, isInWishlist } = useApp();
  const { formatPrice, userCurrency } = useCurrency();
  const inWishlist = isInWishlist(product.pid);
  const [addedFlash, setAddedFlash] = useState(false);

  const shouldReduceMotion = useReducedMotion();
  const lift     = shouldReduceMotion ? {} : hoverLift;
  const subtleLift = shouldReduceMotion ? {} : hoverLiftSubtle;

  const CATEGORY_LABELS: Record<string, string> = {
    skin:   'Skin Care',
    hair:   'Hair Care',
    body:   'Body Care',
    lip:    'Lip Care',
    makeup: 'Makeup',
    other:  'Wellness',
  };
  const categoryLabel = CATEGORY_LABELS[product.category] ?? 'Beauty';

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock === 0) return;
    addToCart(product);
    setAddedFlash(true);
    setTimeout(() => setAddedFlash(false), 1400);
  }

  return (
    <m.div
      className="group relative bg-white transition-all duration-500 hover:shadow-[0_20px_40px_-5px_rgba(139,0,0,0.08)] rounded-sm"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 420px' }}
      whileHover={lift}
      layout
    >
      {/* ── Image area ─────────────────────────────────────── */}
      <Link
        to={`/product/${product.pid}`}
        className="relative overflow-hidden cursor-pointer bg-silk-light aspect-[9/16] block rounded-sm"
      >
        <m.img
          whileHover={subtleLift}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          src={product.images[0]}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover scale-100 group-hover:scale-105 transition-transform duration-700 ease-out mix-blend-multiply"
        />

        {/* Hover tint */}
        <div className="absolute inset-0 bg-dark-red/0 group-hover:bg-dark-red/10 transition-colors duration-500" />

        {/* ── Top-left badge (only one shown, priority: stock > explicit) ── */}
        {product.stock === 0 ? (
          <div className="absolute top-3 left-3 bg-dark-red/90 backdrop-blur-sm text-silk text-[9px] font-sans tracking-widest uppercase px-2.5 py-1 rounded-sm shadow-sm">
            Sold out
          </div>
        ) : product.stock <= 5 ? (
          <div className="absolute top-3 left-3 bg-indian-red/90 backdrop-blur-sm text-white text-[9px] font-sans tracking-widest uppercase px-2.5 py-1 rounded-sm shadow-sm">
            Only {product.stock} left
          </div>
        ) : badge ? (
          <div className={`absolute top-3 left-3 backdrop-blur-sm text-[9px] font-sans tracking-widest uppercase px-2.5 py-1 rounded-sm shadow-sm ${BADGE_CONFIG[badge].className}`}>
            {BADGE_CONFIG[badge].label}
          </div>
        ) : null}

        {/* ── Sale ribbon ── */}
        {salePercent && product.stock > 0 && (
          <div className="absolute top-3 right-12 bg-indian-red/90 backdrop-blur-sm text-white text-[9px] font-sans tracking-widest uppercase px-2 py-1 rounded-sm shadow-sm">
            -{salePercent}%
          </div>
        )}

        {/* ── Wishlist button ── */}
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWishlist(product); }}
          aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-md ${
            inWishlist
              ? 'bg-ruby-red text-white shadow-md scale-105'
              : 'bg-white/80 text-dark-red/50 hover:text-ruby-red hover:bg-white/95 shadow-sm hover:scale-105'
          }`}
        >
          <Heart
            size={15}
            fill={inWishlist ? 'currentColor' : 'none'}
            className={inWishlist ? 'animate-pulse duration-300' : ''}
          />
        </button>

        {/* ── Quick view pill — appears mid-hover before CTA slides up ── */}
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100 pointer-events-none">
          <span className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm text-dark-red text-[10px] font-sans tracking-widest uppercase px-3 py-1.5 rounded-full shadow-sm whitespace-nowrap">
            <Eye size={11} />
            Quick view
          </span>
        </div>

        {/* ── Add to bag CTA ── */}
        <AnimatePresence>
          <button
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            className={`absolute bottom-0 left-0 right-0 backdrop-blur-md text-silk py-3.5 flex items-center justify-center gap-2 text-[11px] font-sans tracking-[0.2em] uppercase translate-y-full group-hover:translate-y-0 transition-all duration-500 ease-[0.16,1,0.3,1] disabled:opacity-50 disabled:cursor-not-allowed ${
              addedFlash ? 'bg-emerald-700' : 'bg-dark-red/95 hover:bg-ruby-red'
            }`}
          >
            <ShoppingBag size={14} />
            {product.stock === 0 ? 'Sold out' : addedFlash ? 'Added!' : 'Add to bag'}
          </button>
        </AnimatePresence>
      </Link>

      {/* ── Info area ──────────────────────────────────────── */}
      <div className="pt-3 pb-2 px-1 space-y-1.5">
        <Link to={`/product/${product.pid}`} className="block">
          <p className="text-xs font-sans tracking-wide uppercase text-gray-500 font-medium">
            {categoryLabel}
          </p>
          <h3 className="font-serif text-dark-red text-sm leading-snug mt-0.5 group-hover:text-ruby-red transition-colors line-clamp-2">
            {product.name}
          </h3>
        </Link>

        {/* Skin concern tags */}
        {concerns.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {concerns.slice(0, 3).map(c => {
              const col = CONCERN_COLORS[c.toLowerCase()] ?? CONCERN_COLORS.default;
              return (
                <span
                  key={c}
                  className={`text-[9px] font-sans tracking-wide uppercase px-2 py-0.5 rounded-sm ${col.bg} ${col.text}`}
                >
                  {c}
                </span>
              );
            })}
          </div>
        )}

        {/* Rating + price */}
        <div className="flex items-center justify-between pt-0.5">
          <StarRating rating={product.rating} count={product.ratingCount} size={12} />
          <div className="flex items-baseline gap-1.5">
            {salePercent && (
              <span className="text-[11px] font-sans text-grey-beige line-through">
                {formatPrice(Math.round(product.price / (1 - salePercent / 100)))}
              </span>
            )}
            <span className="font-sans font-semibold text-dark-red text-sm">
              {formatPrice(product.price)}
              {userCurrency === 'USD' && <span className="text-[10px] ml-0.5 opacity-60">*</span>}
            </span>
          </div>
        </div>
      </div>
    </m.div>
  );
});

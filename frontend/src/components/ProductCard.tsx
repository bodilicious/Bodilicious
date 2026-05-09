import { memo } from 'react';
import { Heart, ShoppingBag } from 'lucide-react';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import { Link } from 'react-router-dom';
import StarRating from './StarRating';
import { m, useReducedMotion } from 'framer-motion';
import { hoverLift, hoverLiftSubtle } from '../utils/motionTokens';

interface ProductCardProps {
  product: Product;
}

export default memo(function ProductCard({ product }: ProductCardProps) {
  const { addToCart, toggleWishlist, isInWishlist } = useApp();
  const inWishlist = isInWishlist(product.pid);

  const shouldReduceMotion = useReducedMotion();
  const lift = shouldReduceMotion ? {} : hoverLift;
  const subtleLift = shouldReduceMotion ? {} : hoverLiftSubtle;

  return (
    <m.div
      className="group relative bg-white transition-all duration-500 hover:shadow-[0_20px_40px_-5px_rgba(139,0,0,0.08)] rounded-sm"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 400px' }}
      whileHover={lift}
      layout // enable smooth layout transitions when filtering the shop grid
    >
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
          className="w-full h-full object-cover transform scale-100 group-hover:scale-105 transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-dark-red/0 group-hover:bg-dark-red/10 transition-colors duration-500" />

        <button
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(product);
          }}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-md ${inWishlist
            ? 'bg-ruby-red text-white shadow-md scale-105'
            : 'bg-white/80 text-dark-red/50 hover:text-ruby-red hover:bg-white/95 shadow-sm hover:scale-105'
            }`}
        >
          <Heart size={15} fill={inWishlist ? 'currentColor' : 'none'} className={inWishlist ? 'animate-pulse duration-300' : ''} />
        </button>

        {product.stock <= 5 && product.stock > 0 && (
          <div className="absolute top-3 left-3 bg-indian-red/90 backdrop-blur-sm text-white text-[9px] font-sans tracking-widest uppercase px-2.5 py-1 rounded-sm shadow-sm">
            Low Stock
          </div>
        )}
        {product.stock === 0 && (
          <div className="absolute top-3 left-3 bg-dark-red/90 backdrop-blur-sm text-silk text-[9px] font-sans tracking-widest uppercase px-2.5 py-1 rounded-sm shadow-sm">
            Sold Out
          </div>
        )}

        <button
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            if (product.stock > 0) addToCart(product);
          }}
          disabled={product.stock === 0}
          className="absolute bottom-0 left-0 right-0 bg-dark-red/95 backdrop-blur-md text-silk py-3.5 flex items-center justify-center gap-2 text-[11px] font-sans tracking-[0.2em] uppercase translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[0.16,1,0.3,1] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ruby-red"
        >
          <ShoppingBag size={14} />
          {product.stock === 0 ? 'Sold Out' : 'Add to Bag'}
        </button>
      </Link>

      <div className="pt-3 pb-1 px-1">
        <Link
          to={`/product/${product.pid}`}
          className="block text-left w-full"
        >
          <p className="text-[10px] font-sans tracking-widest uppercase text-grey-beige mb-1">
            {product.category === 'skin' ? 'Skin Care' : product.category === 'hair' ? 'Hair Care' : 'Body Care'}
          </p>
          <h3 className="font-serif text-dark-red text-sm leading-snug mb-2 group-hover:text-ruby-red transition-colors">
            {product.name}
          </h3>
        </Link>
        <div className="flex items-center justify-between">
          <StarRating rating={product.rating} count={product.ratingCount} size={12} />
          <span className="font-sans font-semibold text-dark-red text-sm">
            ₹{product.price.toLocaleString('en-IN')}
          </span>
        </div>
      </div>
    </m.div>
  );
});

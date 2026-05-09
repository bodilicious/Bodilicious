import { Search, ChevronRight, Home, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
import { m } from 'framer-motion';
import { fadeUpVariant, staggerContainerVariant } from '../utils/motionTokens';
import { useSEO } from '../hooks/useSEO';

export default function NotFoundPage() {
  useSEO({
    title: 'Page Not Found — Bodilicious',
    description: 'The page you are looking for does not exist. Shop our full range of herbal skincare and haircare at Bodilicious.',
    noIndex: true,
  });

  const { products } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const popularProducts = [...products]
    .sort((a, b) => {
      const ratingA = a.rating || 0;
      const ratingB = b.rating || 0;
      if (ratingB !== ratingA) return ratingB - ratingA;
      return (b.ratingCount || 0) - (a.ratingCount || 0);
    })
    .slice(0, 4);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shop?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] pt-32 pb-20 px-6">
      <m.div 
        className="max-w-4xl mx-auto text-center"
        initial="hidden"
        animate="visible"
        variants={staggerContainerVariant}
      >
        <m.h1 variants={fadeUpVariant} className="text-8xl sm:text-9xl font-serif text-ruby-red/10 mb-[-2rem] sm:mb-[-3rem] select-none">
          404
        </m.h1>
        
        <m.div variants={fadeUpVariant}>
          <h2 className="text-3xl sm:text-4xl font-serif text-dark-red mb-4">Page Not Found</h2>
          <p className="text-grey-beige font-sans text-sm sm:text-base mb-10 max-w-md mx-auto leading-relaxed">
            The secret to glowing skin isn't here, but it's just a click away. Let's get you back on track.
          </p>
        </m.div>

        {/* Search Bar */}
        <m.form 
          variants={fadeUpVariant}
          onSubmit={handleSearch}
          className="relative max-w-md mx-auto mb-16"
        >
          <input
            type="text"
            placeholder="Search for products, ingredients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-silk py-4 pl-5 pr-14 rounded-full font-sans text-sm focus:outline-none focus:border-ruby-red transition-colors shadow-sm"
          />
          <button 
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-ruby-red text-white rounded-full flex items-center justify-center hover:bg-dark-red transition-colors"
          >
            <Search size={18} />
          </button>
        </m.form>

        {/* Navigation Shortcuts */}
        <m.div variants={fadeUpVariant} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-20">
          {[
            { label: 'Shop All Face', path: '/shop?category=skin' },
            { label: 'Shop All Hair', path: '/shop?category=hair' },
            { label: 'Shop All Body', path: '/shop?category=body' },
          ].map((link, i) => (
            <Link
              key={i}
              to={link.path}
              className="group flex items-center justify-between p-5 bg-white border border-silk hover:border-ruby-red transition-all shadow-sm rounded-sm"
            >
              <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-dark-red">
                {link.label}
              </span>
              <ChevronRight size={16} className="text-ruby-red group-hover:translate-x-1 transition-transform" />
            </Link>
          ))}
        </m.div>

        {/* Popular Products */}
        {popularProducts.length > 0 && (
          <m.div variants={fadeUpVariant} className="text-left">
            <h3 className="text-lg font-serif text-dark-red mb-8 text-center sm:text-left">
              Popular Picks for You
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {popularProducts.map((product) => (
                <ProductCard key={product.pid} product={product} />
              ))}
            </div>
          </m.div>
        )}

        {/* Back Home */}
        <m.div variants={fadeUpVariant} className="mt-16 pt-8 border-t border-silk/40 flex flex-col sm:flex-row items-center justify-center gap-6">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-[10px] sm:text-xs font-sans font-bold uppercase tracking-[0.2em] text-grey-beige hover:text-dark-red transition-colors"
          >
            <ArrowLeft size={14} />
            Go Back
          </button>
          <Link
            to="/"
            className="flex items-center gap-2 text-[10px] sm:text-xs font-sans font-bold uppercase tracking-[0.2em] text-ruby-red hover:text-dark-red transition-colors"
          >
            <Home size={14} />
            Back to Home
          </Link>
        </m.div>
      </m.div>
    </div>
  );
}

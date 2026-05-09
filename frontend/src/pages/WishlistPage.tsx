import { Heart, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
import Footer from '../components/Footer';

export default function WishlistPage() {
  const { wishlist, navigateTo } = useApp();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 pt-28 pb-16">
        <h1 className="font-serif text-dark-red text-4xl mb-2">Wishlist</h1>
        <p className="font-sans text-grey-beige text-sm mb-10">
          {wishlist.length > 0
            ? `${wishlist.length} item${wishlist.length !== 1 ? 's' : ''} saved`
            : 'Save your favourites here'}
        </p>

        {wishlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <Heart size={48} className="text-silk-dark mb-6" />
            <h2 className="font-serif text-dark-red text-2xl mb-3">No Items Saved Yet</h2>
            <p className="font-sans text-grey-beige text-sm mb-8 max-w-xs">
              Browse our collection and tap the heart icon to save products you love.
            </p>
            <button
              onClick={() => navigateTo('shop')}
              className="flex items-center gap-2 bg-dark-red text-silk px-8 py-4 font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-colors"
            >
              Discover Products <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {wishlist.map(product => (
              <ProductCard key={product.pid} product={product} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

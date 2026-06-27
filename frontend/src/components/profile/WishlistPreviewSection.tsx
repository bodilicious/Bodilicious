 
import { motion } from 'framer-motion';
import { Heart, ShoppingBag, ChevronRight, X, AlertCircle } from 'lucide-react';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { useCurrency } from '../../hooks/useCurrency';

interface Props {
    wishlist: Product[];
    navigateTo: (page: any, pid?: string) => void;
}

export default function WishlistPreviewSection({ wishlist, navigateTo }: Props) {
    const { addToCart, toggleWishlist } = useApp();
    const { formatPrice } = useCurrency();

    const previewItems = wishlist.slice(0, 4);

    const handleQuickAdd = (product: Product) => {
        // Required selection check: Makeup usually needs shade selection
        if (product.category === 'makeup' || !product.price) {
            toast.success("Please select your shade/size");
            navigateTo('product', product.pid);
            return;
        }

        if (product.stock <= 0) {
            toast.error("Item is currently out of stock");
            return;
        }

        addToCart(product, 1);
        toast.success(`Added ${product.name} to bag`);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-silk rounded-2xl overflow-hidden mb-6 shadow-sm flex flex-col"
        >
            <div className="px-6 py-5 border-b border-silk/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-silk-light rounded-full flex items-center justify-center text-dark shadow-sm">
                        <Heart size={18} />
                    </div>
                    <h3 className="font-serif text-dark text-base">My Wishlist</h3>
                </div>
                <button
                    onClick={() => navigateTo('wishlist')}
                    className="flex items-center gap-1 text-ruby-red hover:text-dark-red font-sans text-xs uppercase tracking-wider transition-colors"
                >
                    View All {wishlist.length > 0 && `(${wishlist.length})`} <ChevronRight size={14} />
                </button>
            </div>

            <div className="p-4">
                {wishlist.length === 0 ? (
                    <div className="py-8 text-center">
                        <div className="w-12 h-12 bg-silk-light rounded-full flex items-center justify-center mx-auto mb-3">
                            <Heart size={20} className="text-silk" />
                        </div>
                        <p className="font-sans text-grey-beige text-xs mb-4">Save products you love and revisit them anytime.</p>
                        <button
                            onClick={() => navigateTo('shop')}
                            className="text-ruby-red font-sans text-xs uppercase tracking-widest font-bold underline underline-offset-4"
                        >
                            Explore Bestsellers
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {previewItems.map((product) => (
                            <div key={product.pid} className="group relative bg-silk-light/30 border border-silk/20 rounded-xl overflow-hidden hover:shadow-md transition-all">
                                {/* Remove button */}
                                <button
                                    onClick={() => toggleWishlist(product)}
                                    className="absolute top-2 right-2 z-10 w-6 h-6 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-grey-beige hover:text-ruby-red transition-colors"
                                >
                                    <X size={14} />
                                </button>

                                <div 
                                    className="aspect-[3/4] overflow-hidden cursor-pointer"
                                    onClick={() => navigateTo('product', product.pid)}
                                >
                                    <img
                                        loading="lazy"
                                        src={product.images[0]}
                                        alt={product.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                    />
                                    {product.stock <= 0 && (
                                        <div className="absolute inset-0 bg-dark/40 flex items-center justify-center">
                                            <span className="bg-white/90 px-2 py-1 rounded text-[10px] font-sans font-bold uppercase tracking-widest text-dark">
                                                Out of Stock
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="p-3">
                                    <h4 className="font-sans text-[11px] text-dark font-medium truncate mb-0.5">{product.name}</h4>
                                    <div className="flex items-center justify-between">
                                        <p className="font-sans text-xs text-ruby-red font-semibold">{formatPrice(product.price)}</p>
                                        {product.stock > 0 && product.stock < 5 && (
                                            <span className="text-[9px] text-amber-600 font-bold uppercase tracking-tighter flex items-center gap-0.5">
                                                <AlertCircle size={8} /> Low Stock
                                            </span>
                                        )}
                                    </div>
                                    
                                    <button
                                        onClick={() => handleQuickAdd(product)}
                                        disabled={product.stock <= 0}
                                        className={`mt-3 w-full py-2 rounded-lg font-sans text-[10px] tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 ${
                                            product.stock <= 0 
                                                ? 'bg-silk text-grey-beige cursor-not-allowed'
                                                : 'bg-dark text-white hover:bg-ruby-red shadow-sm'
                                        }`}
                                    >
                                        <ShoppingBag size={12} /> Add to Bag
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

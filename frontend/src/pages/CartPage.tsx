import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Footer from '../components/Footer';

export default function CartPage() {
  const { cartItems, removeFromCart, updateQuantity, cartTotal, navigateTo, isAuthenticated, user, storeSettings } = useApp();
  const navigate = useNavigate();

  const validCartItems = cartItems.filter(item => item && item.product);

  if (validCartItems.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-24 pb-16">
          <ShoppingBag size={48} className="text-silk-dark mb-6" />
          <h2 className="font-serif text-dark-red text-3xl mb-3">Your Bag is Empty</h2>
          <p className="font-sans text-grey-beige text-sm mb-8">
            Discover our premium skincare and haircare collection.
          </p>
          <button
            onClick={() => navigateTo('shop')}
            className="flex items-center gap-2 bg-dark-red text-silk px-8 py-4 font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-colors"
          >
            Continue Shopping <ArrowRight size={14} />
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const shipping = cartTotal >= storeSettings.shippingThreshold ? 0 : storeSettings.shippingCost;
  const total = cartTotal + shipping;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 pt-28 pb-16">
        <h1 className="font-serif text-dark-red text-4xl mb-10">Your Bag</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-0 divide-y divide-silk">
            {user?.welcomeOffer?.eligible && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 mb-6 flex items-center justify-center text-sm font-sans">
                ✨ {user.welcomeOffer.message} ✨
              </div>
            )}
            {validCartItems.map(item => (
              <div key={item.product.pid} className="flex gap-5 py-6">
                <button
                  onClick={() => navigateTo('product', item.product.pid)}
                  className="w-24 h-28 bg-silk-light overflow-hidden flex-shrink-0"
                >
                  <img
                    loading="lazy"
                    src={item.product.images[0]}
                    alt={item.product.name}
                    className="w-full h-full object-contain p-1 mix-blend-multiply"
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-sans tracking-widest uppercase text-grey-beige mb-1">
                        {{
                          skin: 'Skin Care',
                          hair: 'Hair Care',
                          body: 'Body Care',
                          makeup: 'Makeup',
                          lip: 'Lip Care',
                          other: 'Other'
                        }[item.product.category] || 'Body Care'}
                      </p>
                      <h3 className="font-serif text-dark-red text-base">{item.product.name}</h3>
                    </div>
                    <span className="font-sans font-semibold text-dark-red whitespace-nowrap">
                      ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <p className="font-sans text-grey-beige text-xs mt-1 mb-4">
                    ₹{item.product.price.toLocaleString('en-IN')} each
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center border border-silk">
                      <button
                        onClick={() => {
                          if (item.quantity > 1) {
                            updateQuantity(item.product.pid, item.quantity - 1);
                          }
                        }}
                        className="w-8 h-8 flex items-center justify-center text-dark-red hover:bg-silk-light"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-8 text-center font-sans text-dark-red text-sm">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.pid, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center text-dark-red hover:bg-silk-light"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.pid)}
                      className="text-grey-beige hover:text-ruby-red transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="bg-silk-light p-6 sticky top-24">
              <h2 className="font-serif text-dark-red text-xl mb-6">Order Summary</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm font-sans">
                  <span className="text-grey-beige">Subtotal</span>
                  <span className="text-dark-red">₹{cartTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm font-sans">
                  <span className="text-grey-beige">Shipping</span>
                  <span className={shipping === 0 ? 'text-ruby-red font-medium' : 'text-dark-red'}>
                    {shipping === 0 ? 'Free' : `₹${shipping}`}
                  </span>
                </div>
                {shipping > 0 && (
                  <p className="text-xs font-sans mt-2 text-dark-red/80 flex items-center gap-1.5 justify-center">
                    <Truck size={14} /> 
                    Free shipping on orders above ₹{storeSettings.shippingThreshold}
                  </p>
                )}

                {user?.welcomeOffer?.eligible && (
                  <div className="flex justify-between text-sm font-sans text-emerald-600">
                    <span>Welcome Offer (10%)</span>
                    <span>-₹{Math.round(total * 0.10)}</span>
                  </div>
                )}

                <div className="border-t border-silk pt-3 flex justify-between font-sans font-semibold text-dark-red">
                  <span>Total</span>
                  <span>
                    ₹
                    {Math.max(
                      0,
                      total - (user?.welcomeOffer?.eligible ? Math.round(total * 0.10) : 0)
                    ).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (isAuthenticated) {
                    navigateTo('shipping');
                  } else {
                    navigate('/signin', {
                      state: { returnTo: '/cart', reason: 'checkout' },
                      replace: true
                    });
                  }
                }}
                className="w-full bg-dark-red text-silk py-4 font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-colors flex items-center justify-center gap-2 mb-3">
                Proceed to Checkout <ArrowRight size={14} />
              </button>
              <button
                onClick={() => navigateTo('shop')}
                className="w-full border border-silk text-dark-red/60 py-3 font-sans text-xs tracking-widest uppercase hover:border-dark-red hover:text-dark-red transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

import { Instagram, Facebook, Youtube, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function Footer() {
  const { user, authStatus } = useApp();
   
  const welcomeOffer = (user as any)?.welcomeOffer;
  const showBanner = authStatus !== 'authenticated' || welcomeOffer?.eligible === true;
  const location = useLocation();
  const isCheckoutPhase = location.pathname === '/payment' || location.pathname === '/confirmation';

  return (
    <footer className={`bg-silk-light border-t border-silk ${isCheckoutPhase ? 'pointer-events-none opacity-50 grayscale' : ''}`}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 px-6 py-14">
          

          <div>
            <h3 className="text-[10px] font-sans font-bold tracking-widest uppercase text-dark-red mb-4">
              Customer Service
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: 'How to Order', path: '/how-to-order' },
                { label: 'Contact Us', path: '/contact' },
                { label: 'Shipping & Returns', path: '/shipping-refund' },
                { label: 'FAQs', path: '/faqs' }
              ].map(item => (
                <li key={item.label}>
                  <Link
                    to={item.path}
                    onClick={() => window.scrollTo(0, 0)}
                    className="text-sm font-sans flex items-center w-fit text-grey-beige-dark hover:text-ruby-red hover:translate-x-1 transition-all duration-300 tracking-wide"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[10px] font-sans font-bold tracking-widest uppercase text-dark-red mb-4">
              Information
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: 'Privacy Policy', path: '/privacy' },
                { label: 'Terms & Conditions', path: '/terms' },
                { label: 'Shipping & Refund Policy', path: '/shipping-refund' },
                { label: 'Blogs', path: '/blogs' },
                { label: 'About Us', path: '/about' },
                { label: 'Brand Story', path: '/brand-story' },
                { label: 'Offers', path: '/offers' },
              ].map(item => (
                <li key={item.label}>
                  <Link
                    to={item.path}
                    onClick={() => window.scrollTo(0, 0)}
                    className="text-sm font-sans flex items-center w-fit text-grey-beige-dark hover:text-ruby-red hover:translate-x-1 transition-all duration-300 tracking-wide"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[10px] font-sans font-bold tracking-widest uppercase text-dark-red mb-4">
              Social
            </h3>
            <div className="flex gap-4 flex-wrap">
              {[
                { Icon: Instagram, label: 'Instagram', url: 'https://www.instagram.com/bodilicious.in/' },
                { Icon: Facebook, label: 'Facebook', url: 'https://www.facebook.com/bodilicious.in/' },
                { Icon: Youtube, label: 'YouTube', url: 'https://www.youtube.com/@skinbrighteningbodilicious' },
              ].map(({ Icon, label, url }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="text-grey-beige-dark hover:text-ruby-red hover:-translate-y-1 hover:scale-110 transition-all duration-300 inline-block p-1 -m-1"
                >
                  <Icon size={20} />
                </a>
              ))}
              
            </div>
          </div>
        </div>

        {/* Welcome Offer Banner */}
        {showBanner && (
          <div className="mx-4 mb-4 rounded-xl overflow-hidden">
            <Link
              to="/offers"
              onClick={() => window.scrollTo(0, 0)}
              className="flex items-center justify-between gap-3 px-5 py-3.5 bg-gradient-to-r from-dark-red via-ruby-red to-rose-700 text-white hover:from-ruby-red hover:to-dark-red transition-all duration-500 group"
            >
              <span className="text-sm font-sans font-medium tracking-wide">
                🎉 <span className="font-semibold">Welcome Offer Available</span> – Get 10% OFF on your first order!
              </span>
              <span className="flex-shrink-0 text-xs font-sans font-semibold bg-white/20 group-hover:bg-white/30 transition-colors px-3 py-1 rounded-full whitespace-nowrap">
                Shop Now →
              </span>
            </Link>
          </div>
        )}

        <div className="px-6 py-8 border-t border-silk flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <p className="text-[10px] font-sans font-bold tracking-widest uppercase text-dark-red/60">
              100% Secure Payments
            </p>
            <div className="flex items-center gap-4 grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
              <img src="/assets/payment-badges/visa.svg" alt="Visa" width={48} height={16} loading="lazy" className="h-4 w-auto" />
              <img src="/assets/payment-badges/mastercard.svg" alt="Mastercard" width={48} height={24} loading="lazy" className="h-6 w-auto" />
              <img src="/assets/payment-badges/razorpay.svg" alt="Razorpay" width={80} height={16} loading="lazy" className="h-4 w-auto" />
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end gap-2">
            <div className="flex items-center gap-2 text-ruby-red bg-white px-3 py-1.5 rounded-full border border-silk shadow-sm">
              <ShieldCheck size={14} strokeWidth={2.5} />
              <span className="text-[10px] font-sans font-bold tracking-wider uppercase">Secure SSL Checkout</span>
            </div>
            <p className="text-xs font-sans text-grey-beige-dark tracking-wide">
              © {new Date().getFullYear()} Bodilicious – International
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

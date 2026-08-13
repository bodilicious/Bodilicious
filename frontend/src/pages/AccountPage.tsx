import { useApp } from '../context/AppContext';
import { LogOut, LogIn } from 'lucide-react';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';
import { Order } from '../types';
import { useSEO } from '../hooks/useSEO';

// Modular profile components
import AccountHeaderCard from '../components/profile/AccountHeaderCard';

import SkinProfileSection from '../components/profile/SkinProfileSection';
import SavedAddressesSection from '../components/profile/SavedAddressesSection';
import AccountShortcutCards from '../components/profile/AccountShortcutCards';
import ProfileCompletionCard from '../components/profile/ProfileCompletionCard';
import LatestOrderCard from '../components/profile/LatestOrderCard';
import OffersSection from '../components/profile/OffersSection';
import WishlistPreviewSection from '../components/profile/WishlistPreviewSection';

export default function AccountPage() {
  useSEO({
    title: 'My Account',
    description: 'Manage your account.',
    noIndex: true
  });

  const {
    user,
    authStatus,
    navigateTo,
    orders,
    wishlist,
    logout,
    updateUserProfile,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    addToCart,
    resendVerificationEmail,
  } = useApp();


  const handleReorder = (order: Order) => {
    if (!order || !order.items) {
      toast.error("Order data is incomplete");
      return;
    }
    try {
      order.items.forEach(item => {
        if (item.product) {
          addToCart(item.product, item.quantity, false, item.variant);
        }
      });
      toast.success("All items added to bag");
      navigateTo('cart');
    } catch {
      toast.error("Failed to reorder items");
    }
  };

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#F8F4EF] flex flex-col">
        <div className="flex-1 max-w-5xl mx-auto w-full px-6 pt-28 pb-16">
          <div className="animate-pulse flex flex-col gap-6">
            <div className="h-40 bg-silk-light rounded-3xl" />
            <div className="h-32 bg-silk-light rounded-3xl" />
            <div className="h-64 bg-silk-light rounded-3xl" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (authStatus === 'unauthenticated' || !user) {
    return (
      <div className="min-h-screen bg-[#F8F4EF] flex flex-col">
        <div className="flex-1 max-w-5xl mx-auto w-full px-6 pt-28 pb-16 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-dark mb-6 shadow-sm border border-silk">
            <LogIn size={32} />
          </div>
          <h1 className="font-serif text-dark text-4xl mb-4">Welcome Back</h1>
          <p className="font-sans text-grey-beige mb-8 max-w-md">
            Sign in to access your personalized beauty dashboard, track orders, and build your ritual.
          </p>
          <button
            onClick={() => navigateTo('signin')}
            className="bg-dark text-white px-10 py-4 rounded-2xl font-sans text-sm tracking-widest uppercase hover:bg-ruby-red transition-all shadow-lg"
          >
            Sign In / Register
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F4EF] flex flex-col selection:bg-ruby-red/10">
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 pt-28 pb-16">

        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-[#8B5E3C] mb-1">Welcome back</p>
            <h1 className="font-serif text-dark text-3xl">My Dashboard</h1>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 border border-silk text-grey-beige hover:border-ruby-red hover:text-ruby-red font-sans text-xs tracking-widest uppercase transition-all px-4 py-2 rounded-xl"
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>

        {authStatus === 'awaiting-verification' && (
          <div className="mb-8 p-6 bg-indian-red/5 border border-indian-red/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <h3 className="text-dark-red font-serif text-lg mb-1">Verify your email</h3>
              <p className="text-grey-beige font-sans text-xs">Please verify your email address to unlock all features including checkout and profile updates.</p>
            </div>
            <button 
              onClick={async () => {
                const id = toast.loading("Sending verification email...");
                try {
                  await resendVerificationEmail();
                  toast.success("Verification link sent!", { id });
                } catch (err) {
                  toast.error("Failed to resend link", { id });
                }
              }}
              className="bg-dark-red text-white px-6 py-2.5 rounded-xl font-sans text-[10px] tracking-widest uppercase hover:bg-ruby-red transition-all whitespace-nowrap"
            >
              Resend Link
            </button>
          </div>
        )}

        {/* 1. Profile Header Card */}
        <AccountHeaderCard
          user={user}
          authStatus={authStatus}
          onSave={updateUserProfile}
        />

        {/* 2. Profile Completion Indicator (High Value) */}
        <ProfileCompletionCard user={user} orders={orders} />

        {/* 3. Latest Order Card (Actionable) */}
        <LatestOrderCard 
          order={orders[0] ?? null} 
          navigateTo={navigateTo} 
          onReorder={handleReorder}
        />

        {/* 4. Skin Profile Summary / intelligence */}
        <SkinProfileSection 
          user={user} 
          onSave={updateUserProfile} 
          navigateTo={navigateTo}
        />

        {/* 5. Wishlist Preview (Conversion optimized) */}
        <WishlistPreviewSection 
          wishlist={wishlist} 
          navigateTo={navigateTo} 
        />

        {/* 6. Offers Section */}
        <OffersSection 
          user={user} 
          navigateTo={navigateTo} 
        />

        {/* 7. Shortcut Cards (Navigation) */}
        <AccountShortcutCards 
          user={user}
          navigateTo={navigateTo} 
        />

        {/* 8. Collapsible / Lower Priority Sections */}
        <div className="mt-12 pt-8 border-t border-silk">
          <h3 className="font-serif text-dark text-xl mb-6">Account Settings</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div id="personal-info">
              <SavedAddressesSection
              user={user}
              addAddress={addAddress}
              updateAddress={updateAddress}
              deleteAddress={deleteAddress}
              setDefaultAddress={setDefaultAddress}
            />
            </div>
            
          </div>
        </div>

      </div>
      <Footer />
    </div>
  );
}

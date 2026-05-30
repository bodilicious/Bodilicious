import { AppProvider } from './context/AppContext';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { LazyMotion, domAnimation, AnimatePresence } from 'framer-motion';
import { lazy, Suspense, useEffect } from 'react';
import Navbar from './components/Navbar';
import PageTransition from './components/PageTransition';
import ScrollToTop from './components/ScrollToTop';
import { Toaster } from 'react-hot-toast';

// Lazy load page components
const HomePage = lazy(() => import('./pages/HomePage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const SignInPage = lazy(() => import('./pages/SignInPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const TrackingPage = lazy(() => import('./pages/TrackingPage'));
const OrderDetailsPage = lazy(() => import('./pages/OrderDetailsPage'));
const PaymentPage = lazy(() => import('./pages/PaymentPage'));
const ShippingPage = lazy(() => import('./pages/ShippingPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ConfirmationPage = lazy(() => import('./pages/ConfirmationPage'));
const GenericStaticPage = lazy(() => import('./pages/GenericStaticPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const ShippingRefundPage = lazy(() => import('./pages/ShippingRefundPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const BrandStoryPage = lazy(() => import('./pages/BrandStoryPage'));
const RitualFinderPage = lazy(() => import('./pages/RitualFinderPage'));
const OfferPage = lazy(() => import('./pages/OfferPage'));
const EmailActionPage = lazy(() => import('./pages/EmailActionPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Admin Pages
const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const AdminRoute = lazy(() => import('./components/AdminRoute'));
const AnalyticsDashboard = lazy(() => import('./admin/AnalyticsDashboard'));
const AnalyticsPage = lazy(() => import('./admin/AnalyticsPage'));
const ProductManagement = lazy(() => import('./admin/ProductManagement'));
const ProductForm = lazy(() => import('./admin/ProductForm'));
const OrderManagement = lazy(() => import('./admin/OrderManagement'));
const UserManagement = lazy(() => import('./admin/UserManagement'));
const AuditLogs = lazy(() => import('./admin/AuditLogs'));
const ReturnsManagement = lazy(() => import('./admin/ReturnsManagement'));
const CouponManagement = lazy(() => import('./admin/CouponManagement'));
const Insights = lazy(() => import('./admin/Insights'));
const AbandonedCheckouts = lazy(() => import('./admin/AbandonedCheckouts'));
const DraftOrders = lazy(() => import('./admin/DraftOrders'));
const StoreSettings = lazy(() => import('./admin/StoreSettings'));

// Simple loading fallback
const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-dark-red border-t-transparent rounded-full animate-spin" />
  </div>
);

function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const source = params.get('utm_source');
    const medium = params.get('utm_medium');
    const campaign = params.get('utm_campaign');

    if (source || medium || campaign) {
      const utm = {
        source: source || 'direct',
        medium: medium || 'none',
        campaign: campaign || 'none',
        timestamp: Date.now()
      };
      localStorage.setItem('bodilicious_utm', JSON.stringify(utm));
    }
  }, [location.search]);

  return (
    <>
      <ScrollToTop />
      <Navbar />
      <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
            <Route path="/shop" element={<PageTransition><ShopPage /></PageTransition>} />
            <Route path="/ritual-finder" element={<PageTransition><RitualFinderPage /></PageTransition>} />
            <Route path="/product/:pid" element={<PageTransition><ProductPage /></PageTransition>} />
            <Route path="/product" element={<Navigate to="/shop" replace />} />
            <Route path="/cart" element={<PageTransition><CartPage /></PageTransition>} />
            <Route path="/wishlist" element={<PageTransition><WishlistPage /></PageTransition>} />
            <Route path="/payment" element={<PageTransition><PaymentPage /></PageTransition>} />
            <Route path="/chat" element={<PageTransition><ChatPage /></PageTransition>} />
            <Route path="/signin" element={<PageTransition><SignInPage /></PageTransition>} />
            <Route path="/account" element={<PageTransition><AccountPage /></PageTransition>} />
            <Route path="/tracking" element={<PageTransition><TrackingPage /></PageTransition>} />
            <Route path="/order-details" element={<PageTransition><OrderDetailsPage /></PageTransition>} />
            <Route path="/shipping" element={<PageTransition><ShippingPage /></PageTransition>} />
            <Route path="/confirmation" element={<PageTransition><ConfirmationPage /></PageTransition>} />
            <Route path="/orders/:orderId" element={<PageTransition><OrderDetailsPage /></PageTransition>} />
            <Route path="/track/:orderId" element={<PageTransition><OrderDetailsPage /></PageTransition>} />
            <Route path="/auth/action" element={<PageTransition><EmailActionPage /></PageTransition>} />

            {/* Static Pages */}
            <Route path="/contact" element={<PageTransition><ContactPage /></PageTransition>} />
            <Route path="/faqs" element={<PageTransition><GenericStaticPage /></PageTransition>} />
            <Route path="/stores" element={<PageTransition><GenericStaticPage /></PageTransition>} />
            <Route path="/accessibility" element={<PageTransition><GenericStaticPage /></PageTransition>} />
            <Route path="/careers" element={<PageTransition><GenericStaticPage /></PageTransition>} />
            <Route path="/students" element={<PageTransition><GenericStaticPage /></PageTransition>} />

            {/* Luxury Custom Policies */}
            <Route path="/privacy" element={<PageTransition><PrivacyPage /></PageTransition>} />
            <Route path="/terms" element={<PageTransition><TermsPage /></PageTransition>} />
            <Route path="/shipping-refund" element={<PageTransition><ShippingRefundPage /></PageTransition>} />
            <Route path="/about" element={<PageTransition><AboutPage /></PageTransition>} />
            <Route path="/brand-story" element={<PageTransition><BrandStoryPage /></PageTransition>} />
            <Route path="/offers" element={<PageTransition><OfferPage /></PageTransition>} />

            {/* Admin Routes */}
              <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AnalyticsDashboard />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="products" element={<ProductManagement />} />
                <Route path="products/new" element={<ProductForm />} />
                <Route path="products/:pid" element={<ProductForm />} />
                <Route path="orders" element={<OrderManagement />} />
                <Route path="abandoned-checkouts" element={<AbandonedCheckouts />} />
                <Route path="draft-orders" element={<DraftOrders />} />
                <Route path="returns" element={<ReturnsManagement />} />
                <Route path="coupons" element={<CouponManagement />} />
                <Route path="insights" element={<Insights />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="settings" element={<StoreSettings />} />
                <Route path="logs" element={<AuditLogs />} />
              </Route>
            </Route>

            {/* /students route is defined above — duplicate removed */}
            <Route path="*" element={<PageTransition><NotFoundPage /></PageTransition>} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <LazyMotion features={domAnimation} strict>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#333',
              color: '#fff',
              fontSize: '14px',
              borderRadius: '8px',
              marginTop: '20vh'
            }
          }}
        />
        <AppRoutes />
      </LazyMotion>
    </AppProvider>
  );
}

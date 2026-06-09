import { AppContext, AppProvider } from './context/AppContext';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { LazyMotion, domAnimation, AnimatePresence } from 'framer-motion';
import { lazy, Suspense, useEffect, useContext } from 'react';
import Navbar from './components/Navbar';
import PageTransition from './components/PageTransition';
import ScrollToTop from './components/ScrollToTop';
import { Toaster } from 'react-hot-toast';
// AdminRoute is a layout-level guard used on every /admin sub-route.
// Eagerly imported to prevent a Suspense flash on every admin tab switch.
import AdminRoute from './components/AdminRoute';
import SessionTracker from './components/SessionTracker';

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
const TicketsPage = lazy(() => import('./pages/TicketsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Admin Pages
const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const AnalyticsDashboard = lazy(() => import('./admin/AnalyticsDashboard'));
const AnalyticsPage = lazy(() => import('./admin/AnalyticsPage'));
const ProductManagement = lazy(() => import('./admin/ProductManagement'));
const ProductForm = lazy(() => import('./admin/ProductForm'));
const OrderManagement = lazy(() => import('./admin/OrderManagement'));
const UserManagement = lazy(() => import('./admin/UserManagement'));
const CustomerDetails = lazy(() => import('./admin/CustomerDetails'));
const AuditLogs = lazy(() => import('./admin/AuditLogs'));
const ReturnsManagement = lazy(() => import('./admin/ReturnsManagement'));
const CouponManagement = lazy(() => import('./admin/CouponManagement'));
const Insights = lazy(() => import('./admin/Insights'));
const AbandonedCheckouts = lazy(() => import('./admin/AbandonedCheckouts'));
const DraftOrders = lazy(() => import('./admin/DraftOrders'));
const StoreSettings = lazy(() => import('./admin/StoreSettings'));
const TicketManagement = lazy(() => import('./admin/TicketManagement'));

// Simple loading fallback
const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-dark-red border-t-transparent rounded-full animate-spin" />
  </div>
);

function AppRoutes() {
  const location = useLocation();
  const { storeSettings } = useContext(AppContext)!;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    
    // Handle maintenance bypass
    const bypass = params.get('preview');
    if (bypass) {
      localStorage.setItem('maintenance_bypass', bypass);
      // Clean up URL if desired, or just leave it.
    }

    // Handle UTM tracking
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

  // Maintenance mode block
  const isAdminRoute = location.pathname.startsWith('/admin');
  if (storeSettings.maintenanceMode && !isAdminRoute) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="w-24 h-24 bg-dark-red text-white rounded-full flex items-center justify-center mb-6">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Under Maintenance</h1>
        <p className="text-gray-600 max-w-md mx-auto">{storeSettings.maintenanceMessage || 'We are currently updating our store to serve you better. Please check back later.'}</p>
      </div>
    );
  }

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

            <Route path="/signin" element={<PageTransition><SignInPage /></PageTransition>} />
            <Route path="/account" element={<PageTransition><AccountPage /></PageTransition>} />
            <Route path="/tracking" element={<PageTransition><TrackingPage /></PageTransition>} />
            <Route path="/order-details" element={<PageTransition><OrderDetailsPage /></PageTransition>} />
            <Route path="/shipping" element={<PageTransition><ShippingPage /></PageTransition>} />
            <Route path="/confirmation" element={<PageTransition><ConfirmationPage /></PageTransition>} />
            <Route path="/orders/:orderId" element={<PageTransition><OrderDetailsPage /></PageTransition>} />
            <Route path="/track/:orderId" element={<PageTransition><OrderDetailsPage /></PageTransition>} />
            <Route path="/auth/action" element={<PageTransition><EmailActionPage /></PageTransition>} />
            <Route path="/account/tickets" element={<PageTransition><TicketsPage /></PageTransition>} />

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
                <Route path="users/:id" element={<CustomerDetails />} />
                <Route path="tickets" element={<TicketManagement />} />
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
      <SessionTracker />
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

import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { m, AnimatePresence } from 'framer-motion';
import { MessageCircle, Ticket, ChevronRight, HelpCircle, X } from 'lucide-react';

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1`;

export default function FloatingSupportBubble() {
  const { user, authStatus, getAuthHeaders } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // Support Ticket Notifications and Menu
  const [unreadTicketsCount, setUnreadTicketsCount] = useState(0);
  const [supportMenuOpen, setSupportMenuOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const supportMenuRef = useRef<HTMLDivElement>(null);

  // Fetch ticket notification count for support bubble
  useEffect(() => {
    if (authStatus !== 'authenticated' || !user) {
      setUnreadTicketsCount(0);
      return;
    }

    const fetchNotificationCount = async () => {
      try {
        const headers = await getAuthHeaders();
        const uid = (user as any).uid || (user as any).firebaseUID;
        const res = await fetch(`${API_BASE}/support/tickets/${uid}`, { headers });
        const json = await res.json();
        if (json.success) {
          const count = json.tickets.filter((t: any) => {
            if (t.status !== 'open') return false;
            const messages = t.messages || [];
            if (messages.length === 0) return false;
            const lastMsg = messages[messages.length - 1];
            return lastMsg.authorRole === 'admin' || (lastMsg.authorRole === 'system' && lastMsg.visibleToCustomer !== false);
          }).length;
          setUnreadTicketsCount(count);
        }
      } catch (err) {
        console.error('Error fetching ticket notification count:', err);
      }
    };

    fetchNotificationCount();
    // Check for new notifications every 25 seconds
    const interval = setInterval(fetchNotificationCount, 25000);
    return () => clearInterval(interval);
  }, [user, authStatus, getAuthHeaders]);

  // Handle clicking outside of support popover to close it
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (supportMenuRef.current && !supportMenuRef.current.contains(e.target as Node)) {
        setSupportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Scroll listener to show bubble only when scrolled past Hero (Best Seller and below)
  useEffect(() => {
    const handleScroll = () => {
      // 400px threshold ensures we have scrolled past the hero carousel
      if (window.scrollY > 400) {
        setShowBubble(true);
      } else {
        setShowBubble(false);
        setSupportMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // run check on mount
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Only show on home page
  if (location.pathname !== '/') {
    return null;
  }

  return (
    <AnimatePresence>
      {showBubble && (
        <m.div
          ref={supportMenuRef}
          initial={{ opacity: 0, scale: 0.8, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 15 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-8 right-6 md:bottom-10 md:right-8 z-[9999] pointer-events-auto"
        >
          {/* Popover Menu */}
          <AnimatePresence>
            {supportMenuOpen && (
              <m.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-20 right-0 w-72 sm:w-80 bg-white border border-silk-dark/20 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] p-5 space-y-4 mb-2 origin-bottom-right z-50 pointer-events-auto"
              >
                {/* Header */}
                <div className="flex items-center gap-3 border-b border-silk pb-3">
                  <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-ruby-red border border-rose-100 flex-shrink-0">
                    <MessageCircle size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <p className="font-serif text-dark-red text-base font-semibold leading-tight">Bodilicious Support</p>
                    <p className="text-[11px] text-grey-beige/90 tracking-wide mt-0.5">Online • Replies in a few hours</p>
                  </div>
                </div>
                
                {/* Options */}
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setSupportMenuOpen(false);
                      navigate('/contact');
                    }}
                    className="w-full text-left px-4 py-3 bg-[#FDFAF7] hover:bg-rose-50/50 border border-silk hover:border-ruby-red/35 rounded-xl transition-all duration-200 group flex items-start gap-3"
                  >
                    <div className="mt-0.5 text-ruby-red group-hover:scale-110 transition-transform">
                      <Ticket size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-dark-red uppercase tracking-wider">Raise a Query</p>
                      <p className="text-[10px] text-grey-beige/80 mt-0.5">Report delivery, payment or other issues</p>
                    </div>
                    <ChevronRight size={14} className="text-grey-beige/60 group-hover:translate-x-0.5 transition-transform self-center" />
                  </button>
                  
                  {authStatus === 'authenticated' ? (
                    <button
                      onClick={() => {
                        setSupportMenuOpen(false);
                        navigate('/account/tickets');
                      }}
                      className="w-full text-left px-4 py-3 bg-[#FDFAF7] hover:bg-rose-50/50 border border-silk hover:border-ruby-red/35 rounded-xl transition-all duration-200 group flex items-start gap-3 relative"
                    >
                      <div className="mt-0.5 text-ruby-red group-hover:scale-110 transition-transform">
                        <MessageCircle size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-dark-red uppercase tracking-wider flex items-center gap-1.5">
                          My Tickets
                          {unreadTicketsCount > 0 && (
                            <span className="w-1.5 h-1.5 bg-ruby-red rounded-full" />
                          )}
                        </p>
                        <p className="text-[10px] text-grey-beige/80 mt-0.5">Check status and chat with support</p>
                      </div>
                      <div className="flex items-center gap-1 self-center">
                        {unreadTicketsCount > 0 && (
                          <span className="text-[9px] bg-ruby-red text-white px-2 py-0.5 rounded-full font-bold font-mono">
                            {unreadTicketsCount}
                          </span>
                        )}
                        <ChevronRight size={14} className="text-[#8B5E3C] group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSupportMenuOpen(false);
                        navigate('/signin');
                      }}
                      className="w-full text-left px-4 py-3 bg-[#FDFAF7] hover:bg-rose-50/50 border border-silk hover:border-ruby-red/35 rounded-xl transition-all duration-200 group flex items-start gap-3"
                    >
                      <div className="mt-0.5 text-ruby-red group-hover:scale-110 transition-transform">
                        <MessageCircle size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-dark-red uppercase tracking-wider">Sign In</p>
                        <p className="text-[10px] text-grey-beige/80 mt-0.5">Sign in to view your tickets</p>
                      </div>
                      <ChevronRight size={14} className="text-grey-beige/60 group-hover:translate-x-0.5 transition-transform self-center" />
                    </button>
                  )}
                </div>
              </m.div>
            )}
          </AnimatePresence>

          {/* Floating Bubble Button */}
          <button
            onClick={() => setSupportMenuOpen(!supportMenuOpen)}
            aria-label="Contact support"
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-dark-red via-ruby-red to-rose-600 text-silk flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[#FDFAF7]/10 hover:shadow-[0_12px_36px_rgb(0,0,0,0.18)] hover:-translate-y-1 hover:scale-105 active:scale-95 transition-all duration-300 relative group pointer-events-auto"
          >
            {supportMenuOpen ? (
              <X size={26} className="transition-transform rotate-90" />
            ) : (
              <HelpCircle size={26} className="transition-transform group-hover:rotate-12" />
            )}
            
            {/* Notification count badge on the bubble */}
            {unreadTicketsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-ruby-red text-white border-2 border-[#F8F4EF] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md font-mono animate-bounce">
                {unreadTicketsCount}
              </span>
            )}
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}

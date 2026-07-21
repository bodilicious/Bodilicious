import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ShoppingBag, Heart, User, Menu, X, Search, ChevronDown, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import Logo from './Logo';
import { useApp } from '../context/AppContext';


type ShopFilter = 'all' | 'skin' | 'hair' | 'body' | 'lip' | 'makeup';

type MegaMenuConfig = {
  label: string;
  filter: string;
  subLabel?: string;
  items: { label: string; filter: string; category?: string }[];
};

const MEGA_MENU_DATA: Record<string, MegaMenuConfig> = {
  face: {
    label: "Face",
    filter: "skin,lip,makeup",
    subLabel: "View All Face Care →",
    items: [
      { label: "Serums", filter: "serum" },
      { label: "Moisturizers", filter: "moisturizer" },
      { label: "Sunscreens", filter: "sunscreen" },
      { label: "Cleansers", filter: "cleanser" },
      { label: "Makeup & Lip", filter: "makeup" },
    ],
  },
  hair: {
    label: "Hair",
    filter: "hair",
    subLabel: "View All Hair Care →",
    items: [
      { label: "Shampoos", filter: "shampoo" },
      { label: "Hair Serums", filter: "hair_serum" },
      { label: "Hair Oils", filter: "hair_oil" },
      { label: "Conditioners", filter: "conditioner"}
    ],
  },
  body: {
    label: "Body, Lip & Makeup",
    filter: "body,lip,makeup",
    subLabel: "View All Body, Lip & Makeup →",
    items: [
      { label: "Lip Care", filter: "all", category: "lip" },
      { label: "Makeup", filter: "all", category: "makeup" },
      { label: "Face & Body Wash", filter: "face_body_wash" },
      { label: "Soaps", filter: "soap" },
      { label: "Soothing Gels", filter: "soothing_gel" }
    ],
  },
};

const NAV_LINKS = [
  { label: 'Home', page: '' as const },
  { label: 'Face', page: 'shop' as const, isMegaMenu: true, query: 'category=skin,lip,makeup' },
  { label: 'Hair', page: 'shop' as const, isMegaMenu: true, query: 'category=hair' },
  { label: 'Body', page: 'shop' as const, isMegaMenu: true, query: 'category=body,lip,makeup' },
  { label: 'Ritual Finder', page: 'ritual-finder' as const },
  { label: 'About', page: 'about' as const },
  { label: 'Contact Us', page: 'contact' as const },
];

export default function Navbar() {
  const { cartCount, wishlist, currentPage, authStatus, user, setShopFilter, products, navigateTo, storeSettings } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Hide Navbar for splash screen
  const [splashVisible, setSplashVisible] = useState(
    (location.pathname === '/' || location.pathname === '/home') &&
    !sessionStorage.getItem('splashShown')
  );
  
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  useEffect(() => {
    const handleSplashDismiss = () => setSplashVisible(false);
    window.addEventListener('splashDismissed', handleSplashDismiss);
    return () => window.removeEventListener('splashDismissed', handleSplashDismiss);
  }, []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Mega Menu State
  const [activeMegaMenu, setActiveMegaMenu] = useState<string | null>(null);
  const megaMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    setActiveMegaMenu(null);
  }, [location.pathname]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();

    return products
      .filter((p) => {
        const allIngredients = [
          ...(p.ingredients?.key_actives || []),
          ...(p.ingredients?.botanical_extracts || []),
          ...(p.ingredients?.others || []),
        ]
          .join(' ')
          .toLowerCase();

        return (
          p.name?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          allIngredients.includes(query)
        );
      })
      .slice(0, 5);
  }, [searchQuery, products]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNav = useCallback(
    (filter?: string) => {
      if (filter) {
        // If it's a multi-filter like "body,lip,makeup", just set to "all" or specific
        if (filter.includes(',')) setShopFilter('all');
        else if (['skin', 'hair', 'body', 'lip', 'makeup'].includes(filter)) {
          setShopFilter(filter as ShopFilter);
        } else {
          setShopFilter('all');
        }
      }
      setMenuOpen(false);
      setSearchOpen(false);
      setActiveMegaMenu(null);
    },
    [setShopFilter]
  );

  const handleMouseEnterMegaMenu = (label: string) => {
    if (megaMenuTimeoutRef.current) clearTimeout(megaMenuTimeoutRef.current);
    setActiveMegaMenu(label);
  };

  const handleMouseLeaveMegaMenu = () => {
    megaMenuTimeoutRef.current = setTimeout(() => {
      setActiveMegaMenu(null);
    }, 150);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Note: search tracking is handled server-side in getAllProducts (logAuditEvent SEARCH).
      // The backend logs with the accurate DB result count; no need for a duplicate client POST.
      setShopFilter('all');
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  // Hide Navbar completely on Admin panel and during initial Splash Screen
  if (location.pathname.startsWith('/admin') || splashVisible) return null;

  // Detect if we're on the home page for transparent nav behaviour
  const isHome = location.pathname === '/' || location.pathname === '/home';
  const isTransparent = isHome && !scrolled && !menuOpen;
  const isCheckoutPhase = location.pathname === '/payment' || location.pathname === '/confirmation';

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled || menuOpen
          ? 'bg-white shadow-sm border-b border-silk'
          : isHome
            ? 'bg-transparent'
            : 'bg-white/95 backdrop-blur-sm'
      } ${isCheckoutPhase ? 'pointer-events-none opacity-50 grayscale' : ''}`}
    >
      <AnimatePresence>
        {storeSettings?.announcementBar?.isActive && storeSettings.announcementBar.text && !announcementDismissed && (
          <m.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-gradient-to-r from-dark-red via-ruby-red to-dark-red text-white text-[10px] sm:text-xs tracking-widest font-sans uppercase z-50 shadow-md relative overflow-hidden"
          >
            <div className="py-2 sm:py-2.5 flex items-center relative pr-10">
              <div className="overflow-hidden w-full relative flex items-center h-4 sm:h-5">
                <div 
                  className="whitespace-nowrap absolute left-0 flex items-center animate-marquee"
                >
                  {storeSettings.announcementBar.link ? (
                    <a href={storeSettings.announcementBar.link} className="hover:text-silk-light transition-colors flex items-center gap-2 group/link cursor-pointer px-4">
                      <span className="border-b border-transparent group-hover/link:border-silk-light pb-0.5 transition-colors">
                        {storeSettings.announcementBar.text}
                      </span>
                      <ArrowRight size={14} className="group-hover/link:translate-x-1 transition-transform" />
                    </a>
                  ) : (
                    <span className="font-bold opacity-90 px-4">{storeSettings.announcementBar.text}</span>
                  )}
                </div>
              </div>
              
              <button 
                onClick={() => setAnnouncementDismissed(true)}
                className="absolute right-2 sm:right-4 p-1 rounded-full bg-dark-red/50 hover:bg-white/20 transition-colors z-10 backdrop-blur-sm"
                aria-label="Dismiss announcement"
              >
                <X size={14} />
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      <div className="max-w-[100rem] mx-auto px-4 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo — drop-shadow when transparent so it pops over any slide image */}
          <div className="flex-1 flex justify-start">
            <Link
              to="/"
              onClick={() => setMenuOpen(false)}
              style={isTransparent ? { filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.55))' } : undefined}
            >
              <Logo size="sm" />
            </Link>
          </div>

          <div className="hidden lg:flex justify-center items-center gap-6 xl:gap-10 2xl:gap-14">
            {NAV_LINKS.map((link) => (
              <div
                key={link.label}
                className="relative h-full flex items-center"
                onMouseEnter={link.isMegaMenu ? () => handleMouseEnterMegaMenu(link.label) : undefined}
                onMouseLeave={link.isMegaMenu ? handleMouseLeaveMegaMenu : undefined}
              >
                <Link
                  to={`/${link.page}${link.query ? '?' + link.query : ''}`}
                  onClick={() => handleNav(undefined)}
                  className={`flex items-center gap-1 text-xs xl:text-sm font-sans tracking-widest uppercase whitespace-nowrap transition-colors duration-200 py-6 ${
                    isTransparent
                      ? 'text-white/95 hover:text-white [filter:drop-shadow(0_1px_6px_rgba(0,0,0,0.7))]'
                      : currentPage === link.page && (!link.query || location.search.includes(link.query))
                        ? 'text-ruby-red'
                        : 'text-dark-red/70 hover:text-dark-red'
                  }`}
                >
                  {link.label}
                  {link.isMegaMenu && (
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-300 ${activeMegaMenu === link.label ? 'rotate-180' : ''}`}
                    />
                  )}
                </Link>

                {/* Mega Menu Dropdown */}
                {link.isMegaMenu && (
                  <div
                    className={`absolute top-full left-1/2 -translate-x-1/2 w-screen max-w-[100rem] bg-white border-b border-silk transition-all duration-300 ease-in-out shadow-sm origin-top overflow-hidden ${activeMegaMenu === link.label ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0 pointer-events-none'}`}
                    style={{ maxHeight: '600px' }}
                  >
                    <div className="mx-auto px-8 py-10 flex justify-center gap-16">
                      {Object.entries(MEGA_MENU_DATA)
                        .filter(([key]) => key === link.label.toLowerCase())
                        .map(([key, section]) => (
                          <div
                            key={key}
                            className="flex flex-col items-center min-w-[300px]"
                          >
                            <h3 className="font-serif text-dark-red text-xl mb-6">{section.label}</h3>
                            <ul className="space-y-4 text-center">
                              {section.items.map((item, idx) => (
                                <li key={idx}>
                                  <Link
                                    to={`/shop?category=${item.category || section.filter}&sub_category=${item.filter}`}
                                    onClick={() => handleNav(item.category || section.filter)}
                                    className="text-base font-sans text-grey-beige hover:text-ruby-red transition-colors inline-block relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[1px] after:bg-ruby-red hover:after:w-full after:transition-all after:duration-300"
                                  >
                                    {item.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>

                            {section.subLabel && (
                              <Link
                                to={`/shop?category=${section.filter}`}
                                onClick={() => handleNav(section.filter)}
                                className="mt-8 text-sm font-sans font-medium tracking-widest uppercase text-ruby-red hover:text-dark-red transition-colors border-b border-ruby-red"
                              >
                                {section.subLabel}
                              </Link>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex-1 flex items-center justify-end gap-3 sm:gap-4">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className={`flex transition-colors ${
                searchOpen ? 'text-ruby-red' : isTransparent ? 'text-white/95 hover:text-white [filter:drop-shadow(0_1px_6px_rgba(0,0,0,0.7))]' : 'text-dark-red/60 hover:text-dark-red'
              }`}
            >
              <Search size={18} className={searchOpen ? 'scale-110 transition-transform' : 'transition-transform'} />
            </button>




            <Link to="/wishlist" className={`relative transition-colors ${isTransparent ? 'text-white/95 hover:text-white [filter:drop-shadow(0_1px_6px_rgba(0,0,0,0.7))]' : 'text-dark-red/60 hover:text-ruby-red'}`}>
              <Heart size={18} />
              {wishlist.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-ruby-red text-white text-[10px] rounded-full flex items-center justify-center font-sans">
                  {wishlist.length}
                </span>
              )}
            </Link>

            {authStatus === 'authenticated' && (user?.role === 'admin' || user?.role === 'primary_admin') && (
              <Link
                to="/admin"
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300 group ${
                  isTransparent 
                    ? 'bg-white/10 hover:bg-white/20 text-white/95 hover:text-white [filter:drop-shadow(0_1px_6px_rgba(0,0,0,0.7))]' 
                    : 'bg-ruby-red/5 hover:bg-ruby-red/10 text-ruby-red'
                }`}
                title="Admin Dashboard"
              >
                <ShieldCheck size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-sans font-bold tracking-widest uppercase">Admin</span>
              </Link>
            )}

            {authStatus === 'loading' ? (
              <div className={`w-[18px] h-[18px] rounded-full border-2 animate-spin ${isTransparent ? 'border-white/30 border-t-white/80' : 'border-dark-red/20 border-t-dark-red/60'}`} />
            ) : (
              <Link
                to={authStatus === 'authenticated' ? '/account' : '/signin'}
                className={`transition-colors ${isTransparent ? 'text-white/95 hover:text-white [filter:drop-shadow(0_1px_6px_rgba(0,0,0,0.7))]' : 'text-dark-red/60 hover:text-dark-red'}`}
                title={authStatus === 'authenticated' ? 'My Account' : 'Sign In'}
              >
                <User size={18} />
              </Link>
            )}

            <Link to="/cart" className={`relative transition-colors ${isTransparent ? 'text-white/95 hover:text-white [filter:drop-shadow(0_1px_6px_rgba(0,0,0,0.7))]' : 'text-dark-red/60 hover:text-dark-red'}`}>
              <ShoppingBag size={18} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-dark-red text-silk text-[10px] rounded-full flex items-center justify-center font-sans">
                  {cartCount}
                </span>
              )}
            </Link>

            <button className={`md:hidden transition-colors ${isTransparent ? 'text-white/95 hover:text-white [filter:drop-shadow(0_1px_6px_rgba(0,0,0,0.7))]' : 'text-dark-red/70 hover:text-dark-red'}`} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Search Overlay */}
      <div
        className={`absolute top-full left-0 right-0 bg-white/95 backdrop-blur-md border-b border-silk transition-all duration-500 ease-in-out overflow-hidden shadow-sm ${searchOpen
          ? searchQuery.trim() && searchResults.length > 0
            ? 'max-h-[600px] py-4 opacity-100'
            : 'max-h-24 py-4 opacity-100'
          : 'max-h-0 py-0 opacity-0 border-transparent shadow-none'
          }`}
      >
        <div className="max-w-3xl mx-auto px-6">
          <form onSubmit={handleSearch} className="relative flex items-center">
            <Search className="absolute left-3 text-grey-beige" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, ingredients, treatments..."
              className="w-full pl-10 pr-4 py-3 bg-neutral-50/50 backdrop-blur-sm border border-silk rounded focus:outline-none focus:border-dark-red/50 focus:ring-1 focus:ring-dark-red/30 transition-all font-sans text-sm text-dark-red placeholder:text-gray-400"
              autoFocus={searchOpen}
            />
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery('');
              }}
              className="absolute right-3 text-gray-400 hover:text-dark-red transition-colors"
            >
              <X size={18} />
            </button>
          </form>

          {/* Search Results Dropdown */}
          <div
            className={`transition-all duration-300 ease-in-out flex flex-col ${searchQuery.trim() && searchResults.length > 0 ? 'opacity-100 mt-4 translate-y-0' : 'opacity-0 h-0 overflow-hidden -translate-y-4'
              }`}
          >
            <div className="bg-white/80 backdrop-blur-md border flex flex-col border-silk rounded shadow-sm">
              {searchResults.map((p) => (
                <button
                  key={p.pid}
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                    navigateTo('product', p.pid);
                  }}
                  className="w-full flex items-center gap-4 p-3 hover:bg-neutral-50 transition-colors text-left border-b border-silk last:border-b-0"
                >
                  <img
                    loading="lazy"
                    decoding="async"
                    src={p.images?.[0] || 'https://placehold.co/100x100?text=Product'}
                    alt={p.name || 'Product'}
                    className="w-12 h-12 object-contain p-0.5 mix-blend-multiply rounded"
                  />
                  <div className="flex-1">
                    <h4 className="font-serif text-dark-red text-base leading-tight">{p.name || 'Unnamed Product'}</h4>
                    <p className="text-[10px] font-sans text-grey-beige uppercase tracking-widest mt-1">
                      {p.category || 'Beauty'}
                    </p>
                  </div>
                  <span className="font-sans text-sm text-dark-red">₹{Number(p.price || 0).toFixed(0)}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setShopFilter('all');
                navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
                setSearchOpen(false);
                setSearchQuery('');
              }}
              className="w-full text-center py-3 mt-2 text-xs font-sans tracking-widest uppercase text-ruby-red hover:text-dark-red transition-colors"
            >
              View all results for "{searchQuery}"
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-silk overflow-y-auto" style={{ maxHeight: 'calc(100vh - 64px)' }}>
          <div className="px-6 py-4">
            {NAV_LINKS.map((link) => (
              <div key={link.label} className="border-b border-silk-light last:border-b-0 py-1">
                {link.isMegaMenu ? (
                  <div className="space-y-1">
                    <button
                      onClick={() => setActiveMegaMenu(activeMegaMenu === link.label ? null : link.label)}
                      className="w-full flex items-center justify-between text-left text-sm font-sans font-medium tracking-widest uppercase text-dark-red py-3"
                    >
                      {link.label}
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-300 text-ruby-red ${activeMegaMenu === link.label ? 'rotate-180' : ''}`}
                      />
                    </button>

                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${activeMegaMenu === link.label ? 'max-h-[500px] opacity-100 pb-3' : 'max-h-0 opacity-0'
                        }`}
                    >
                      <div className="pl-4 space-y-4 border-l-2 border-silk-light ml-2">
                        {Object.entries(MEGA_MENU_DATA)
                          .filter(([key]) => key === link.label.toLowerCase())
                          .map(([key, section]) => (
                            <div key={key}>
                              <ul className="space-y-3">
                                {section.items.map((item, idx) => (
                                  <li key={idx}>
                                    <Link
                                      to={`/shop?category=${item.category || section.filter}&sub_category=${item.filter}`}
                                      onClick={() => handleNav(item.category || section.filter)}
                                      className="block text-sm font-sans text-grey-beige hover:text-ruby-red transition-colors py-1"
                                    >
                                      {item.label}
                                    </Link>
                                  </li>
                                ))}
                              </ul>

                              <Link
                                to={`/shop?category=${section.filter}`}
                                onClick={() => handleNav(section.filter)}
                                className="block mt-4 text-xs font-sans tracking-widest uppercase text-ruby-red font-medium"
                              >
                                {section.subLabel || `View All ${section.label} →`}
                              </Link>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    to={`/${link.page}${link.query ? '?' + link.query : ''}`}
                    onClick={() => handleNav(undefined)}
                    className="block w-full text-left text-sm font-sans font-medium tracking-widest uppercase text-dark-red/80 hover:text-ruby-red py-3 transition-colors"
                  >
                    {link.label}
                  </Link>
                )}
              </div>
            ))}

            {authStatus === 'authenticated' && (user?.role === 'admin' || user?.role === 'primary_admin') && (
              <div className="mt-6 pt-6 border-t border-silk">
                <Link
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-4 bg-ruby-red text-white text-sm font-sans font-bold tracking-widest uppercase rounded shadow-md hover:bg-dark-red transition-colors"
                >
                  <ShieldCheck size={18} />
                  Admin Dashboard
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
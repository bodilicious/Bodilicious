import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  History, 
  LogOut,
  Menu, 
  X,
  RotateCcw,
  Tag,
  BarChart2,
  Crown,
  Ticket,
  ShoppingBag,
  FilePlus,
  Settings,
  AlertOctagon,
  Monitor,
  Image,
  ChevronDown,
  Store
} from 'lucide-react';



import { useApp } from '../context/AppContext';
import NotificationsDrawer from './NotificationsDrawer';

const AdminLayout: React.FC = () => {
  const { logout, user, isPrimaryAdmin, getAuthHeaders } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  // Default to closed
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };
  
  const [tooltipData, setTooltipData] = useState<{ text: string; top: number; left: number } | null>(null);

  const [notificationCounts, setNotificationCounts] = useState({
    tickets: 0,
    users: 0,
    logs: 0,
    orders: 0,
    returns: 0
  });
  const [criticalAlerts, setCriticalAlerts] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchCounts = async () => {
      try {
        const headers = await getAuthHeaders();
        const lastViewedOrders = localStorage.getItem('adminLastViewedOrders');
        const lastViewedReturns = localStorage.getItem('adminLastViewedReturns');
        
        const url = `${import.meta.env.VITE_API_URL}/api/v1/admin/sidebar-badges?`;
        const params = new URLSearchParams();
        if (lastViewedOrders) params.append('lastViewedOrders', lastViewedOrders);
        if (lastViewedReturns) params.append('lastViewedReturns', lastViewedReturns);
        
        const res = await fetch(url + params.toString(), { headers });
        const json = await res.json();
        if (json.success && isMounted) {
          setNotificationCounts(prev => ({
            ...prev,
            tickets: json.data.tickets || 0,
            users: json.data.users || 0,
            logs: json.data.logs || 0,
            // Only update orders and returns if we are NOT currently on that page
            orders: window.location.pathname === '/admin/orders' ? 0 : (json.data.orders || 0),
            returns: window.location.pathname === '/admin/returns' ? 0 : (json.data.returns || 0)
          }));
        }

        const notifRes = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/notifications?limit=20`, { headers });
        const notifData = await notifRes.json();
        if (notifData.success && isMounted) {
          const critical = notifData.data.filter((n: any) => !n.isRead && (n.type === 'critical' || n.type === 'warning'));
          setCriticalAlerts(critical);
        }
      } catch (err) {
        console.error("Failed to fetch notification counts", err);
      }
    };
    if (user) {
      fetchCounts();
      const interval = setInterval(() => {
          if (document.visibilityState === 'visible') fetchCounts();
      }, 3600000); // refresh every 1 hour to conserve bandwidth
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [user, getAuthHeaders]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>, text: string) => {
    if (!isSidebarOpen && window.innerWidth > 1024) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipData({ text, top: rect.top + rect.height / 2, left: rect.right + 8 });
    }
  };

  const handleMouseLeave = () => {
    setTooltipData(null);
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar on mobile when navigating, and clear relevant badges
  useEffect(() => {
    if (window.innerWidth <= 1024) {
      setIsSidebarOpen(false);
    }
    
    if (location.pathname === '/admin/orders') {
      localStorage.setItem('adminLastViewedOrders', Date.now().toString());
      setNotificationCounts(prev => ({ ...prev, orders: 0 }));
    }
    if (location.pathname === '/admin/returns') {
      localStorage.setItem('adminLastViewedReturns', Date.now().toString());
      setNotificationCounts(prev => ({ ...prev, returns: 0 }));
    }
  }, [location.pathname]);

  const menuGroups = [
    {
      title: 'Dashboard',
      items: [
        { name: 'Overview', path: '/admin', icon: LayoutDashboard },
        { name: 'Analytics', path: '/admin/analytics', icon: BarChart2 },
      ]
    },
    {
      title: 'Sales & Orders',
      items: [
        { name: 'Orders', path: '/admin/orders', icon: ShoppingCart, badge: notificationCounts.orders },
        { name: 'Draft Orders', path: '/admin/draft-orders', icon: FilePlus },
        { name: 'Returns', path: '/admin/returns', icon: RotateCcw, badge: notificationCounts.returns },
        { name: 'Abandoned', path: '/admin/abandoned-checkouts', icon: ShoppingBag },
      ]
    },
    {
      title: 'Catalog',
      items: [
        { name: 'Products', path: '/admin/products', icon: Package },
        { name: 'Media Library', path: '/admin/media', icon: Image },
      ]
    },
    {
      title: 'Customers',
      items: [
        { name: 'Users', path: '/admin/users', icon: Users, badge: notificationCounts.users },
        { name: 'Support Tickets', path: '/admin/tickets', icon: Ticket, badge: notificationCounts.tickets },
      ]
    },
    {
      title: 'Marketing & Store',
      items: [
        { name: 'Coupons', path: '/admin/coupons', icon: Tag },
        { name: 'Live Builder', path: '/admin/homepage-editor', icon: Monitor },
      ]
    },
    {
      title: 'System',
      items: [
        { name: 'Settings', path: '/admin/settings', icon: Settings },
        { name: 'Error Rates', path: '/admin/errors', icon: AlertOctagon },
        { name: 'Audit Logs', path: '/admin/logs', icon: History, badge: notificationCounts.logs },
      ]
    }
  ];

  const allMenuItems = menuGroups.flatMap(g => g.items);

  const handleLogout = async () => {
    await logout();
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex font-sans">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        onMouseEnter={() => { if (window.innerWidth > 1024) setIsSidebarOpen(true); }}
        onMouseLeave={() => { if (window.innerWidth > 1024) { setIsSidebarOpen(false); setCollapsedGroups({}); } }}
        className={`bg-white border-r border-gray-200 transition-all duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] flex flex-col fixed h-full z-30 overflow-x-hidden ${
          isSidebarOpen 
            ? 'translate-x-0 w-64 lg:shadow-xl' 
            : '-translate-x-full lg:translate-x-0 lg:w-16 w-64'
        }`}
      >
        <div className={`flex items-center transition-all duration-[400ms] ${isSidebarOpen ? 'p-5 justify-between' : 'p-5 lg:px-0 justify-center'}`}>
          <div className={`overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] whitespace-nowrap ${isSidebarOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
            <Link to="/" className="text-2xl font-serif font-bold text-dark-red tracking-tight leading-none pt-1 flex flex-col">
              Bodilicious
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] font-sans font-bold text-grey-beige tracking-widest uppercase">
                  {isPrimaryAdmin ? 'Primary Admin' : 'Admin'}
                </span>
                {isPrimaryAdmin && (
                  <span title="Super Access">
                    <Crown size={12} className="text-amber-500" />
                  </span>
                )}
              </div>
            </Link>
          </div>
          
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 hover:bg-[#F5F2EC] text-dark-red rounded-md transition-all duration-200 hover:scale-110 lg:hidden"
          >
            <X size={20} className="animate-in zoom-in spin-in-12" />
          </button>
        </div>

        <nav className="flex-1 mt-1 px-2 overflow-y-auto scrollbar-hide">
          {menuGroups.map((group, idx) => {
            const isGroupCollapsed = isSidebarOpen && collapsedGroups[group.title];
            return (
            <div key={group.title} className={idx > 0 ? 'mt-2 pt-2 border-t border-gray-100/50' : ''}>
              <button 
                onClick={() => toggleGroup(group.title)}
                className={`w-full flex items-center justify-between px-3 text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 hover:text-gray-800 transition-all duration-[400ms] whitespace-nowrap overflow-hidden ${isSidebarOpen ? 'opacity-100 max-w-[240px]' : 'opacity-0 max-w-0 pointer-events-none'}`}
              >
                {group.title}
                <ChevronDown size={14} className={`transition-transform duration-200 ${isGroupCollapsed ? '-rotate-90' : ''}`} />
              </button>
              <div className={`space-y-0.5 ${isGroupCollapsed ? 'hidden' : 'block'}`}>
              {group.items.map((item) => {
                const isActive = location.pathname === item.path || (item.path === '/admin' && location.pathname === '/admin/');
                const Icon = item.icon;
                const targetPath = item.badge && item.badge > 0 && item.path === '/admin/logs' 
                  ? '/admin/logs?event_type=PAYMENT_FAILED' 
                  : item.badge && item.badge > 0 && item.path === '/admin/tickets'
                  ? '/admin/tickets?status=open'
                  : item.path;

                return (
                  <Link
                    key={item.name}
                    to={targetPath}
                    onMouseEnter={(e) => handleMouseEnter(e, item.name)}
                    onMouseLeave={handleMouseLeave}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-xl transition-all ${
                      isActive 
                        ? 'bg-[#F5F2EC] text-dark-red font-bold shadow-sm' 
                        : 'text-grey-beige hover:bg-[#F5F2EC] hover:text-dark-red'
                    }`}
                  >
                    <div className="flex items-center gap-3 relative">
                      <Icon size={20} className="shrink-0" />
                      {!isSidebarOpen && item.badge && item.badge > 0 ? (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-b-burgundy rounded-full border border-white hidden lg:block"></span>
                      ) : null}
                      <span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-[400ms] ${
                        isSidebarOpen ? 'opacity-100 translate-x-0 max-w-[200px]' : 'opacity-0 -translate-x-2 max-w-0'
                      }`}>
                        {item.name}
                      </span>
                    </div>
                    {item.badge && item.badge > 0 ? (
                      <span className={`bg-b-burgundy text-white text-[10px] font-bold px-2 py-0.5 rounded-full transition-all duration-[400ms] ${isSidebarOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-50 absolute right-2 pointer-events-none'}`}>
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
              </div>
            </div>
          )})}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            onMouseEnter={(e) => handleMouseEnter(e, 'Sign Out')}
            onMouseLeave={handleMouseLeave}
            className="w-full flex items-center gap-3 px-3 py-2 text-grey-beige hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
          >
            <LogOut size={20} className="shrink-0" />
            <span className={`font-medium whitespace-nowrap overflow-hidden transition-all duration-[400ms] ${
              isSidebarOpen ? 'opacity-100 translate-x-0 max-w-[200px]' : 'opacity-0 -translate-x-2 max-w-0'
            }`}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 w-full min-w-0 lg:ml-16 ml-0 ${location.pathname === '/admin/homepage-editor' ? 'p-0 flex flex-col overflow-hidden' : 'p-3 sm:p-6 lg:p-8'}`} style={location.pathname === '/admin/homepage-editor' ? { height: '100vh', maxHeight: '100vh' } : {}}>
        {/* Header - hidden on homepage editor which has its own header */}
        {location.pathname !== '/admin/homepage-editor' && (
        <header className="mb-6 lg:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-dark-red rounded-lg hover:bg-[#F5F2EC] transition-colors lg:hidden"
            >
              <Menu size={24} />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-dark-red">
                {allMenuItems.find(i => i.path === location.pathname)?.name || 'Admin Panel'}
              </h1>
              <p className="text-grey-beige text-xs sm:text-sm font-medium mt-1">Welcome back, {user?.displayName || 'Admin'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 self-end sm:self-auto">
            <Link 
              to="/" 
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white text-dark-red text-sm font-bold border border-gray-200 rounded-xl shadow-sm hover:bg-[#F5F2EC] transition-colors"
              title="Back to Store"
            >
              <Store size={18} />
              <span className="hidden sm:inline">Back to Store</span>
            </Link>
            <NotificationsDrawer />
            <div className="flex flex-col items-end">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm overflow-hidden">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Admin" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                    {user?.displayName?.[0] || 'A'}
                  </div>
                )}
              </div>
              {isPrimaryAdmin && (
                <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-600 uppercase tracking-wider mt-0.5">
                  <Crown size={9} /> Primary
                </span>
              )}
            </div>
          </div>
        </header>
        )}

        {/* Critical Alerts Global Banner */}
        {criticalAlerts.length > 0 && location.pathname !== '/admin/homepage-editor' && (
          <div className="bg-red-50/80 border border-red-200 rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertOctagon size={20} className="text-red-600 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
              </div>
              <h2 className="text-lg font-bold text-red-900 tracking-tight">Attention Required ({criticalAlerts.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {criticalAlerts.slice(0, 3).map(n => (
                <div key={n._id} className="bg-white p-4 rounded-xl border border-red-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 line-clamp-1">{n.title}</p>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{n.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Area - bypass card wrapper for homepage editor */}
        {location.pathname === '/admin/homepage-editor' ? (
          <Outlet />
        ) : (
          <div className="bg-white rounded-2xl lg:rounded-3xl shadow-sm border border-silk-light min-h-[calc(100vh-12rem)] p-3 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        )}
      </main>
      {/* Fixed Tooltip */}
      {tooltipData && (
        <div 
          className="fixed z-50 pointer-events-none rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-md -translate-y-1/2 transition-opacity animate-in fade-in"
          style={{ top: tooltipData.top, left: tooltipData.left }}
        >
          {tooltipData.text}
        </div>
      )}
    </div>
  );
};

export default AdminLayout;

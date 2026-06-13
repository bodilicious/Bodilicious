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
  AlertOctagon
} from 'lucide-react';



import { useApp } from '../context/AppContext';
import NotificationsDrawer from './NotificationsDrawer';

const AdminLayout: React.FC = () => {
  const { logout, user, isPrimaryAdmin, getAuthHeaders } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  // Default to closed on mobile, open on desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [tooltipData, setTooltipData] = useState<{ text: string; top: number; left: number } | null>(null);

  // Live notification counts
  const [notificationCounts, setNotificationCounts] = useState({
    tickets: 0,
    users: 0,
    logs: 0
  });

  useEffect(() => {
    let isMounted = true;
    const fetchCounts = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/sidebar-badges`, { headers });
        const json = await res.json();
        if (json.success && isMounted) {
          setNotificationCounts({
            tickets: json.data.tickets || 0,
            users: json.data.users || 0,
            logs: json.data.logs || 0
          });
        }
      } catch (err) {
        console.error("Failed to fetch notification counts", err);
      }
    };
    if (user) {
      fetchCounts();
      const interval = setInterval(fetchCounts, 60000); // refresh every minute
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

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (window.innerWidth <= 1024) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  const menuGroups = [
    {
      title: 'Overview',
      items: [
        { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
        { name: 'Analytics', path: '/admin/analytics', icon: BarChart2 },
        { name: 'Error Rates', path: '/admin/errors', icon: AlertOctagon },
      ]
    },
    {
      title: 'Store',
      items: [
        { name: 'Products', path: '/admin/products', icon: Package },
        { name: 'Orders', path: '/admin/orders', icon: ShoppingCart },
        { name: 'Draft Orders', path: '/admin/draft-orders', icon: FilePlus },
        { name: 'Abandoned', path: '/admin/abandoned-checkouts', icon: ShoppingBag },
        { name: 'Returns', path: '/admin/returns', icon: RotateCcw },
      ]
    },
    {
      title: 'Marketing & CRM',
      items: [
        { name: 'Coupons', path: '/admin/coupons', icon: Tag },
        { name: 'Users & Segments', path: '/admin/users', icon: Users, badge: notificationCounts.users },
        { name: 'Support Tickets', path: '/admin/tickets', icon: Ticket, badge: notificationCounts.tickets },
      ]
    },
    {
      title: 'Settings',
      items: [
        { name: 'Settings', path: '/admin/settings', icon: Settings },
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
        className={`bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col fixed h-full z-30 ${
          isSidebarOpen 
            ? 'translate-x-0 w-64' 
            : '-translate-x-full lg:translate-x-0 lg:w-16 w-64'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen ? (
            <Link to="/" className="text-2xl font-serif font-bold text-dark-red tracking-tight leading-none pt-1">
              Bodilicious
              <span className="text-[10px] font-sans font-bold text-grey-beige block mt-1 tracking-widest uppercase">
                {isPrimaryAdmin ? 'Primary Admin' : 'Admin'}
              </span>
              {isPrimaryAdmin && (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold tracking-widest uppercase">
                  <Crown size={9} /> Super Access
                </span>
              )}
            </Link>
          ) : (
            <Link to="/" className="text-2xl font-serif font-bold text-dark-red mx-auto hidden lg:block">
              {isPrimaryAdmin ? <Crown size={20} className="text-amber-600" /> : 'B.'}
            </Link>
          )}
          
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 hover:bg-[#F5F2EC] text-dark-red rounded-md transition-all duration-200 hover:scale-110 lg:block hidden"
          >
            {isSidebarOpen ? <X size={20} className="animate-in zoom-in spin-in-12" /> : <Menu size={20} className="animate-in zoom-in" />}
          </button>

          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 hover:bg-[#F5F2EC] text-dark-red rounded-md transition-all duration-200 hover:scale-110 lg:hidden"
          >
            <X size={20} className="animate-in zoom-in spin-in-12" />
          </button>
        </div>

        <nav className="flex-1 mt-2 px-3 space-y-1 overflow-y-auto">
          {menuGroups.map((group, idx) => (
            <div key={group.title} className={idx > 0 ? 'mt-4 pt-4 border-t border-gray-100/50' : ''}>
              <p className={`px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ${isSidebarOpen ? 'block' : 'hidden lg:hidden'}`}>
                {group.title}
              </p>
              {group.items.map((item) => {
                const isActive = location.pathname === item.path;
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
                    className={`flex items-center justify-between px-4 py-2.5 rounded-r-xl rounded-l-none transition-all my-1 ${
                      isActive 
                        ? 'border-l-4 border-dark-red bg-[#F5F2EC] text-dark-red font-bold' 
                        : 'border-l-4 border-transparent text-grey-beige hover:bg-[#F5F2EC] hover:text-dark-red'
                    }`}
                  >
                    <div className="flex items-center gap-3 relative">
                      <Icon size={20} className="shrink-0" />
                      {!isSidebarOpen && item.badge && item.badge > 0 ? (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-b-burgundy rounded-full border border-white hidden lg:block"></span>
                      ) : null}
                      <span className={`text-sm whitespace-nowrap transition-opacity duration-200 ${
                        isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'
                      }`}>
                        {item.name}
                      </span>
                    </div>
                    {item.badge && item.badge > 0 ? (
                      <span className={`bg-b-burgundy text-white text-[10px] font-bold px-2 py-0.5 rounded-full ${isSidebarOpen ? 'block' : 'hidden lg:hidden'}`}>
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            onMouseEnter={(e) => handleMouseEnter(e, 'Sign Out')}
            onMouseLeave={handleMouseLeave}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-grey-beige hover:bg-[#F5F2EC] hover:text-dark-red border-l-4 border-transparent rounded-r-xl rounded-l-none transition-all"
          >
            <LogOut size={20} className="shrink-0" />
            <span className={`font-medium whitespace-nowrap transition-opacity duration-200 ${
              isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'
            }`}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 w-full min-w-0 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-16'} ml-0 p-3 sm:p-6 lg:p-8`}>
        {/* Header */}
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

        {/* Content Area */}
        <div className="bg-white rounded-2xl lg:rounded-3xl shadow-sm border border-silk-light min-h-[calc(100vh-12rem)] p-3 sm:p-6 lg:p-8">
          <Outlet />
        </div>
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

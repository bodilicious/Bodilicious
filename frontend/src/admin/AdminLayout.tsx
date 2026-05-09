import React, { useState } from 'react';
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
  Crown
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import NotificationsDrawer from './NotificationsDrawer';

const AdminLayout: React.FC = () => {
  const { logout, user, isPrimaryAdmin } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const menuItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Insights', path: '/admin/insights', icon: BarChart2 },
    { name: 'Products', path: '/admin/products', icon: Package },
    { name: 'Orders', path: '/admin/orders', icon: ShoppingCart },
    { name: 'Returns', path: '/admin/returns', icon: RotateCcw },
    { name: 'Coupons', path: '/admin/coupons', icon: Tag },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Audit Logs', path: '/admin/logs', icon: History },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-silk-light/30 flex font-sans">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col fixed h-full z-20`}
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
            <Link to="/" className="text-2xl font-serif font-bold text-dark-red">
              {isPrimaryAdmin ? <Crown size={20} className="text-amber-600" /> : 'B.'}
            </Link>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 hover:bg-silk-light text-dark-red rounded-md lg:hidden transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 mt-6 px-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-dark-red text-white shadow-md shadow-dark-red/20' 
                    : 'text-grey-beige hover:bg-silk-light hover:text-dark-red'
                }`}
              >
                <Icon size={20} />
                {isSidebarOpen && <span className="font-medium text-sm">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-grey-beige hover:bg-ruby-red hover:text-white rounded-xl transition-all"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'} p-8`}>
        {/* Header */}
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-serif font-bold text-dark-red">
              {menuItems.find(i => i.path === location.pathname)?.name || 'Admin Panel'}
            </h1>
            <p className="text-grey-beige text-sm font-medium mt-1">Welcome back, {user?.displayName || 'Admin'}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <NotificationsDrawer />
            <div className="flex flex-col items-end">
              <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm overflow-hidden">
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
        <div className="bg-white rounded-3xl shadow-sm border border-silk-light min-h-[calc(100vh-12rem)] p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;

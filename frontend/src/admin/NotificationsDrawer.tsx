import React, { useEffect, useState, useCallback } from 'react';
import { Bell, X, CheckCheck, Info, AlertTriangle, AlertOctagon, Sparkles, Circle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';

const TYPE_CONFIG: Record<string, { bg: string, iconBg: string, text: string, border: string, icon: React.FC<any>, gradient: string }> = {
  info: { bg: 'bg-blue-50', iconBg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', icon: Info, gradient: 'from-blue-50/80 to-white' },
  warning: { bg: 'bg-orange-50', iconBg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200', icon: AlertTriangle, gradient: 'from-orange-50/80 to-white' },
  critical: { bg: 'bg-red-50', iconBg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', icon: AlertOctagon, gradient: 'from-red-50/80 to-white' },
  default: { bg: 'bg-gray-50', iconBg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: Bell, gradient: 'from-gray-50/80 to-white' }
};

interface Notification {
  _id: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'critical' | string;
  isRead: boolean;
  createdAt: string;
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const NotificationsDrawer: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const API = import.meta.env.VITE_API_URL || '';

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/v1/admin/notifications/unread-count`, { headers });
      const data = await res.json();
      if (data.success) setUnreadCount(data.data.count);
    } catch { /* silent */ }
  }, [getAuthHeaders, API]);

  const fetchNotifications = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/v1/admin/notifications?page=${p}&limit=15`, { headers });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => p === 1 ? data.data : [...prev, ...data.data]);
        setHasMore(p < data.pagination.pages);
        setPage(p);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [getAuthHeaders, API]);

  // Poll unread count every 60s
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const onOpen = () => {
    setOpen(true);
    fetchNotifications(1);
  };

  const markOneRead = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API}/api/v1/admin/notifications/${id}/read`, { method: 'PATCH', headers });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch { toast.error('Failed to mark as read'); }
  };

  const markAllRead = async () => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API}/api/v1/admin/notifications/read-all`, { method: 'PATCH', headers });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch { toast.error('Failed to mark all as read'); }
  };

  const hasUnread = unreadCount > 0;

  return (
    <>
      {/* Enhanced Bell Button */}
      <div className="relative flex items-center justify-center">
        {hasUnread && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-20 animate-ping"></span>
        )}
        <button 
          onClick={onOpen} 
          className={`relative flex items-center justify-center p-2.5 rounded-full transition-all duration-300 ${
            hasUnread 
              ? 'bg-red-50 text-red-600 hover:bg-red-100 shadow-sm shadow-red-100/50' 
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
          title="Notifications"
        >
          <Bell 
            size={22} 
            className={`transition-all ${hasUnread ? 'fill-red-100 origin-top' : ''}`} 
            style={hasUnread ? { animation: 'wiggle 1.5s ease-in-out infinite' } : {}}
          />
          {hasUnread && (
            <span className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4 min-w-[20px] h-[20px] px-1.5 flex items-center justify-center bg-gradient-to-tr from-red-600 to-red-500 text-white text-[11px] font-black rounded-full border-[2.5px] border-white shadow-md">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {hasUnread && (
          <style>{`
            @keyframes wiggle {
              0%, 100% { transform: rotate(-10deg); }
              50% { transform: rotate(10deg); }
            }
          `}</style>
        )}
      </div>

      {/* Drawer */}
      {open && (
        <>
          <div 
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity duration-300" 
            onClick={() => setOpen(false)} 
          />
          <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white/95 backdrop-blur-xl z-50 shadow-2xl flex flex-col sm:rounded-l-3xl border-l border-white/50 transform transition-transform duration-300 ease-out">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100/80 bg-white/50 rounded-tl-3xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-xl">
                  <Bell size={20} className="text-slate-800" />
                </div>
                <h2 className="font-bold text-lg text-slate-800 tracking-tight">Notifications</h2>
                {hasUnread && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm shadow-red-500/30">
                    {unreadCount > 99 ? '99+' : unreadCount} new
                  </span>
                )}
              </div>
              <button 
                onClick={() => setOpen(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Mark all read */}
            {hasUnread && (
              <div className="px-6 py-3 border-b border-gray-50 bg-slate-50/50 flex justify-end">
                <button 
                  onClick={markAllRead}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:shadow"
                >
                  <CheckCheck size={14} className="text-emerald-500" /> Mark all as read
                </button>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading && notifications.length === 0 ? (
                <div className="space-y-4 p-6">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4 items-start animate-pulse">
                      <div className="w-10 h-10 bg-slate-100 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-100 rounded w-3/4" />
                        <div className="h-3 bg-slate-50 rounded w-full" />
                        <div className="h-3 bg-slate-50 rounded w-5/6" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-8 pb-12">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100 shadow-inner">
                    <Sparkles size={40} className="text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">You're all caught up!</h3>
                  <p className="text-sm font-medium text-slate-500">There are no new notifications right now. Check back later.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50/50 p-2">
                  {notifications.map(n => {
                    const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.default;
                    const Icon = config.icon;
                    return (
                      <div 
                        key={n._id}
                        onClick={() => !n.isRead && markOneRead(n._id)}
                        className={`group relative p-4 m-2 rounded-2xl cursor-pointer transition-all duration-300 border ${
                          n.isRead 
                            ? 'border-transparent hover:bg-slate-50' 
                            : `bg-gradient-to-br ${config.gradient} shadow-sm border-white hover:shadow-md hover:-translate-y-0.5`
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-2.5 rounded-full shrink-0 transition-transform group-hover:scale-110 ${
                            n.isRead ? 'bg-slate-100 text-slate-400' : `${config.iconBg} ${config.text}`
                          }`}>
                            <Icon size={18} strokeWidth={n.isRead ? 2 : 2.5} />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <p className={`text-sm font-bold leading-tight ${n.isRead ? 'text-slate-600' : 'text-slate-900'}`}>
                                {n.title}
                              </p>
                              {!n.isRead && (
                                <Circle size={10} className="fill-blue-500 text-blue-500 shrink-0 mt-1" />
                              )}
                            </div>
                            <p className={`text-xs mt-1.5 leading-relaxed line-clamp-2 ${n.isRead ? 'text-slate-500' : 'text-slate-700'}`}>
                              {n.body}
                            </p>
                            <p className={`text-[11px] font-semibold mt-2.5 ${n.isRead ? 'text-slate-400' : config.text}`}>
                              {timeAgo(n.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {hasMore && (
                    <div className="p-6 text-center">
                      <button 
                        onClick={() => fetchNotifications(page + 1)} 
                        disabled={loading}
                        className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {loading ? 'Loading...' : 'Load older notifications'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default NotificationsDrawer;

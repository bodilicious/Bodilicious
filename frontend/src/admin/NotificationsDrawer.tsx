import React, { useEffect, useState, useCallback } from 'react';
import { Bell, X, CheckCheck, BellOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';

const TYPE_STYLES: Record<string, string> = {
  info: 'bg-blue-500',
  warning: 'bg-orange-500',
  critical: 'bg-red-500',
};

interface Notification {
  _id: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'critical';
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

  return (
    <>
      {/* Bell Button */}
      <button onClick={onOpen} className="p-2 text-gray-400 hover:text-gray-600 relative" title="Notifications">
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full border-2 border-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Drawer */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Bell size={18} className="text-dark-red" />
                <h2 className="font-bold text-gray-800">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X size={16} /></button>
            </div>

            {/* Mark all read */}
            {unreadCount > 0 && (
              <div className="px-6 py-3 border-b border-gray-50">
                <button onClick={markAllRead}
                  className="flex items-center gap-2 text-xs font-semibold text-dark-red hover:opacity-80 transition-opacity">
                  <CheckCheck size={14} /> Mark all as read
                </button>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="space-y-3 p-4">
                  {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-2xl" />)}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <BellOff size={40} className="mb-3 opacity-30" />
                  <p className="text-sm font-medium">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map(n => (
                    <div key={n._id}
                      onClick={() => !n.isRead && markOneRead(n._id)}
                      className={`p-5 cursor-pointer transition-colors ${n.isRead ? 'hover:bg-gray-50/50' : 'bg-blue-50/30 hover:bg-blue-50/60'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${TYPE_STYLES[n.type]}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${n.isRead ? 'text-gray-600' : 'text-gray-800'}`}>{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                          <p className="text-xs text-gray-400 mt-1.5">{timeAgo(n.createdAt)}</p>
                        </div>
                        {!n.isRead && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-2" />}
                      </div>
                    </div>
                  ))}
                  {hasMore && (
                    <div className="p-4 text-center">
                      <button onClick={() => fetchNotifications(page + 1)} disabled={loading}
                        className="text-sm text-dark-red font-semibold hover:opacity-80">
                        {loading ? 'Loading…' : 'Load more'}
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

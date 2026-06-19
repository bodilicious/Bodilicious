import React, { useEffect, useState, useCallback } from 'react';
import { 
  ShoppingCart, 
  Mail, 
  Phone, 
  ChevronLeft, 
  ChevronRight,
  Clock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '';

const AbandonedCheckouts: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchAbandoned = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/orders/abandoned-checkouts?page=${page}&limit=10`, { headers });
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
        setPages(data.pages);
        setTotal(data.total);
      }
    } catch (err) {
      toast.error('Failed to fetch abandoned checkouts');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, page]);

  useEffect(() => {
    fetchAbandoned();
  }, [fetchAbandoned]);

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} days ago`;
    return `${hours} hours ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif font-bold text-dark-red">Abandoned Checkouts</h2>
          <p className="text-sm text-grey-beige mt-1">Carts pending payment for &gt; 30 minutes</p>
        </div>
        <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-xl text-sm font-bold border border-orange-200 flex items-center gap-2">
          <ShoppingCart size={16} />
          {total} Abandoned Carts
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-silk-light overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-silk-light bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Customer Info</th>
                <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Cart Details</th>
                <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Time Since</th>
                <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider text-right">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silk-light/50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8 h-16 bg-white" />
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
                    No abandoned checkouts found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order._id} className="hover:bg-silk-light/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-dark-red text-sm">
                        {order.shippingDetails?.name || order.user?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-grey-beige flex items-center gap-1 mt-1">
                        <Mail size={12} /> {order.shippingDetails?.email || order.user?.email || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-800">
                        {order.items?.length} items
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        ID: {order._id.slice(-8).toUpperCase()}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-dark-red">
                      ₹{(order.totalAmount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
                        <Clock size={12} />
                        {getTimeAgo(order.createdAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {order.shippingDetails?.phone && (
                          <a href={`tel:${order.shippingDetails.phone}`} className="p-2 text-green-600 hover:bg-green-50 rounded-lg border border-transparent hover:border-green-200 transition-all" title="Call Customer">
                            <Phone size={16} />
                          </a>
                        )}
                        {(order.shippingDetails?.email || order.user?.email) && (
                          <a href={`mailto:${order.shippingDetails?.email || order.user?.email}?subject=Did you forget something at Bodilicious?&body=Hi ${order.shippingDetails?.name},%0D%0A%0D%0AWe noticed you left some items in your cart...`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-200 transition-all" title="Email Customer">
                            <Mail size={16} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center p-4 border-t border-silk-light bg-gray-50/50">
          <p className="text-sm text-grey-beige">
            Showing <span className="font-bold text-dark-red">{orders.length}</span> of <span className="font-bold text-dark-red">{total}</span>
          </p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 border border-silk-light rounded-xl disabled:opacity-30 hover:bg-white bg-white shadow-sm">
              <ChevronLeft size={16} className="text-dark-red" />
            </button>
            <div className="flex items-center px-2 text-sm font-bold text-dark-red">
              {pages === 0 ? 0 : page} / {pages}
            </div>
            <button disabled={page >= pages || pages === 0} onClick={() => setPage(p => p + 1)} className="p-2 border border-silk-light rounded-xl disabled:opacity-30 hover:bg-white bg-white shadow-sm">
              <ChevronRight size={16} className="text-dark-red" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AbandonedCheckouts;

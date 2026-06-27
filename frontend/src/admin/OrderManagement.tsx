import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Eye, 
  ChevronLeft,
  ChevronRight,
  Download,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Tag,
  CheckSquare,
  Square,
  Layers,
  RefreshCw,
  Send,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import OrderTimelineModal from './OrderTimelineModal';
import ShippingLabel from './ShippingLabel';
import Select from '../components/Select';
import { formatCurrency } from '../utils/currencies';

const OrderManagement: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ orderStatus: '', paymentStatus: '', range: '30' });

  // modal/drawer state
  const [timelineOrder, setTimelineOrder] = useState<any | null>(null);
  const [labelOrder, setLabelOrder]       = useState<any | null>(null);
  const navigate = useNavigate();

  // bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus]   = useState('shipped');
  const [bulkLoading, setBulkLoading] = useState(false);

  // per-row Shiprocket action loading
  const [srLoading, setSrLoading] = useState<Record<string, 'push' | 'sync' | null>>({});

  const API_URL = import.meta.env.VITE_API_URL || '';

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        orderStatus: filters.orderStatus,
        paymentStatus: filters.paymentStatus,
        range: filters.range
      });
      const res = await fetch(`${API_URL}/api/v1/admin/orders?${query}`, { headers });
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
        setTotal(data.total);
        setPages(data.pages);
        setSelectedIds([]);
      }
    } catch {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, API_URL, page, search, filters]);

  useEffect(() => {
    const timeout = setTimeout(fetchOrders, 300);
    return () => clearTimeout(timeout);
  }, [fetchOrders]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, filters]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processing': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200"><Clock size={14} /> Processing</span>;
      case 'shipped':    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200"><Truck size={14} /> Shipped</span>;
      case 'delivered':  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200"><CheckCircle2 size={14} /> Delivered</span>;
      case 'cancelled':  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200"><XCircle size={14} /> Cancelled</span>;
      case 'return_requested': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200"><RotateCcw size={14} /> Return Req</span>;
      case 'returned':   return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200"><RotateCcw size={14} /> Returned</span>;
      default:           return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-700 border border-gray-200"><Clock size={14} /> {status}</span>;
    }
  };

  const handleExport = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/orders/export?range=${filters.range}`, { headers });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_${filters.range}d.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Export started');
    } catch {
      toast.error('Export failed');
    }
  };

  const toggleRow = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAll = () =>
    setSelectedIds(prev => prev.length === orders.length ? [] : orders.map(o => o._id));

  const handleBulkStatus = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Update ${selectedIds.length} selected order(s) to "${bulkStatus}"?`)) return;
    setBulkLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/orders/bulk-status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ ids: selectedIds, orderStatus: bulkStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      toast.success(`Updated ${data.updated} orders. Failed: ${data.failed?.length || 0}`);
      if (data.failed?.length) {
        data.failed.forEach((f: any) => toast.error(`Order ${f.id.slice(-6)}: ${f.reason}`, { duration: 5000 }));
      }
      fetchOrders();
    } catch (e: any) {
      toast.error(e.message || 'Bulk update failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const handlePushShiprocket = async (order: any) => {
    setSrLoading(prev => ({ ...prev, [order._id]: 'push' }));
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/orders/${order._id}/push-shiprocket`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Push failed');
      // Update the local row with the returned order
      setOrders(prev => prev.map(o => o._id === order._id ? { ...o, ...data.data } : o));
      const awb = data.data?.awb;
      toast.success(awb ? `Pushed ✓ AWB: ${awb}` : 'Pushed to Shiprocket (AWB pending)');
    } catch (e: any) {
      toast.error(e.message || 'Failed to push to Shiprocket');
    } finally {
      setSrLoading(prev => ({ ...prev, [order._id]: null }));
    }
  };

  const handleSyncShiprocket = async (order: any) => {
    setSrLoading(prev => ({ ...prev, [order._id]: 'sync' }));
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/orders/${order._id}/sync-shiprocket`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Sync failed');
      setOrders(prev => prev.map(o => o._id === order._id ? { ...o, ...data.data } : o));
      toast.success(data.message === 'Already up to date' ? 'Already up to date' : 'Order synced with Shiprocket ✓');
    } catch (e: any) {
      toast.error(e.message || 'Failed to sync with Shiprocket');
    } finally {
      setSrLoading(prev => ({ ...prev, [order._id]: null }));
    }
  };

  // Open full order for timeline/label (fetch details)
  const openTimeline = async (order: any) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/orders/${order._id}`, { headers });
      const data = await res.json();
      if (data.success) setTimelineOrder(data.data);
      else setTimelineOrder(order);
    } catch {
      setTimelineOrder(order);
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions & Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-grey-beige" size={18} />
          <input
            type="text"
            placeholder="Search by Order ID, Name or Email..."
            className="w-full pl-11 pr-4 py-3 bg-silk-light/50 border-none rounded-2xl outline-none focus:ring-2 ring-dark-red/20 transition-all text-dark-red placeholder:text-grey-beige"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <Select
            className="w-48"
            value={filters.orderStatus}
            onChange={(val) => setFilters(prev => ({ ...prev, orderStatus: val as string }))}
            options={[
              { value: '', label: 'Status: All' },
              { value: 'processing', label: 'Processing' },
              { value: 'shipped', label: 'Shipped' },
              { value: 'delivered', label: 'Delivered' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'return_requested', label: 'Return Requested' },
              { value: 'returned', label: 'Returned' }
            ]}
          />
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="bg-white text-dark-red border border-silk-light px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-sm hover:bg-silk-light/50 transition-all text-sm"
            title="Refresh Orders"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin text-dark-red' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleExport}
            className="bg-white text-dark-red border border-silk-light px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-sm hover:bg-silk-light/50 transition-all text-sm"
          >
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 bg-dark-red/5 border border-dark-red/20 rounded-2xl px-5 py-3 flex-wrap">
          <span className="text-sm font-bold text-dark-red">{selectedIds.length} selected</span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Select
              className="w-40"
              value={bulkStatus}
              onChange={val => setBulkStatus(val as string)}
              options={[
                { value: 'processing', label: '→ Processing' },
                { value: 'shipped', label: '→ Shipped' },
                { value: 'delivered', label: '→ Delivered' },
                { value: 'cancelled', label: '→ Cancelled' }
              ]}
            />
            <button
              onClick={handleBulkStatus}
              disabled={bulkLoading}
              className="bg-dark-red text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-ruby-red transition-colors disabled:opacity-50"
            >
              <Layers size={15} />
              {bulkLoading ? 'Updating…' : 'Apply Status'}
            </button>
            <button onClick={() => setSelectedIds([])} className="text-xs text-grey-beige hover:text-dark-red">Clear</button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="table-scroll-container">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-silk-light">
              <th className="px-3 py-4">
                <button onClick={toggleAll} className="text-gray-400 hover:text-gray-700">
                  {selectedIds.length === orders.length && orders.length > 0
                    ? <CheckSquare size={16} className="text-dark-red" />
                    : <Square size={16} />
                  }
                </button>
              </th>
              <th className="px-4 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Order ID</th>
              <th className="px-4 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Customer</th>
              <th className="px-4 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Date</th>
              <th className="px-4 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Amount</th>
              <th className="px-4 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Status</th>
              <th className="px-4 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">AWB</th>
              <th className="px-4 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-silk-light/50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-silk-light/50">
                  <td className="px-3 py-4"><div className="skeleton h-4 w-4" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-5 w-16" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-5 w-32 mb-1" /><div className="skeleton h-3 w-24" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-4 w-20" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-5 w-16" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-6 w-24 rounded-full" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-5 w-24" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-8 w-24 ml-auto" /></td>
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center text-gray-400">
                  <CheckCircle2 size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No orders match your filters</p>
                </td>
              </tr>
            ) : orders.map((order) => {
              const rowLoading = srLoading[order._id];
              const canPush = !order.awb && !order.shiprocketOrderId && ['pending', 'processing'].includes(order.orderStatus);
              const canSync = !!order.shiprocketOrderId;

              return (
                <tr key={order._id} className={`group hover:bg-silk-light/30 transition-colors ${selectedIds.includes(order._id) ? 'bg-red-50/40' : ''}`}>
                  <td className="px-3 py-4">
                    <button onClick={() => toggleRow(order._id)} className="text-gray-400 hover:text-dark-red">
                      {selectedIds.includes(order._id)
                        ? <CheckSquare size={16} className="text-dark-red" />
                        : <Square size={16} />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-bold text-dark-red text-sm">#{order._id.slice(-8).toUpperCase()}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <button onClick={() => { if(order.user?._id || order.user) navigate(`/admin/users/${order.user?._id || order.user}`); }} className="font-bold text-dark-red text-sm hover:underline text-left transition-colors hover:text-ruby-red">
                        {order.shippingDetails?.name || order.user?.name || '—'}
                      </button>
                      <p className="flex items-center gap-1 text-xs text-grey-beige font-medium mt-1">
                        {order.shippingDetails?.email || order.user?.email}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-grey-beige">
                    {new Date(order.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-4 font-bold text-dark-red">
                    <div className="flex flex-col items-start">
                      <span>{formatCurrency(Number(order.totalAmount || 0), order.currency)}</span>
                      {order.refundAmount > 0 && <span className="text-[10px] text-purple-600 font-medium">Refund: {formatCurrency(order.refundAmount, order.currency)}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col items-start gap-1.5">
                      {getStatusBadge(order.orderStatus)}
                      {order.refundStatus && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${order.refundStatus === 'processed' ? 'bg-purple-50 text-purple-700 border-purple-200' : order.refundStatus === 'failed' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                          Refund: {order.refundStatus}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {order.awb ? (
                      <span className="text-xs font-mono bg-orange-50 text-orange-700 px-2 py-1 rounded-lg border border-orange-100">
                        {order.awb}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 font-medium">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {/* Timeline */}
                      <button
                        onClick={() => openTimeline(order)}
                        title="View Timeline"
                        className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-silk-light text-grey-beige hover:text-dark-red transition-all"
                      >
                        <Eye size={15} />
                      </button>
                      {/* Shipping Label */}
                      <button
                        onClick={() => setLabelOrder(order)}
                        title="Print Label"
                        className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-silk-light text-grey-beige hover:text-dark-red transition-all"
                      >
                        <Tag size={15} />
                      </button>
                      {/* Push to Shiprocket */}
                      {canPush && (
                        <button
                          onClick={() => handlePushShiprocket(order)}
                          disabled={!!rowLoading}
                          title="Push to Shiprocket"
                          className="p-2 hover:bg-orange-50 rounded-lg border border-transparent hover:border-orange-200 text-gray-400 hover:text-orange-600 transition-all disabled:opacity-40"
                        >
                          {rowLoading === 'push'
                            ? <RefreshCw size={15} className="animate-spin" />
                            : <Send size={15} />
                          }
                        </button>
                      )}
                      {/* Sync Shiprocket */}
                      {canSync && (
                        <button
                          onClick={() => handleSyncShiprocket(order)}
                          disabled={!!rowLoading}
                          title="Sync Shiprocket Status"
                          className="p-2 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-200 text-gray-400 hover:text-blue-600 transition-all disabled:opacity-40"
                        >
                          {rowLoading === 'sync'
                            ? <RefreshCw size={15} className="animate-spin" />
                            : <RefreshCw size={15} />
                          }
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-silk-light">
        <p className="text-sm text-grey-beige">
          Showing <span className="font-bold text-dark-red">{orders.length}</span> of <span className="font-bold text-dark-red">{total}</span> orders
        </p>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 flex items-center gap-1 border border-silk-light rounded-xl disabled:opacity-30 hover:bg-silk-light text-dark-red font-bold text-sm transition-colors">
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Previous</span>
          </button>
          <div className="flex items-center px-4 font-bold text-sm text-dark-red">
            Page {pages === 0 ? 0 : page} of {pages}
          </div>
          <button disabled={page >= pages || pages === 0} onClick={() => setPage(p => p + 1)} className="px-4 py-2 flex items-center gap-1 border border-silk-light rounded-xl disabled:opacity-30 hover:bg-silk-light text-dark-red font-bold text-sm transition-colors">
            <span className="hidden sm:inline">Next</span> <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Modals & Drawers */}
      {timelineOrder && <OrderTimelineModal order={timelineOrder} onClose={() => setTimelineOrder(null)} />}
      {labelOrder && <ShippingLabel order={labelOrder} onClose={() => setLabelOrder(null)} />}
    </div>
  );
};

export default OrderManagement;

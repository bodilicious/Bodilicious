import React, { useEffect, useState, useCallback } from 'react';
import { 
  BarChart2,
  Bell, TrendingDown, RefreshCw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';

const Insights: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const API = import.meta.env.VITE_API_URL || '';

  const [summary, setSummary] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [sRes, lRes] = await Promise.all([
        fetch(`${API}/api/v1/admin/insights/summary`, { headers }),
        fetch(`${API}/api/v1/admin/insights/low-stock`, { headers }),
      ]);
      const [sData, lData] = await Promise.all([sRes.json(), lRes.json()]);
      if (sData.success) setSummary(sData.data);
      if (lData.success) setLowStock(lData.data);
    } catch { toast.error('Failed to load insights'); }
    finally { setLoading(false); }
  }, [getAuthHeaders, API]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const summaryCards = summary ? [
    { label: 'Low Stock', value: summary.lowStockCount, icon: TrendingDown, color: 'text-red-500 bg-red-50', alert: summary.lowStockCount > 0 },
    { label: 'Unread Alerts', value: summary.unreadNotificationCount, icon: Bell, color: 'text-purple-500 bg-purple-50', alert: summary.unreadNotificationCount > 0 },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-2xl shadow-sm text-dark-red"><BarChart2 size={24} /></div>
          <div>
            <h3 className="font-bold text-gray-800">Insights</h3>
            <p className="text-sm text-gray-500">Operational health at a glance</p>
          </div>
        </div>
        <button onClick={fetchAll} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {loading ? [...Array(5)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-2xl" />
        )) : summaryCards.map(({ label, value, icon: Icon, color, alert }) => (
          <div key={label} className={`p-5 rounded-2xl border ${alert && value > 0 ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-gray-50'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon size={18} />
            </div>
            <p className={`text-3xl font-black ${alert && value > 0 ? 'text-red-600' : 'text-gray-800'}`}>{value}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Low Stock Table */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <TrendingDown size={18} className="text-red-500" />
          <h4 className="font-bold text-gray-700">Low Stock Products</h4>
          <span className="text-xs text-gray-400 font-medium">(stock ≤ threshold)</span>
        </div>
        {loading ? (
          <div className="h-32 bg-gray-100 animate-pulse rounded-2xl" />
        ) : lowStock.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-sm text-gray-400 font-medium">✅ All products are well-stocked</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>{['Product', 'SKU', 'Stock', 'Threshold'].map(h => (
                  <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lowStock.map(p => (
                  <tr key={p._id} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-5 py-3 font-semibold text-gray-800">{p.name}</td>
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{p.pid}</td>
                    <td className="px-5 py-3">
                      <span className={`font-black text-base ${p.stock === 0 ? 'text-red-500' : 'text-orange-500'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{p.lowStockThreshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Insights;

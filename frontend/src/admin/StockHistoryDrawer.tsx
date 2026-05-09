import { X, TrendingDown, TrendingUp, AlertCircle, Loader2, Edit3 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1`;

async function getAuthHeaders(): Promise<HeadersInit> {
  const { auth } = await import('../firebase');
  const { getIdToken } = await import('firebase/auth');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (auth.currentUser) {
    headers['Authorization'] = `Bearer ${await getIdToken(auth.currentUser)}`;
  }
  return headers;
}

interface StockData {
  productId: string;
  pid: string;
  name: string;
  currentStock: number;
  series: { date: string; stock: number }[];
  edits: { timestamp: string; actorName: string; from: number | null; to: number | null; reason: string }[];
}

interface Props {
  productId: string | null;
  productName?: string;
  onClose: () => void;
}

const REASON_LABELS: Record<string, string> = {
  manual_edit: 'Manual Edit',
  order_placed: 'Order Placed',
  order_cancelled: 'Order Cancelled',
  bulk_import: 'Bulk Import',
  stock_bulk_import: 'Bulk Import',
  stock_manual_edit: 'Manual Edit',
};

export default function StockHistoryDrawer({ productId, productName, onClose }: Props) {
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/products/${productId}/stock-history`, { headers });
      if (!res.ok) throw new Error('Failed to load stock history');
      const json = await res.json();
      setData(json.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (!productId) return null;

  const chartMin = data?.series?.length ? Math.max(0, Math.min(...data.series.map(s => s.stock)) - 5) : 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Stock History</h2>
            <p className="text-xs text-gray-500 mt-0.5">{productName || data?.name || '—'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Loader2 size={32} className="animate-spin mb-3" />
              <p className="text-sm">Loading stock history…</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <AlertCircle size={32} className="mb-3 text-red-400" />
              <p className="text-sm text-red-600">{error}</p>
              <button onClick={fetchHistory} className="mt-3 text-xs text-blue-600 hover:underline">Retry</button>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Current Stock */}
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Stock</p>
                    <p className={`text-3xl font-bold ${data.currentStock <= 5 ? 'text-red-600' : 'text-gray-900'}`}>
                      {data.currentStock}
                    </p>
                  </div>
                  {data.edits.length > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Last Change</p>
                      {(() => {
                        const last = data.edits[data.edits.length - 1];
                        const diff = (last.to ?? 0) - (last.from ?? 0);
                        return (
                          <div className="flex items-center gap-1 justify-end">
                            {diff >= 0
                              ? <TrendingUp size={14} className="text-green-500" />
                              : <TrendingDown size={14} className="text-red-500" />
                            }
                            <span className={`text-sm font-semibold ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {diff >= 0 ? '+' : ''}{diff}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Chart */}
              <div className="px-6 py-5 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">30-Day Stock Trend</p>
                {data.series.length < 2 ? (
                  <div className="flex flex-col items-center py-8 text-gray-400">
                    <AlertCircle size={24} className="mb-2 opacity-40" />
                    <p className="text-xs">No stock movements recorded yet</p>
                    <p className="text-[10px] text-gray-300">Changes will appear here after stock edits</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={data.series}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                      <YAxis domain={[chartMin, 'auto']} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: any) => [`${v} units`]} labelFormatter={d => `Date: ${d}`} />
                      <ReferenceLine y={5} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Low', fontSize: 9, fill: '#ef4444' }} />
                      <Line type="stepAfter" dataKey="stock" stroke="#3D0A05" strokeWidth={2} dot={{ r: 3, fill: '#3D0A05' }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Edit Log */}
              <div className="px-6 py-5">
                <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">Edit History</p>
                {data.edits.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-gray-400">
                    <Edit3 size={24} className="mb-2 opacity-40" />
                    <p className="text-xs">No manual edits in the last 30 days</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...data.edits].reverse().map((edit, idx) => {
                      const diff = (edit.to ?? 0) - (edit.from ?? 0);
                      return (
                        <div key={idx} className="bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">{edit.actorName}</span>
                            <span className={`text-sm font-bold ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {edit.from ?? '?'} → {edit.to ?? '?'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400">
                              {new Date(edit.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                            <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                              {REASON_LABELS[edit.reason] || edit.reason}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

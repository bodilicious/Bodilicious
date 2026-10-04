import React, { useState, useEffect, useCallback } from 'react';
import { Star, CheckCircle, XCircle, RefreshCw, BadgeCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type ReviewStatus = 'pending' | 'approved' | 'rejected';

interface ReviewRow {
  productId: string;
  productName: string;
  pid: string;
  image?: string;
  reviewId: string;
  rating: number;
  comment: string;
  isVerified: boolean;
  status: ReviewStatus;
  rewardCouponCode?: string | null;
  createdAt: string;
  authorName?: string;
  authorEmail?: string;
}

const TABS: { key: ReviewStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Published' },
  { key: 'rejected', label: 'Rejected' },
];

const ReviewModeration: React.FC = () => {
  const { getAuthHeaders, storeSettings } = useApp();
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/v1/admin/reviews?status=${status}&page=${page}&limit=20`, { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Failed to load reviews');
      setRows(json.data || []);
      setTotal(json.total || 0);
      setPages(Math.max(1, json.pages || 1));
    } catch (err: any) {
      toast.error(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, status, page]);

  useEffect(() => { load(); }, [load]);

  const moderate = async (row: ReviewRow, next: 'approved' | 'rejected') => {
    setBusyId(row.reviewId);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/v1/admin/reviews/${row.productId}/${row.reviewId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Update failed');
      toast.success(
        next === 'approved'
          ? (json.data?.rewardCode && !row.rewardCouponCode ? `Published — reward code ${json.data.rewardCode} emailed to the customer` : 'Review published')
          : 'Review rejected'
      );
      // It no longer belongs in this tab
      setRows(prev => prev.filter(r => r.reviewId !== row.reviewId));
      setTotal(t => Math.max(0, t - 1));
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Reviews</h1>
          <p className="text-sm text-gray-500 mt-1">
            {storeSettings.reviewModerationEnabled
              ? 'Moderation is on — new reviews wait here until you approve them.'
              : 'Moderation is off — new reviews are published immediately. Turn it on in Settings.'}
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setStatus(tab.key); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              status === tab.key ? 'border-[#8B0000] text-[#8B0000]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}{status === tab.key && !loading ? ` (${total})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">Loading reviews…</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">No {TABS.find(t => t.key === status)?.label.toLowerCase()} reviews.</div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.reviewId} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
              <div className="w-14 h-14 bg-gray-50 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                {row.image && <img src={row.image} alt="" className="w-full h-full object-contain p-1" loading="lazy" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold text-gray-900 truncate">{row.productName}</span>
                  <span className="flex items-center gap-0.5 text-amber-500">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} size={14} fill={i <= row.rating ? 'currentColor' : 'none'} />
                    ))}
                  </span>
                  {row.isVerified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <BadgeCheck size={12} /> Verified buyer
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {row.authorName || 'Customer'}{row.authorEmail ? ` · ${row.authorEmail}` : ''} · {new Date(row.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap break-words">
                  {row.comment || <span className="italic text-gray-400">No comment</span>}
                </p>
                {row.rewardCouponCode && (
                  <p className="text-xs text-gray-500 mt-2">Reward code issued: <span className="font-mono">{row.rewardCouponCode}</span></p>
                )}
              </div>
              <div className="flex sm:flex-col gap-2 shrink-0">
                {row.status !== 'approved' && (
                  <button
                    onClick={() => moderate(row, 'approved')}
                    disabled={busyId === row.reviewId}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                )}
                {row.status !== 'rejected' && (
                  <button
                    onClick={() => moderate(row, 'rejected')}
                    disabled={busyId === row.reviewId}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircle size={14} /> {row.status === 'approved' ? 'Unpublish' : 'Reject'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-gray-500">Page {page} of {pages}</span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ReviewModeration;

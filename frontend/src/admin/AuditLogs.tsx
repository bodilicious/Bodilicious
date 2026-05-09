import React, { useEffect, useState, useCallback } from 'react';
import { 
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Terminal,
  Clock,
  ShoppingCart,
  UserPlus,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';

const AuditLogs: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || '';

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/logs?page=${page}&limit=12`, { headers });
      const data = await res.json();
      
      if (data.success) {
        setLogs(data.data);
        setTotal(data.total);
        setPages(data.pages);
      }
    } catch (err) {
      toast.error('Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, API_URL, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'order_placed': return 'text-green-600 bg-green-50 border-green-100';
      case 'new_customer': return 'text-cyan-600 bg-cyan-50 border-cyan-100';
      case 'order_cancelled': return 'text-red-600 bg-red-50 border-red-100';
      case 'refund_confirmed': return 'text-purple-600 bg-purple-50 border-purple-100';
      case 'PROMOTE_USER': return 'text-indigo-600 bg-indigo-50 border-indigo-100';
      case 'BLOCK_USER': return 'text-orange-600 bg-orange-50 border-orange-100';
      case 'EXPORT_ORDERS': return 'text-blue-600 bg-blue-50 border-blue-100';
      default:
        if (action.includes('PROMOTE')) return 'text-indigo-600 bg-indigo-50 border-indigo-100';
        if (action.includes('BLOCK')) return 'text-orange-600 bg-orange-50 border-orange-100';
        if (action.includes('EXPORT')) return 'text-blue-600 bg-blue-50 border-blue-100';
        return 'text-gray-600 bg-gray-50 border-gray-100';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'order_placed': return <ShoppingCart size={18} />;
      case 'new_customer': return <UserPlus size={18} />;
      case 'order_cancelled': return <XCircle size={18} />;
      case 'refund_confirmed': return <RefreshCw size={18} />;
      case 'PROMOTE_USER': return <UserPlus size={18} />;
      case 'BLOCK_USER': return <ShieldAlert size={18} />;
      default: return <Terminal size={18} />;
    }
  };

  const resolveActor = (log: any) => {
    if (log.admin) return { label: log.admin.name, source: 'Admin', badge: 'bg-blue-100 text-blue-700' };
    if (log.user) return { label: log.user.name || 'Customer', source: 'Customer', badge: 'bg-indigo-100 text-indigo-700' };
    return { label: 'System', source: 'System', badge: 'bg-gray-100 text-gray-700' };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-2xl shadow-sm text-dark-red">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Security Audit Logs</h3>
            <p className="text-sm text-gray-500">Immutable record of all administrative actions</p>
          </div>
        </div>
        <div className="text-right">
           <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Total Events</p>
           <p className="text-2xl font-black text-gray-800">{total}</p>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-50 animate-pulse rounded-2xl" />
          ))
        ) : logs.map((log) => {
          const actor = resolveActor(log);
          return (
            <div key={log._id} className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-red-100 transition-colors flex items-center justify-between group">
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${getActionColor(log.action)}`}>
                    {getActionIcon(log.action)}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black tracking-widest border ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-800 text-sm">
                        {actor.label}
                      </h4>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${actor.badge}`}>
                        {actor.source}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
                    <span className="flex items-center gap-1"><Terminal size={12} /> {log.targetType || log.entity} ID: {log.targetId || log.entityId}</span>
                    <span className="flex items-center gap-1 font-mono uppercase"><Clock size={12} /> {new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="text-right max-w-xs overflow-hidden">
                <p className="text-xs text-gray-500 italic truncate" title={JSON.stringify(log.details)}>
                  {log.details?.reason || log.details?.role || log.details?.range || log.meta?.reason || 'No additional notes'}
                </p>
                <div className="flex items-center justify-end gap-2 mt-1">
                  {log.meta?.source && (
                    <span className="text-[9px] text-gray-300 font-mono uppercase px-1 border border-gray-100 rounded">
                      via {log.meta.source}
                    </span>
                  )}
                  <p className="text-[10px] text-gray-300 font-mono">{log.ip}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-gray-100">
        <p className="text-sm text-gray-500 font-medium">
          Viewing page <span className="text-gray-800 font-bold">{pages === 0 ? 0 : page}</span> of <span className="text-gray-800 font-bold">{pages}</span>
        </p>
        <div className="flex gap-2">
          <button 
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="p-3 bg-white border border-gray-200 rounded-2xl disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            disabled={page >= pages || pages === 0}
            onClick={() => setPage(p => p + 1)}
            className="p-3 bg-white border border-gray-200 rounded-2xl disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;

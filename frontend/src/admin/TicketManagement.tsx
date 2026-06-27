import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Search,
  Ticket,
  CheckCircle,
  AlertCircle,
  Calendar,
  ShieldAlert,
  X,
  Send,
  User,
  Headphones,
  Paperclip,
  Bot,
  Package,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import Select from '../components/Select';
import { useLocation } from 'react-router-dom';

interface Message {
  _id: string;
  text: string;
  authorRole: 'admin' | 'customer' | 'system';
  isAutomated?: boolean;
  visibleToCustomer?: boolean;
  createdAt: string;
  attachments?: string[];
}

interface SupportTicket {
  _id: string;
  ticketId: string;
  type: string;
  status: string;
  priority: string;
  description: string;
  createdAt: string;
  resolvedAt: string | null;
  messages: Message[];
  orderId?: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    photoURL?: string;
  };
}

const TYPE_COLORS: Record<string, string> = {
  shipping: 'bg-amber-50 text-amber-700 border-amber-200',
  payment: 'bg-rose-50 text-ruby-red border-rose-200',
  other: 'bg-blue-50 text-blue-700 border-blue-200',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

const TicketManagement: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ 
    status: queryParams.get('status') || '', 
    type: '' 
  });
  const [search, setSearch] = useState('');

  // Drawer state
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [drawerMessages, setDrawerMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Array<{ url: string; publicId: string; uploading?: boolean }>>([]);
  const [selectedTicketOrder, setSelectedTicketOrder] = useState<any>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const query = new URLSearchParams();
      if (filters.status) query.set('status', filters.status);
      if (filters.type) query.set('type', filters.type);
      const res = await fetch(`${API_URL}/api/v1/support/tickets?${query}`, { headers });
      const data = await res.json();
      if (data.success) {
        setTickets(data.tickets || []);
      } else {
        toast.error(data.message || 'Failed to fetch tickets');
      }
    } catch {
      toast.error('Error connecting to server');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, API_URL, filters]);

  // Background refresh — no loading spinner flash
  const silentRefetch = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const query = new URLSearchParams();
      if (filters.status) query.set('status', filters.status);
      if (filters.type) query.set('type', filters.type);
      const res = await fetch(`${API_URL}/api/v1/support/tickets?${query}`, { headers });
      const data = await res.json();
      if (data.success) setTickets(data.tickets || []);
    } catch { /* silently ignore background poll errors */ }
  }, [getAuthHeaders, API_URL, filters]);


  useEffect(() => {
    const t = setTimeout(fetchTickets, 300);
    return () => clearTimeout(t);
  }, [fetchTickets]);

  // When tickets list updates (via poll), sync open drawer's messages
  useEffect(() => {
    if (!selectedTicket) return;
    const updated = tickets.find((t) => t._id === selectedTicket._id);
    if (!updated) return;
    if (updated.messages.length !== drawerMessages.length) {
      setDrawerMessages(updated.messages || []);
      setSelectedTicket((prev) => prev?._id === updated._id ? { ...prev, ...updated } : prev);
    }
  }, [tickets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll every 5 m when drawer is open so customer replies appear automatically
  useEffect(() => {
    if (!selectedTicket) return;
    const interval = setInterval(silentRefetch, 300000);
    return () => clearInterval(interval);
  }, [selectedTicket, silentRefetch]);

  // Fetch brief order details when a ticket with an orderId is opened
  useEffect(() => {
    if (selectedTicket?.orderId) {
      const fetchOrder = async () => {
        try {
          const headers = await getAuthHeaders();
          const res = await fetch(`${API_URL}/api/v1/support/tickets/${selectedTicket._id}/order`, { headers });
          const data = await res.json();
          if (data.success) {
            setSelectedTicketOrder(data.order);
          } else {
            setSelectedTicketOrder(null);
          }
        } catch (e) {
          console.error(e);
          setSelectedTicketOrder(null);
        }
      };
      fetchOrder();
    } else {
      setSelectedTicketOrder(null);
    }
  }, [selectedTicket?._id, selectedTicket?.orderId, getAuthHeaders, API_URL]);


  // Scroll to bottom of thread when messages change
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [drawerMessages]);

  const openDrawer = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setDrawerMessages(ticket.messages || []);
    setDraft('');
    setAttachments([]);
  };

  const closeDrawer = () => {
    setSelectedTicket(null);
    setDrawerMessages([]);
    setDraft('');
    setAttachments([]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File is too large. Max size is 5MB.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Invalid file type. Only JPG, PNG, and WEBP are allowed.');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const newAttachment = { url: '', publicId: tempId, uploading: true };
    setAttachments((prev) => [...prev, newAttachment]);

    try {
      const headers = await getAuthHeaders();
      const authHeaders: Record<string, string> = { ...(headers as Record<string, string>) };
      delete authHeaders['Content-Type'];

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/api/v1/support/upload`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Upload failed');

      setAttachments((prev) =>
        prev.map((a) => (a.publicId === tempId ? { url: data.url, publicId: data.publicId } : a))
      );
      toast.success('File uploaded!');
    } catch (err: any) {
      setAttachments((prev) => prev.filter((a) => a.publicId !== tempId));
      toast.error(err?.message || 'Upload failed');
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (publicId: string) => {
    const target = attachments.find((a) => a.publicId === publicId);
    if (!target || target.uploading) return;

    setAttachments((prev) => prev.filter((a) => a.publicId !== publicId));

    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/api/v1/support/upload`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ publicId }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async () => {
    if ((!draft.trim() && attachments.length === 0) || !selectedTicket) return;
    if (attachments.some((a) => a.uploading)) {
      toast.error('Please wait for attachments to finish uploading.');
      return;
    }
    const text = draft.trim();
    const attachmentUrls = attachments.map((a) => a.url);
    setDraft('');
    setAttachments([]);

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      _id: tempId,
      text,
      authorRole: 'admin',
      createdAt: new Date().toISOString(),
      attachments: attachmentUrls,
    };
    setDrawerMessages((prev) => [...prev, optimistic]);

    setSending(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/support/tickets/${selectedTicket._id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, attachments: attachmentUrls }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to send');

      const updatedMessages: Message[] = data.ticket.messages || [];
      setDrawerMessages(updatedMessages);

      setTickets((prev) =>
        prev.map((t) => (t._id === selectedTicket._id ? { ...t, messages: updatedMessages } : t))
      );
      setSelectedTicket((prev) => (prev ? { ...prev, messages: updatedMessages } : prev));
    } catch (err) {
      setDrawerMessages((prev) => prev.filter((m) => m._id !== tempId));
      setDraft(text);
      setAttachments(attachmentUrls.map((url) => ({ url, publicId: `restore-${Date.now()}-${Math.random()}` })));
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (ticketId: string, status: 'resolved' | 'cancelled') => {
    setResolvingId(ticketId);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status, message: draft.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Ticket ${status} — customer notified by email`);
        await fetchTickets();
        closeDrawer();
      } else {
        toast.error(data.message || `Failed to mark as ${status}`);
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setResolvingId(null);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      t.ticketId.toLowerCase().includes(s) ||
      t.userId?.name?.toLowerCase().includes(s) ||
      t.userId?.email?.toLowerCase().includes(s) ||
      t.description.toLowerCase().includes(s)
    );
  }).sort((a, b) => {
    // 1. Open tickets first
    if (a.status === 'open' && b.status !== 'open') return -1;
    if (a.status !== 'open' && b.status === 'open') return 1;
    // 2. Then by priority
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;
    // 3. Then by creation date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const totalOpen = tickets.filter((t) => t.status === 'open').length;
  const totalHigh = tickets.filter((t) => t.priority === 'high' && t.status === 'open').length;

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-4 bg-blue-50 border-blue-200 text-blue-700">
          <div className="flex items-center gap-2 mb-3"><Ticket size={16} /><span className="text-sm font-semibold">Total</span></div>
          <p className="text-2xl font-bold">{tickets.length}</p>
        </div>
        <div className="rounded-2xl border p-4 bg-amber-50 border-amber-200 text-amber-700">
          <div className="flex items-center gap-2 mb-3"><AlertCircle size={16} /><span className="text-sm font-semibold">Open</span></div>
          <p className="text-2xl font-bold">{totalOpen}</p>
        </div>
        <div className="rounded-2xl border p-4 bg-rose-50 border-rose-200 text-ruby-red">
          <div className="flex items-center gap-2 mb-3"><ShieldAlert size={16} /><span className="text-sm font-semibold">High Priority</span></div>
          <p className="text-2xl font-bold">{totalHigh}</p>
        </div>
        <div className="rounded-2xl border p-4 bg-teal-50 border-teal-200 text-teal-700">
          <div className="flex items-center gap-2 mb-3"><CheckCircle size={16} /><span className="text-sm font-semibold">Resolved</span></div>
          <p className="text-2xl font-bold">{tickets.length - totalOpen}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-grey-beige" size={18} />
          <input
            type="text"
            placeholder="Search by ticket ID, name, email…"
            className="w-full pl-11 pr-4 py-3 bg-silk-light/50 border-none rounded-2xl outline-none focus:ring-2 ring-dark-red/20 text-dark-red placeholder:text-grey-beige"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select
            className="w-48"
            value={filters.status}
            onChange={(val) => setFilters((p) => ({ ...p, status: val as string }))}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'open', label: 'Open' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'cancelled', label: 'Cancelled' }
            ]}
          />
          <Select
            className="w-48"
            value={filters.type}
            onChange={(val) => setFilters((p) => ({ ...p, type: val as string }))}
            options={[
              { value: '', label: 'All Types' },
              { value: 'shipping', label: 'Shipping' },
              { value: 'payment', label: 'Payment' },
              { value: 'other', label: 'Other' }
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-silk-light">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-silk-light bg-silk-light/20">
              <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Ticket</th>
              <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Customer</th>
              <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Replies</th>
              <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-silk-light/50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={5} className="px-6 py-8 h-16 bg-gray-50/50" />
                </tr>
              ))
            ) : filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-grey-beige">No tickets found.</td>
              </tr>
            ) : (
              filteredTickets.map((t) => (
                <tr
                  key={t._id}
                  onClick={() => openDrawer(t)}
                  className="group hover:bg-silk-light/30 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-sm font-bold text-dark-red">{t.ticketId}</span>
                      <span className={`self-start text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${TYPE_COLORS[t.type] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {t.type}
                      </span>
                      {t.priority === 'high' && t.status === 'open' && (
                        <span className="self-start inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ruby-red bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <ShieldAlert size={10} /> High Priority
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-silk-light flex items-center justify-center text-dark-red font-bold text-xs flex-shrink-0">
                        {t.userId?.photoURL
                          ? <img src={t.userId.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                          : (t.userId?.name || 'U')[0]}
                      </div>
                      <div>
                        <p className="font-bold text-dark-red text-sm">{t.userId?.name || 'Unknown'}</p>
                        <p className="text-xs text-grey-beige font-mono">{t.userId?.email}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      t.status === 'resolved'
                        ? 'bg-teal-50 text-teal-700 border-teal-200'
                        : t.status === 'cancelled'
                        ? 'bg-gray-100 text-gray-700 border-gray-300'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {t.status}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-grey-beige">
                      {(t.messages?.length ?? 0)} message{(t.messages?.length ?? 0) !== 1 ? 's' : ''}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-sm text-grey-beige">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} />
                      {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Slide-over Drawer ── */}
      {selectedTicket && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={closeDrawer}
          />

          {/* Panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-start justify-between p-6 border-b border-silk-light">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-sm font-bold text-dark-red">{selectedTicket.ticketId}</span>
                  <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${TYPE_COLORS[selectedTicket.type] || ''}`}>
                    {selectedTicket.type}
                  </span>
                  {selectedTicket.priority === 'high' && selectedTicket.status === 'open' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-ruby-red bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      <ShieldAlert size={10} /> High Priority
                    </span>
                  )}
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                    selectedTicket.status === 'resolved'
                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                      : selectedTicket.status === 'cancelled'
                      ? 'bg-gray-100 text-gray-700 border-gray-300'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {selectedTicket.status}
                  </span>
                </div>
                <p className="text-sm text-grey-beige truncate">
                  {selectedTicket.userId?.name} · {selectedTicket.userId?.email}
                </p>
              </div>
              <button
                onClick={closeDrawer}
                className="ml-4 p-2 rounded-lg hover:bg-silk-light transition-colors text-grey-beige hover:text-dark-red"
              >
                <X size={20} />
              </button>
            </div>

            {/* Brief Order Info */}
            {selectedTicket.orderId && (
              <div className="px-6 py-3 bg-silk-light/10 border-b border-silk-light flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-ruby-red/10 rounded-lg text-ruby-red">
                    <Package size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-grey-beige font-medium">Linked Order</p>
                    <p className="text-sm font-bold text-dark-red">#{selectedTicket.orderId.replace(/^#|^ORD-/i, "").trim().toUpperCase().slice(-8)}</p>
                  </div>
                </div>
                {selectedTicketOrder ? (
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-xs text-grey-beige font-medium">Total</p>
                      <p className="text-sm font-bold text-dark-red">₹{selectedTicketOrder.totalAmount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-grey-beige font-medium">Status</p>
                      <p className="text-[10px] uppercase font-bold text-dark-red bg-silk-light/50 px-2 py-0.5 rounded border border-silk-dark/30 mt-0.5">
                        {selectedTicketOrder.orderStatus}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-grey-beige animate-pulse">Loading order...</div>
                )}
              </div>
            )}

            {/* Thread */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-silk-light/20">
              {drawerMessages.map((msg) => {
                const isAdminMsg = msg.authorRole === 'admin';
                const isSystemMsg = msg.authorRole === 'system';
                return (
                  <div
                    key={msg._id}
                    className={`border border-silk rounded-xl p-4 space-y-3 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.01)] ${
                      msg._id.startsWith('temp-') ? 'opacity-60' : ''
                    } ${isSystemMsg && msg.visibleToCustomer === false ? 'bg-slate-50 border-slate-200' : ''}`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-silk/40 pb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                          isAdminMsg ? 'bg-dark-red' : isSystemMsg ? 'bg-slate-600' : 'bg-[#8B5E3C]'
                        }`}>
                          {isAdminMsg ? <Headphones size={11} /> : isSystemMsg ? <Bot size={11} /> : <User size={11} />}
                        </div>
                        <span className="text-xs font-bold text-dark-red">
                          {isAdminMsg ? 'Bodilicious Support' : isSystemMsg ? 'System Note' : selectedTicket.userId?.name || 'Customer'}
                        </span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isAdminMsg ? 'bg-rose-50 text-ruby-red border-rose-100' : isSystemMsg ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-amber-50 text-amber-800 border-amber-100'
                        }`}>
                          {isAdminMsg ? 'Staff' : isSystemMsg ? (msg.visibleToCustomer === false ? 'Internal Only' : 'Automated') : 'Customer'}
                        </span>
                      </div>
                      <span className="text-[10px] text-grey-beige/70 font-medium">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>

                    {/* Text */}
                    <p className="text-sm text-dark-red leading-relaxed whitespace-pre-wrap">
                      {msg.text}
                    </p>

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-silk-light/40">
                        {msg.attachments.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative group w-16 h-16 rounded-lg overflow-hidden border border-silk-dark/20 block hover:border-ruby-red/50 transition-all bg-silk"
                          >
                            <img src={url} alt="proof" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={threadEndRef} />
            </div>

            {/* Input or Resolved notice */}
            {selectedTicket.status === 'open' ? (
              <div className="p-4 border-t border-silk-light space-y-3">
                {/* Attachment Previews */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-1">
                    {attachments.map((att) => (
                      <div key={att.publicId} className="relative w-14 h-14 bg-silk rounded-lg border border-silk-dark/30 flex items-center justify-center overflow-hidden">
                        {att.uploading ? (
                          <span className="w-4 h-4 border-2 border-dark-red/30 border-t-dark-red rounded-full animate-spin" />
                        ) : (
                          <>
                            <img src={att.url} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(att.publicId)}
                              className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                            >
                              <X size={8} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 items-end">
                  {attachments.length < 5 && (
                    <label className="p-2.5 bg-silk-light hover:bg-silk/60 text-grey-beige hover:text-dark-red rounded-xl cursor-pointer transition-colors border border-silk-dark/20 self-center">
                      <Paperclip size={17} />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={sending}
                      />
                    </label>
                  )}
                  <textarea
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a reply… (Enter to send)"
                    className="flex-1 resize-none px-4 py-2.5 bg-silk-light/60 rounded-xl text-sm text-dark-red focus:outline-none focus:ring-2 ring-dark-red/20 placeholder:text-grey-beige/50"
                    disabled={sending}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={(!draft.trim() && attachments.length === 0) || sending}
                    className="p-2.5 bg-dark-red hover:bg-ruby-red text-white rounded-xl transition-all disabled:opacity-40"
                  >
                    <Send size={18} />
                  </button>
                </div>
                <div className="flex gap-2 items-center text-xs text-grey-beige/70 italic px-1">
                  Optional: Type a final message above, then click Resolve or Cancel to include it in the email.
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleStatusChange(selectedTicket._id, 'resolved')}
                    disabled={resolvingId === selectedTicket._id}
                    className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50"
                  >
                    {resolvingId === selectedTicket._id ? (
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <CheckCircle size={17} />
                    )}
                    Resolve
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedTicket._id, 'cancelled')}
                    disabled={resolvingId === selectedTicket._id}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50"
                  >
                    {resolvingId === selectedTicket._id ? (
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <X size={17} />
                    )}
                    Cancel Ticket
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 border-t border-silk-light space-y-3">
                <div className={`flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl ${
                  selectedTicket.status === 'resolved' 
                    ? 'bg-teal-50 text-teal-600' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {selectedTicket.status === 'resolved' ? <CheckCircle size={16} /> : <X size={16} />}
                  Ticket {selectedTicket.status} — thread is closed
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TicketManagement;

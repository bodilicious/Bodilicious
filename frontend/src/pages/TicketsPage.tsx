import { useState, useEffect, useRef, useCallback } from 'react';
import { Ticket, Clock, CheckCircle, AlertCircle, ChevronRight, Send, User, Headphones, ChevronDown, Paperclip, X } from 'lucide-react';
import Footer from '../components/Footer';
import { useApp } from '../context/AppContext';
import { useSEO } from '../hooks/useSEO';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1`;

interface Message {
  _id: string;
  text: string;
  authorRole: 'admin' | 'customer';
  createdAt: string;
  attachments?: string[];
}

interface SupportTicket {
  _id: string;
  ticketId: string;
  type: 'shipping' | 'payment' | 'other';
  status: 'open' | 'resolved';
  priority: string;
  description: string;
  createdAt: string;
  resolvedAt?: string;
  messages: Message[];
}

const TYPE_LABELS: Record<string, string> = { shipping: 'Shipping', payment: 'Payment', other: 'Other' };
const TYPE_COLORS: Record<string, string> = {
  shipping: 'text-amber-700 bg-amber-50',
  payment: 'text-ruby-red bg-rose-50',
  other: 'text-blue-700 bg-blue-50',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function TicketsPage() {
  useSEO({
    title: 'My Support Tickets — Bodilicious',
    description: 'View and track your Bodilicious support queries.',
    canonical: '/account/tickets',
  });

  const { user, authStatus, getAuthHeaders } = useApp();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    try {
      const headers = await getAuthHeaders();
      const uid = (user as any).uid || (user as any).firebaseUID;
      const res = await fetch(`${API_BASE}/support/tickets/${uid}`, { headers });
      const json = await res.json();
      if (json.success) {
        setTickets(json.tickets);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders]);  

  // Initial load
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated' || !user) { navigate('/signin'); return; }
    fetchTickets();
  }, [authStatus, user, fetchTickets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll every 8 s while any ticket is open so admin replies appear automatically
  const hasOpenTickets = tickets.some((t) => t.status === 'open');
  useEffect(() => {
    if (!hasOpenTickets) return;
    const interval = setInterval(fetchTickets, 8000);
    return () => clearInterval(interval);
  }, [hasOpenTickets, fetchTickets]);

  const open = tickets.filter((t) => t.status === 'open');
  const resolved = tickets.filter((t) => t.status === 'resolved');

  const handleMessageSent = (updatedTicket: SupportTicket) => {
    setTickets((prev) => prev.map((t) => (t._id === updatedTicket._id ? updatedTicket : t)));
  };

  return (
    <div className="min-h-screen bg-[#F8F4EF] flex flex-col font-sans selection:bg-rose-200">
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 pt-28 pb-16">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B5E3C] mb-1">My Account</p>
          <div className="flex items-center justify-between">
            <h1 className="font-serif text-dark-red text-3xl">Support Tickets</h1>
            <a
              id="tickets-raise-query"
              href="/contact"
              className="flex items-center gap-1.5 text-xs font-medium text-ruby-red hover:text-dark-red border border-ruby-red/30 hover:border-dark-red/50 px-4 py-2 rounded-xl transition-all"
            >
              Raise a Query <ChevronRight size={14} />
            </a>
          </div>
        </div>

        {loading && (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-36 bg-white rounded-2xl border border-silk" />)}
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <AlertCircle size={40} className="text-ruby-red mx-auto mb-3 opacity-50" />
            <p className="font-serif text-dark-red text-lg">Couldn't load tickets</p>
            <p className="text-grey-beige text-sm mt-1">Please try again later.</p>
          </div>
        )}

        {!loading && !error && tickets.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-grey-beige mx-auto mb-5 border border-silk">
              <Ticket size={28} strokeWidth={1.5} />
            </div>
            <p className="font-serif text-dark-red text-xl mb-2">No tickets yet</p>
            <p className="text-grey-beige text-sm mb-6">If you have a shipping or payment issue, raise a query and we'll help.</p>
            <a href="/contact" className="inline-flex items-center gap-2 bg-dark-red hover:bg-ruby-red text-white px-6 py-3 rounded-xl text-sm font-medium tracking-wide transition-all duration-300 hover:-translate-y-0.5">
              Raise a Query
            </a>
          </div>
        )}

        {!loading && !error && tickets.length > 0 && (
          <div className="space-y-8">
            {open.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                    Open ({open.length})
                  </span>
                  <div className="flex-1 h-px bg-silk-dark/20" />
                </div>
                <div className="space-y-3">
                  {open.map((ticket) => (
                    <TicketCard
                      key={ticket._id}
                      ticket={ticket}
                      getAuthHeaders={getAuthHeaders}
                      onMessageSent={handleMessageSent}
                    />
                  ))}
                </div>
              </section>
            )}

            {resolved.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                    Resolved ({resolved.length})
                  </span>
                  <div className="flex-1 h-px bg-silk-dark/20" />
                </div>
                <div className="space-y-3">
                  {resolved.map((ticket) => (
                    <TicketCard
                      key={ticket._id}
                      ticket={ticket}
                      getAuthHeaders={getAuthHeaders}
                      onMessageSent={handleMessageSent}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

// ─── TicketCard ───────────────────────────────────────────────────────────────

interface TicketCardProps {
  ticket: SupportTicket;
  getAuthHeaders: () => Promise<HeadersInit>;
  onMessageSent: (updated: SupportTicket) => void;
}

function TicketCard({ ticket, getAuthHeaders, onMessageSent }: TicketCardProps) {
  const isOpen = ticket.status === 'open';
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>(ticket.messages || []);
  const [attachments, setAttachments] = useState<Array<{ url: string; publicId: string; uploading?: boolean }>>([]);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Sync messages if parent updates ticket
  useEffect(() => {
    setLocalMessages(ticket.messages || []);
  }, [ticket.messages]);

  // Scroll to bottom when expanded or messages change
  useEffect(() => {
    if (expanded) {
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }
  }, [expanded, localMessages.length]);

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
      const authHeaders = { ...headers };
      delete authHeaders['Content-Type'];

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/support/upload`, {
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
      await fetch(`${API_BASE}/support/upload`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ publicId }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async () => {
    if (!draft.trim() && attachments.length === 0) return;
    if (attachments.some((a) => a.uploading)) {
      toast.error('Please wait for attachments to finish uploading.');
      return;
    }
    const text = draft.trim();
    const attachmentUrls = attachments.map((a) => a.url);
    setDraft('');
    setAttachments([]);

    // Optimistic
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      _id: tempId,
      text,
      authorRole: 'customer',
      createdAt: new Date().toISOString(),
      attachments: attachmentUrls,
    };
    setLocalMessages((prev) => [...prev, optimistic]);

    setSending(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/support/tickets/${ticket._id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, attachments: attachmentUrls }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to send');

      const updatedMessages: Message[] = data.ticket.messages || [];
      setLocalMessages(updatedMessages);
      onMessageSent({ ...ticket, messages: updatedMessages });
    } catch (err) {
      // Rollback
      setLocalMessages((prev) => prev.filter((m) => m._id !== tempId));
      setDraft(text);
      setAttachments(attachmentUrls.map((url) => ({ url, publicId: `restore-${Date.now()}-${Math.random()}` })));
      toast.error(err instanceof Error ? err.message : 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Count unread admin messages (simple heuristic: any admin message)
  const adminReplies = localMessages.filter((m) => m.authorRole === 'admin').length;

  return (
    <div className="bg-white border border-silk rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-sm">
      {/* Collapsed header — always visible */}
      <button
        className="w-full text-left p-5"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <span className="font-mono text-xs font-semibold text-dark-red bg-silk px-2.5 py-1 rounded-lg tracking-wide">
                {ticket.ticketId}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${TYPE_COLORS[ticket.type]}`}>
                {TYPE_LABELS[ticket.type]}
              </span>
              {adminReplies > 0 && (
                <span className="text-[10px] font-semibold bg-dark-red text-white px-2 py-0.5 rounded-full">
                  {adminReplies} reply from support
                </span>
              )}
            </div>
            <p className="text-grey-beige text-sm leading-relaxed line-clamp-1">{ticket.description}</p>
            <div className="flex items-center gap-4 mt-2 text-[11px] text-grey-beige/70">
              <span className="flex items-center gap-1"><Clock size={11} /> Raised {formatDate(ticket.createdAt)}</span>
              {ticket.resolvedAt && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle size={11} /> Resolved {formatDate(ticket.resolvedAt)}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full border ${
              isOpen ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
            }`}>
              {isOpen ? <Clock size={11} /> : <CheckCircle size={11} />}
              {isOpen ? 'Open' : 'Resolved'}
            </div>
            <ChevronDown
              size={16}
              className={`text-grey-beige transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </button>

      {/* Expanded thread */}
      {expanded && (
        <div className="border-t border-silk-light">
          {/* Message thread */}
          <div className="px-5 py-5 space-y-4 max-h-96 overflow-y-auto bg-[#FDFAF7]">
            {localMessages.length === 0 ? (
              <p className="text-center text-grey-beige text-sm py-4">No comments yet.</p>
            ) : (
              localMessages.map((msg) => {
                const isAdminMsg = msg.authorRole === 'admin';
                return (
                  <div
                    key={msg._id}
                    className={`border border-silk rounded-xl p-4 space-y-3 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.01)] ${
                      msg._id.startsWith('temp-') ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-silk/40 pb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                          isAdminMsg ? 'bg-dark-red' : 'bg-[#8B5E3C]'
                        }`}>
                          {isAdminMsg ? <Headphones size={11} /> : <User size={11} />}
                        </div>
                        <span className="text-xs font-bold text-dark-red">
                          {isAdminMsg ? 'Bodilicious Support' : 'You'}
                        </span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isAdminMsg ? 'bg-rose-50 text-ruby-red border-rose-100' : 'bg-amber-50 text-amber-800 border-amber-100'
                        }`}>
                          {isAdminMsg ? 'Staff' : 'Customer'}
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
              })
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Reply input (open tickets only) */}
          {isOpen ? (
            <div className="px-5 py-4 border-t border-silk-light bg-white space-y-3">
              {/* Attachment Previews */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
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
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder="Reply to support… (Enter to send)"
                  className="flex-1 resize-none px-4 py-2.5 bg-silk-light/60 rounded-xl text-sm text-dark-red focus:outline-none focus:ring-2 ring-dark-red/20 placeholder:text-grey-beige/50"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={(!draft.trim() && attachments.length === 0) || sending}
                  className="p-2.5 bg-dark-red hover:bg-ruby-red text-white rounded-xl transition-all disabled:opacity-40"
                >
                  <Send size={17} />
                </button>
              </div>
            </div>
          ) : (
            <div className="px-5 py-3 border-t border-silk-light bg-white text-center text-[11px] text-grey-beige">
              This ticket is resolved — thread is read-only.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

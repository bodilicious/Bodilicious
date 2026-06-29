import { useState, useEffect, useCallback } from 'react';
import { Ticket, Clock, CheckCircle, AlertCircle, ChevronRight, ChevronDown, MessageSquare, Calendar, Bot } from 'lucide-react';
import Footer from '../components/Footer';
import { useApp } from '../context/AppContext';
import { useSEO } from '../hooks/useSEO';
import { useNavigate } from 'react-router-dom';

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1`;

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
  type: 'shipping' | 'payment' | 'other';
  status: 'open' | 'resolved' | 'cancelled';
  priority: string;
  description: string;
  createdAt: string;
  resolvedAt?: string;
  messages: Message[];
}

const TYPE_LABELS: Record<string, string> = { shipping: 'Shipping', payment: 'Payment', other: 'Other' };
const TYPE_COLORS: Record<string, string> = {
  shipping: 'text-amber-700 bg-amber-50 border-amber-200',
  payment: 'text-rose-700 bg-rose-50 border-rose-200',
  other: 'text-blue-700 bg-blue-50 border-blue-200',
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

  // Gate on user UID (a string primitive) rather than the full user object.
  // The user object is a new reference on every fetchUserProfileAndSync call,
  // causing fetchTickets + the useEffect to re-fire after every profile sync.
  const userUid = (user as any)?.uid || (user as any)?.firebaseUID || null;

  const fetchTickets = useCallback(async () => {
    if (!userUid) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/support/tickets/${userUid}`, { headers });
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
  }, [userUid, getAuthHeaders]); // stable string dep instead of object

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated' || !userUid) { navigate('/signin'); return; }
    fetchTickets();
  }, [authStatus, userUid, fetchTickets]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = tickets.filter((t) => t.status === 'open');
  const resolved = tickets.filter((t) => t.status === 'resolved');
  const cancelled = tickets.filter((t) => t.status === 'cancelled');

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
          <p className="text-grey-beige text-sm mt-2">
            Track the status of your support requests. Our team typically responds within a few hours.
          </p>
        </div>

        {loading && (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-white rounded-2xl border border-silk" />)}
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
                    <TicketCard key={ticket._id} ticket={ticket} />
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
                    <TicketCard key={ticket._id} ticket={ticket} />
                  ))}
                </div>
              </section>
            )}

            {cancelled.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-700 bg-gray-100 border border-gray-300 px-3 py-1.5 rounded-full">
                    Cancelled ({cancelled.length})
                  </span>
                  <div className="flex-1 h-px bg-silk-dark/20" />
                </div>
                <div className="space-y-3">
                  {cancelled.map((ticket) => (
                    <TicketCard key={ticket._id} ticket={ticket} />
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

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const isOpen = ticket.status === 'open';
  const [expanded, setExpanded] = useState(false);

  const visibleReplies = ticket.messages.filter(
    (m) => (m.authorRole === 'admin' || m.authorRole === 'system') && m.visibleToCustomer !== false
  );

  return (
    <div className="bg-white border border-silk rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-sm">
      {/* Card header — always visible */}
      <button
        className="w-full text-left p-5"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <span className="font-mono text-xs font-semibold text-dark-red bg-silk px-2.5 py-1 rounded-lg tracking-wide">
                {ticket.ticketId}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${TYPE_COLORS[ticket.type]}`}>
                {TYPE_LABELS[ticket.type]}
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                isOpen ? 'text-amber-700 bg-amber-50 border-amber-200' 
                : ticket.status === 'cancelled' ? 'text-gray-700 bg-gray-100 border-gray-300'
                : 'text-emerald-700 bg-emerald-50 border-emerald-200'
              }`}>
                {isOpen ? <Clock size={10} /> : ticket.status === 'cancelled' ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
                {isOpen ? 'Open' : ticket.status === 'cancelled' ? 'Cancelled' : 'Resolved'}
              </span>
            </div>

            <p className="text-dark-red text-sm leading-relaxed line-clamp-2">{ticket.description}</p>

            <div className="flex items-center gap-4 mt-2.5 text-[11px] text-grey-beige/70">
              <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(ticket.createdAt)}</span>
              {ticket.messages.length > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare size={11} /> {ticket.messages.length} message{ticket.messages.length !== 1 ? 's' : ''}
                </span>
              )}
              {visibleReplies.length > 0 && (
                <span className="flex items-center gap-1 text-dark-red font-medium">
                  <CheckCircle size={11} /> Support replied
                </span>
              )}
            </div>
          </div>

          <ChevronDown
            size={16}
            className={`text-grey-beige transition-transform duration-200 flex-shrink-0 mt-1 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-silk-light bg-[#FDFAF7] px-5 py-5 space-y-4">
          {/* Your original description */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-grey-beige font-semibold mb-2">Your Query</p>
            <div className="bg-white border border-silk rounded-xl p-4">
              <p className="text-sm text-dark-red leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
              <p className="text-[10px] text-grey-beige/60 mt-2">{formatTime(ticket.createdAt)}</p>
            </div>
          </div>

          {/* Admin and System replies (read-only) */}
          {visibleReplies.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-grey-beige font-semibold mb-2">Support Response</p>
              <div className="space-y-3">
                {visibleReplies.map((msg) => (
                  <div key={msg._id} className="bg-white border border-silk rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      {msg.authorRole === 'system' ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Bot size={10} /> System Note
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ruby-red bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                          Bodilicious Support
                        </span>
                      )}
                      <span className="text-[10px] text-grey-beige/60">{formatTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-sm text-dark-red leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-silk-light/40">
                        {msg.attachments.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-16 h-16 rounded-lg overflow-hidden border border-silk-dark/20 block hover:border-ruby-red/50 transition-all bg-silk"
                          >
                            <img src={url} alt="attachment" className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status notice */}
          {isOpen ? (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
              <Clock size={15} className="flex-shrink-0" />
              <span>Our team is reviewing your query and will respond soon. You'll be notified by email.</span>
            </div>
          ) : ticket.status === 'cancelled' ? (
            <div className="flex items-center gap-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={15} className="flex-shrink-0" />
              <span>This ticket has been cancelled.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm">
              <CheckCircle size={15} className="flex-shrink-0" />
              <span>This ticket has been resolved.{ticket.resolvedAt ? ` Closed on ${formatDate(ticket.resolvedAt)}.` : ''}</span>
            </div>
          )}

          {/* Need more help */}
          {!isOpen && (
            <p className="text-center text-xs text-grey-beige pt-1">
              Still have questions?{' '}
              <a href="/contact" className="text-ruby-red hover:underline font-medium">Raise a new query →</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

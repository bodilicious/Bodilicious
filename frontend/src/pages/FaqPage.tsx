import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, MessageCircle, HelpCircle, Package, Truck, CreditCard, Sparkles, Search } from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1`;

interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
}

const CATEGORIES: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: 'all',      label: 'All',             icon: <Sparkles size={15} strokeWidth={1.5} /> },
  { key: 'general',  label: 'General',          icon: <HelpCircle size={15} strokeWidth={1.5} /> },
  { key: 'product',  label: 'Products',         icon: <Package size={15} strokeWidth={1.5} /> },
  { key: 'shipping', label: 'Shipping',         icon: <Truck size={15} strokeWidth={1.5} /> },
  { key: 'payment',  label: 'Payments',         icon: <CreditCard size={15} strokeWidth={1.5} /> },
];

function AccordionItem({
  faq,
  isOpen,
  onToggle,
  index,
  prefersReduced,
}: {
  faq: FAQ;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
  prefersReduced: boolean;
}) {
  return (
    <m.div
      initial={prefersReduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
      className={`rounded-2xl overflow-hidden transition-all duration-300 backdrop-blur-xl border ${
        isOpen
          ? 'border-ruby-red/25 shadow-[0_8px_32px_rgba(125,26,26,0.12)]'
          : 'border-white/40 shadow-[0_2px_12px_rgba(125,26,26,0.06)] hover:border-ruby-red/20 hover:shadow-[0_4px_20px_rgba(125,26,26,0.09)]'
      }`}
      style={{ background: isOpen ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.55)' }}
    >
      <button
        id={`faq-${faq._id}`}
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left group cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className={`font-serif text-base leading-snug pr-2 transition-colors duration-200 ${isOpen ? 'text-dark-red' : 'text-dark-red/80 group-hover:text-dark-red'}`}>
          {faq.question}
        </span>
        <span className={`flex-shrink-0 w-7 h-7 mt-0.5 rounded-full flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-dark-red text-white rotate-180 shadow-md'
            : 'bg-white/70 text-grey-beige group-hover:bg-ruby-red/10 group-hover:text-ruby-red border border-silk/60'
        }`}>
          <ChevronDown size={14} strokeWidth={2} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <m.div
            key="content"
            initial={prefersReduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-5 pt-0 text-dark-red/70 font-sans text-sm leading-relaxed border-t border-dark-red/8">
              {faq.answer}
            </p>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}

export default function FaqPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const prefersReduced = !!useReducedMotion();

  // Build FAQPage JSON-LD for Google rich snippets
  const faqJsonLd = useMemo(() => {
    if (faqs.length === 0) return undefined;
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    };
  }, [faqs]);

  useSEO({
    title: 'FAQs — Bodilicious',
    description: 'Answers to common questions about Bodilicious products, shipping, and payments.',
    keywords: 'bodilicious faq, skincare questions, haircare help, shipping, returns, natural beauty',
    canonical: '/faqs',
    jsonLd: faqJsonLd,
  });

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const res = await fetch(`${API_BASE}/support/faqs`);
        const json = await res.json();
        if (json.success) {
          setFaqs(json.faqs);
          if (json.faqs.length > 0) setOpenId(json.faqs[0]._id);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchFaqs();
  }, []);

  const filteredFaqs = useMemo(() => {
    let list = faqs;
    if (activeCategory !== 'all') {
      list = list.filter(f => f.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        f => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
      );
    }
    return list;
  }, [faqs, activeCategory, searchQuery]);

  return (
    <div className="min-h-screen font-sans selection:bg-rose-200 overflow-hidden" style={{ background: 'linear-gradient(135deg, #fdf6f0 0%, #fef0f7 40%, #f3f0ff 100%)' }}>

      {/* ── Floating ambient orbs ───────────────────────────────── */}
      {!prefersReduced && (
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <m.div
            className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full opacity-25"
            style={{ background: 'radial-gradient(circle, #f43f5e 0%, transparent 70%)' }}
            animate={{ scale: [1, 1.08, 1], x: [0, 20, 0], y: [0, -15, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
          <m.div
            className="absolute top-1/3 -right-40 w-[460px] h-[460px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)' }}
            animate={{ scale: [1, 1.12, 1], x: [0, -18, 0], y: [0, 20, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          />
          <m.div
            className="absolute -bottom-24 left-1/3 w-[380px] h-[380px] rounded-full opacity-18"
            style={{ background: 'radial-gradient(circle, #fb923c 0%, transparent 70%)' }}
            animate={{ scale: [1, 1.06, 1], y: [0, -12, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
          />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8 pt-32 pb-20">

        {/* ── Hero header ──────────────────────────────────────────── */}
        <m.div
          className="text-center mb-12"
          initial={prefersReduced ? false : { opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Glass icon badge */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_rgba(125,26,26,0.15)]"
            style={{ background: 'rgba(255,255,255,0.6)' }}>
            <HelpCircle size={28} strokeWidth={1.5} className="text-ruby-red" />
          </div>

          <p className="text-[11px] font-sans tracking-[0.35em] uppercase text-ruby-red mb-3">Help Center</p>
          <h1 className="text-5xl sm:text-6xl font-serif text-dark-red mb-4 leading-tight">
            Frequently Asked
            <br />
            <span className="italic font-light text-ruby-red">Questions</span>
          </h1>
          <p className="text-dark-red/60 font-sans text-base font-light leading-relaxed max-w-md mx-auto">
            Quick answers about our products, shipping, and everything in between.
          </p>
        </m.div>

        {/* ── Search bar ───────────────────────────────────────────── */}
        <m.div
          className="mb-8"
          initial={prefersReduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-red/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Search questions…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 rounded-xl backdrop-blur-xl border border-white/50 bg-white/50 text-dark-red placeholder:text-dark-red/35 font-sans text-sm outline-none focus:border-ruby-red/40 focus:ring-2 focus:ring-ruby-red/15 transition-all duration-200 shadow-[0_2px_12px_rgba(125,26,26,0.06)]"
            />
          </div>
        </m.div>

        {/* ── Category tabs ────────────────────────────────────────── */}
        <m.div
          className="flex flex-wrap gap-2 mb-10"
          initial={prefersReduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => { setActiveCategory(cat.key); setOpenId(null); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-sans font-medium tracking-wide transition-all duration-200 cursor-pointer border backdrop-blur-xl ${
                activeCategory === cat.key
                  ? 'bg-dark-red text-white border-dark-red shadow-[0_4px_16px_rgba(125,26,26,0.3)]'
                  : 'bg-white/55 text-dark-red/70 border-white/50 hover:bg-white/75 hover:text-dark-red hover:border-ruby-red/25 shadow-[0_2px_8px_rgba(125,26,26,0.06)]'
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </m.div>

        {/* ── Loading skeletons ─────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="h-[68px] rounded-2xl animate-pulse backdrop-blur-xl border border-white/40"
                style={{ background: 'rgba(255,255,255,0.5)' }}
              />
            ))}
          </div>
        )}

        {/* ── Error state ───────────────────────────────────────────── */}
        {error && (
          <div className="text-center py-20 backdrop-blur-xl rounded-3xl border border-white/40 shadow-sm"
            style={{ background: 'rgba(255,255,255,0.5)' }}>
            <HelpCircle size={40} className="text-dark-red/30 mx-auto mb-4" />
            <p className="font-serif text-lg text-dark-red mb-2">Couldn't load FAQs</p>
            <p className="text-dark-red/50 text-sm">Please try again later or contact us directly.</p>
          </div>
        )}

        {/* ── FAQ list ──────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            {filteredFaqs.length === 0 ? (
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 backdrop-blur-xl rounded-3xl border border-white/40"
                style={{ background: 'rgba(255,255,255,0.5)' }}
              >
                <Search size={36} className="text-dark-red/25 mx-auto mb-4" />
                <p className="font-serif text-lg text-dark-red mb-2">No results found</p>
                <p className="text-dark-red/50 text-sm">Try a different search term or category.</p>
              </m.div>
            ) : (
              <div className="space-y-3">
                {filteredFaqs.map((faq, idx) => (
                  <AccordionItem
                    key={faq._id}
                    faq={faq}
                    isOpen={openId === faq._id}
                    onToggle={() => setOpenId(openId === faq._id ? null : faq._id)}
                    index={idx}
                    prefersReduced={prefersReduced}
                  />
                ))}
              </div>
            )}

            {/* ── WhatsApp CTA ─────────────────────────────────────── */}
            <m.div
              className="mt-12 rounded-3xl border border-white/50 text-center overflow-hidden relative backdrop-blur-xl shadow-[0_8px_40px_rgba(125,26,26,0.1)]"
              style={{ background: 'rgba(255,255,255,0.6)' }}
              initial={prefersReduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {/* Subtle background gradient */}
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
                style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.04) 0%, rgba(167,139,250,0.05) 100%)' }} />

              <div className="relative px-8 py-10">
                <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/20 flex items-center justify-center mx-auto mb-5 backdrop-blur-sm">
                  <MessageCircle size={22} className="text-[#25D366]" strokeWidth={1.5} />
                </div>
                <p className="font-serif text-dark-red text-2xl mb-2">Still have questions?</p>
                <p className="text-dark-red/55 text-sm mb-7 font-light leading-relaxed max-w-xs mx-auto">
                  Our team typically replies within a few hours on WhatsApp.
                </p>
                <a
                  id="faq-whatsapp-cta"
                  href="https://wa.me/919894451947?text=Hi%2C%20I%20have%20a%20question%20about%20my%20order."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1fba58] text-white px-7 py-3.5 rounded-xl font-medium text-sm tracking-wide transition-all duration-300 hover:-translate-y-0.5 shadow-[0_4px_16px_rgba(37,211,102,0.35)] hover:shadow-[0_8px_24px_rgba(37,211,102,0.45)] cursor-pointer"
                >
                  <MessageCircle size={16} strokeWidth={2} />
                  Chat on WhatsApp
                </a>
              </div>
            </m.div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

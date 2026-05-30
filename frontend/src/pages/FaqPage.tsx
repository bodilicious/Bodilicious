import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, MessageCircle, HelpCircle } from 'lucide-react';
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

const CATEGORY_LABELS: Record<string, string> = {
  shipping: 'Shipping & Delivery',
  payment: 'Payments',
  product: 'Products',
  general: 'General',
};

const CATEGORY_COLORS: Record<string, string> = {
  shipping: 'text-amber-700 bg-amber-50 border-amber-200',
  payment: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  product: 'text-rose-700 bg-rose-50 border-rose-200',
  general: 'text-blue-700 bg-blue-50 border-blue-200',
};

function AccordionItem({ faq, isOpen, onToggle }: { faq: FAQ; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`border border-silk rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? 'shadow-md' : 'hover:shadow-sm'}`}>
      <button
        id={`faq-${faq._id}`}
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left bg-white hover:bg-silk-light/50 transition-colors duration-200 group"
        aria-expanded={isOpen}
      >
        <span className="font-serif text-dark-red text-base leading-snug pr-2">{faq.question}</span>
        <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-dark-red text-white' : 'bg-silk text-grey-beige group-hover:bg-rose-100 group-hover:text-ruby-red'}`}>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <p className="px-6 pb-5 pt-1 text-grey-beige font-sans text-sm leading-relaxed border-t border-silk">
          {faq.answer}
        </p>
      </div>
    </div>
  );
}

export default function FaqPage() {
  useSEO({
    title: 'FAQs — Bodilicious',
    description: 'Find answers to the most common questions about Bodilicious products, shipping, payments, and more.',
    canonical: '/faqs',
  });

  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const res = await fetch(`${API_BASE}/support/faqs`);
        const json = await res.json();
        if (json.success) {
          setFaqs(json.faqs);
          // Open first item by default
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

  // Group FAQs by category
  const grouped = faqs.reduce<Record<string, FAQ[]>>((acc, faq) => {
    const cat = faq.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(faq);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();

  return (
    <div className="min-h-screen bg-silk-light pt-24 font-sans selection:bg-rose-200">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-16">

        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-14 animate-fade-in">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-ruby-red mx-auto mb-5">
            <HelpCircle size={28} strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-dark-red mb-4">FAQs</h1>
          <p className="text-grey-beige text-base font-light leading-relaxed">
            Quick answers to our most common questions about products, shipping, and payments.
          </p>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-white rounded-2xl border border-silk animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-16 text-grey-beige">
            <p className="font-serif text-lg text-dark-red mb-2">Couldn't load FAQs</p>
            <p className="text-sm">Please try again later or contact us directly.</p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-10">
            {categories.map(cat => (
              <div key={cat}>
                {/* Category label */}
                <div className="flex items-center gap-3 mb-4">
                  <span className={`text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full border ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.general}`}>
                    {CATEGORY_LABELS[cat] ?? cat}
                  </span>
                  <div className="flex-1 h-px bg-silk-dark/20" />
                </div>
                <div className="space-y-3">
                  {grouped[cat].map(faq => (
                    <AccordionItem
                      key={faq._id}
                      faq={faq}
                      isOpen={openId === faq._id}
                      onToggle={() => setOpenId(openId === faq._id ? null : faq._id)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* WhatsApp CTA */}
            <div className="mt-12 p-8 bg-white rounded-3xl border border-silk text-center shadow-sm">
              <p className="font-serif text-dark-red text-xl mb-2">Still have questions?</p>
              <p className="text-grey-beige text-sm mb-6 font-light">Our team typically replies within a few hours on WhatsApp.</p>
              <a
                id="faq-whatsapp-cta"
                href="https://wa.me/919894451947?text=Hi%2C%20I%20have%20a%20question%20about%20my%20order."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1fba58] text-white px-7 py-3.5 rounded-xl font-medium tracking-wide transition-all duration-300 hover:-translate-y-0.5 shadow-md hover:shadow-lg"
              >
                <MessageCircle size={18} />
                Chat on WhatsApp
              </a>
            </div>
          </div>
        )}

      </div>
      <Footer />
    </div>
  );
}

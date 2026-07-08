import { useState } from 'react';
import { Mail, Phone, MapPin, Send, ShieldCheck, RefreshCw, Globe, BadgeCheck, MessageCircle, Ticket, ChevronRight, Paperclip, X } from 'lucide-react';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';
import { useSEO } from '../hooks/useSEO';
import { useApp } from '../context/AppContext';

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1`;

export default function ContactPage() {
    useSEO({
        title: 'Contact Us — Bodilicious',
        description:
            'Get in touch with the Bodilicious team. Write us a review, ask about products or shipping, or give feedback. We are here to help you on your skincare journey.',
        keywords: 'bodilicious, skincare, haircare, natural beauty, herbal products, buy online',
        canonical: '/contact',
        jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'ContactPage',
            name: 'Contact Bodilicious',
            url: 'https://www.bodilicious.in/contact',
            description: 'Reach out to the Bodilicious team for product queries, shipping help, or feedback.',
            publisher: {
                '@type': 'Organization',
                name: 'Bodilicious',
                url: 'https://www.bodilicious.in',
                contactPoint: {
                    '@type': 'ContactPoint',
                    contactType: 'customer service',
                    availableLanguage: ['English', 'Hindi'],
                },
            },
        },
    });

    const { authStatus, getAuthHeaders } = useApp();

    // ── Review form ──────────────────────────────────────────────────
    const [formData, setFormData] = useState({ name: '', email: '', message: '' });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        toast.success('Thank you for your message. We will get back to you soon!');
        setFormData({ name: '', email: '', message: '' });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // ── Raise a Query form ───────────────────────────────────────────
    const [queryForm, setQueryForm] = useState({
        type: 'shipping' as 'shipping' | 'payment' | 'other',
        orderId: '',
        description: '',
    });
    const [queryLoading, setQueryLoading] = useState(false);
    const [attachments, setAttachments] = useState<Array<{ url: string; publicId: string; name: string; uploading?: boolean }>>([]);

    const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setQueryForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
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
        const newAttachment = { url: '', publicId: tempId, name: file.name, uploading: true };
        setAttachments(prev => [...prev, newAttachment]);

        try {
            const headers = await getAuthHeaders();
            const authHeaders: Record<string, string> = { ...(headers as Record<string, string>) };
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

            setAttachments(prev => prev.map(a => a.publicId === tempId ? { url: data.url, publicId: data.publicId, name: file.name } : a));
            toast.success('File uploaded successfully!');
        } catch (err: any) {
            setAttachments(prev => prev.filter(a => a.publicId !== tempId));
            toast.error(err?.message || 'Failed to upload attachment');
        } finally {
            e.target.value = '';
        }
    };

    const handleDeleteAttachment = async (publicId: string) => {
        const target = attachments.find(a => a.publicId === publicId);
        if (!target || target.uploading) return;

        setAttachments(prev => prev.filter(a => a.publicId !== publicId));

        try {
            const headers = await getAuthHeaders();
            await fetch(`${API_BASE}/support/upload`, {
                method: 'DELETE',
                headers,
                body: JSON.stringify({ publicId }),
            });
        } catch (err) {
            console.error('Delete attachment error:', err);
        }
    };

    const handleQuerySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (authStatus === 'loading') return;
        if (authStatus !== 'authenticated') {
            toast.error('Please sign in to raise a support ticket.');
            return;
        }
        if (attachments.some(a => a.uploading)) {
            toast.error('Please wait for files to finish uploading.');
            return;
        }
        setQueryLoading(true);
        try {
            const headers = await getAuthHeaders();
            const body: Record<string, any> = { 
                type: queryForm.type, 
                description: queryForm.description,
                attachments: attachments.map(a => a.url)
            };
            if (queryForm.orderId.trim()) body.orderId = queryForm.orderId.trim();

            const res = await fetch(`${API_BASE}/support/tickets`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Failed to submit ticket');

            const ticketId = json.ticket?.ticketId ?? 'your ticket';
            toast.success(`Ticket raised! Your ID is ${ticketId}. We'll be in touch soon.`, { duration: 6000 });
            setQueryForm({ type: 'shipping', orderId: '', description: '' });
            setAttachments([]);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
            toast.error(message);
        } finally {
            setQueryLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-silk-light pt-24 font-sans selection:bg-rose-200">
            <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16">

                {/* ── Page Header ── */}
                <div className="text-center max-w-2xl mx-auto mb-16 animate-fade-in">
                    <h1 className="text-4xl md:text-5xl font-serif text-dark-red mb-4">Contact Us</h1>
                    <p className="text-lg text-grey-beige font-light">
                        Get in touch and let us know how we can help. Whether you have a question about our products, shipping, or anything else, our team is ready to answer all your questions.
                    </p>
                </div>

                {/* ── Review form + Contact info ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>

                    {/* Review form */}
                    <div className="bg-white p-8 md:p-10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-silk relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-bl-full -z-10 opacity-50"></div>
                        <h2 className="text-2xl font-serif text-dark-red mb-6">Write your review</h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-grey-beige mb-2">Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Enter your name*"
                                    className="w-full px-4 py-3 bg-silk-light/50 border border-silk-dark/50 rounded-lg text-dark-red focus:outline-none focus:ring-2 focus:ring-ruby-red/20 focus:border-ruby-red transition-all duration-300 placeholder:text-grey-beige/50"
                                />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-grey-beige mb-2">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="Enter your e-mail*"
                                    className="w-full px-4 py-3 bg-silk-light/50 border border-silk-dark/50 rounded-lg text-dark-red focus:outline-none focus:ring-2 focus:ring-ruby-red/20 focus:border-ruby-red transition-all duration-300 placeholder:text-grey-beige/50"
                                />
                            </div>
                            <div>
                                <label htmlFor="message" className="block text-sm font-medium text-grey-beige mb-2">Message</label>
                                <textarea
                                    id="message"
                                    name="message"
                                    required
                                    value={formData.message}
                                    onChange={handleChange}
                                    placeholder="Write your review*"
                                    rows={5}
                                    className="w-full px-4 py-3 bg-silk-light/50 border border-silk-dark/50 rounded-lg text-dark-red focus:outline-none focus:ring-2 focus:ring-ruby-red/20 focus:border-ruby-red transition-all duration-300 placeholder:text-grey-beige/50 resize-none"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full flex items-center justify-center gap-2 bg-dark-red hover:bg-ruby-red text-silk py-4 rounded-lg font-medium tracking-wide transition-all duration-300 transform hover:-translate-y-0.5"
                            >
                                <span>Submit Review</span>
                                <Send size={18} />
                            </button>
                        </form>
                    </div>

                    {/* Contact info */}
                    <div className="flex flex-col justify-between">
                        <div className="space-y-10">

                            {/* Address */}
                            <div className="flex items-start gap-5 group">
                                <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center flex-shrink-0 text-ruby-red group-hover:scale-110 group-hover:bg-ruby-red group-hover:text-white transition-all duration-300">
                                    <MapPin size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-serif text-dark-red mb-2">Address</h3>
                                    <p className="text-grey-beige leading-relaxed">
                                        3/1, Varadaraja Perumal Koil St, Sanjeevarayanpet,<br />
                                        Tondiarpet, Chennai,<br />
                                        Tamil Nadu 600081
                                    </p>
                                </div>
                            </div>

                            {/* Email */}
                            <div className="flex items-start gap-5 group">
                                <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center flex-shrink-0 text-ruby-red group-hover:scale-110 group-hover:bg-ruby-red group-hover:text-white transition-all duration-300">
                                    <Mail size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-serif text-dark-red mb-2">Email Us</h3>
                                    <a href="mailto:bodiliciousnaturalproducts@gmail.com" className="text-grey-beige hover:text-ruby-red transition-colors duration-300">
                                        bodiliciousnaturalproducts@gmail.com
                                    </a>
                                </div>
                            </div>

                            {/* Phone */}
                            <div className="flex items-start gap-5 group">
                                <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center flex-shrink-0 text-ruby-red group-hover:scale-110 group-hover:bg-ruby-red group-hover:text-white transition-all duration-300">
                                    <Phone size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-serif text-dark-red mb-2">Call Us</h3>
                                    <a href="tel:8144451947" className="text-grey-beige hover:text-ruby-red transition-colors duration-300">
                                        +91 9894451947
                                    </a>
                                </div>
                            </div>

                            {/* WhatsApp */}
                            <div className="flex items-start gap-5 group">
                                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0 text-green-600 group-hover:scale-110 group-hover:bg-green-600 group-hover:text-white transition-all duration-300">
                                    <MessageCircle size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-serif text-dark-red mb-2">WhatsApp Us</h3>
                                    <a
                                        id="contact-whatsapp-btn"
                                        href="https://wa.me/919894451947?text=Hi%2C%20I%20have%20a%20question%20about%20my%20order."
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1fba58] text-white text-sm font-medium px-4 py-2 rounded-lg transition-all duration-300 hover:-translate-y-0.5 mt-1"
                                    >
                                        <MessageCircle size={14} />
                                        Chat Now
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Highlights */}
                        <div className="grid grid-cols-2 gap-6 mt-12 pt-12 border-t border-silk-dark/20">
                            <div className="flex flex-col items-center text-center gap-3 group">
                                <div className="text-grey-beige group-hover:text-ruby-red transition-colors duration-300">
                                    <Globe size={32} strokeWidth={1.5} />
                                </div>
                                <span className="text-xs font-bold tracking-widest uppercase text-dark-red">
                                    We Shipping<br />Worldwide
                                </span>
                            </div>
                            <div className="flex flex-col items-center text-center gap-3 group">
                                <div className="text-grey-beige group-hover:text-ruby-red transition-colors duration-300">
                                    <ShieldCheck size={32} strokeWidth={1.5} />
                                </div>
                                <span className="text-xs font-bold tracking-widest uppercase text-dark-red">
                                    100% Money Back<br />Guarantee
                                </span>
                            </div>
                            <div className="flex flex-col items-center text-center gap-3 group">
                                <div className="text-grey-beige group-hover:text-ruby-red transition-colors duration-300">
                                    <BadgeCheck size={32} strokeWidth={1.5} />
                                </div>
                                <span className="text-xs font-bold tracking-widest uppercase text-dark-red">
                                    100% Secured<br />Payment
                                </span>
                            </div>
                            <div className="flex flex-col items-center text-center gap-3 group">
                                <div className="text-grey-beige group-hover:text-ruby-red transition-colors duration-300">
                                    <RefreshCw size={32} strokeWidth={1.5} />
                                </div>
                                <span className="text-xs font-bold tracking-widest uppercase text-dark-red">
                                    7-Day Return<br />Policy
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Raise a Query ── */}
                <div className="mt-20 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 text-ruby-red bg-rose-50 border border-rose-100 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest mb-4">
                            <Ticket size={13} />
                            Support Ticket
                        </div>
                        <h2 className="text-3xl md:text-4xl font-serif text-dark-red mb-3">Raise a Query</h2>
                        <p className="text-grey-beige font-light max-w-lg mx-auto">
                            Having an issue with shipping or payment? Raise a ticket and we'll get back to you promptly.
                        </p>
                    </div>

                    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-silk p-8 md:p-10 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-rose-50 rounded-br-full -z-10 opacity-40" />

                        {authStatus !== 'authenticated' && authStatus !== 'loading' && (
                            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                                <p className="text-amber-800 text-sm font-medium">
                                    Please{' '}
                                    <a href="/signin" className="underline hover:text-amber-900">sign in</a>
                                    {' '}to raise a support ticket.
                                </p>
                            </div>
                        )}

                        <form onSubmit={handleQuerySubmit} className="space-y-6">
                            <div>
                                <label htmlFor="query-type" className="block text-sm font-medium text-grey-beige mb-2">Issue Type</label>
                                <select
                                    id="query-type"
                                    name="type"
                                    value={queryForm.type}
                                    onChange={handleQueryChange}
                                    required
                                    className="w-full px-4 py-3 bg-silk-light/50 border border-silk-dark/50 rounded-lg text-dark-red focus:outline-none focus:ring-2 focus:ring-ruby-red/20 focus:border-ruby-red transition-all duration-300 cursor-pointer"
                                >
                                    <option value="shipping">Shipping / Delivery</option>
                                    <option value="payment">Payment</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="query-orderId" className="block text-sm font-medium text-grey-beige mb-2">
                                    Order ID <span className="text-grey-beige/50 font-normal">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    id="query-orderId"
                                    name="orderId"
                                    value={queryForm.orderId}
                                    onChange={handleQueryChange}
                                    placeholder="e.g. #abc123 (Please enter in the correct format)"
                                    className="w-full px-4 py-3 bg-silk-light/50 border border-silk-dark/50 rounded-lg text-dark-red focus:outline-none focus:ring-2 focus:ring-ruby-red/20 focus:border-ruby-red transition-all duration-300 placeholder:text-grey-beige/40"
                                />
                            </div>

                            <div>
                                <label htmlFor="query-description" className="block text-sm font-medium text-grey-beige mb-2">Describe your issue</label>
                                <textarea
                                    id="query-description"
                                    name="description"
                                    value={queryForm.description}
                                    onChange={handleQueryChange}
                                    required
                                    rows={4}
                                    placeholder="Tell us what happened and how we can help..."
                                    className="w-full px-4 py-3 bg-silk-light/50 border border-silk-dark/50 rounded-lg text-dark-red focus:outline-none focus:ring-2 focus:ring-ruby-red/20 focus:border-ruby-red transition-all duration-300 placeholder:text-grey-beige/40 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-grey-beige mb-2">
                                    Attachments <span className="text-grey-beige/50 font-normal">(optional proofs, max 5MB, JPG/PNG/WEBP)</span>
                                </label>
                                <div className="flex flex-wrap gap-3 mb-3">
                                    {attachments.map((att) => (
                                        <div key={att.publicId} className="relative w-20 h-20 bg-silk rounded-xl border border-silk-dark/30 flex items-center justify-center overflow-hidden">
                                            {att.uploading ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="w-5 h-5 border-2 border-dark-red/30 border-t-dark-red rounded-full animate-spin" />
                                                    <span className="text-[9px] text-grey-beige">Uploading</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <img src={att.url} alt="" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteAttachment(att.publicId)}
                                                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                    {attachments.length < 5 && (
                                        <label className="w-20 h-20 border-2 border-dashed border-silk-dark/30 hover:border-ruby-red/50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors bg-silk-light/30 hover:bg-silk-light/50">
                                            <Paperclip size={20} className="text-grey-beige" />
                                            <span className="text-[10px] text-grey-beige mt-1">Add Proof</span>
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                onChange={handleFileChange}
                                                className="hidden"
                                                disabled={authStatus !== 'authenticated'}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <button
                                    id="query-submit-btn"
                                    type="submit"
                                    disabled={queryLoading || authStatus !== 'authenticated'}
                                    className="flex items-center gap-2 bg-dark-red hover:bg-ruby-red disabled:opacity-50 disabled:cursor-not-allowed text-silk px-8 py-3.5 rounded-xl font-medium tracking-wide transition-all duration-300 hover:-translate-y-0.5"
                                >
                                    {queryLoading ? (
                                        <span className="flex items-center gap-2">
                                            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                            Submitting...
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <Ticket size={16} />
                                            Submit Query
                                        </span>
                                    )}
                                </button>
                                <a
                                    href="/account/tickets"
                                    className="flex items-center gap-1.5 text-sm text-grey-beige hover:text-ruby-red transition-colors duration-200"
                                >
                                    View my tickets <ChevronRight size={14} />
                                </a>
                            </div>
                        </form>
                    </div>
                </div>

            </div>
            <Footer />
        </div>
    );
}

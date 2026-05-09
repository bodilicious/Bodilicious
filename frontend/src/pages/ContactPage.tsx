import { useState } from 'react';
import { Mail, Phone, MapPin, Send, ShieldCheck, RefreshCw, Globe, BadgeCheck } from 'lucide-react';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';
import { useSEO } from '../hooks/useSEO';

export default function ContactPage() {
    useSEO({
        title: 'Contact Us — Bodilicious',
        description:
            'Get in touch with the Bodilicious team. Write us a review, ask about products or shipping, or give feedback. We are here to help you on your skincare journey.',
        canonical: '/contact',
    });

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // In a real app, you would send this to your backend
        toast.success('Thank you for your message. We will get back to you soon!');
        setFormData({ name: '', email: '', message: '' });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div className="min-h-screen bg-silk-light pt-24 font-sans selection:bg-rose-200">
            <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16">

                {/* Header Section */}
                <div className="text-center max-w-2xl mx-auto mb-16 animate-fade-in">
                    <h1 className="text-4xl md:text-5xl font-serif text-dark-red mb-4">Contact Us</h1>
                    <p className="text-lg text-grey-beige font-light">
                        Get in touch and let us know how we can help. Whether you have a question about our products, shipping, or anything else, our team is ready to answer all your questions.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>

                    {/* Form Section */}
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

                    {/* Contact Info Section */}
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
            </div>
            <Footer />
        </div>
    );
}

import { useEffect } from 'react';
import Footer from '../components/Footer';
import { FileText, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSEO } from '../hooks/useSEO';

export default function TermsPage() {
    useSEO({
        title: 'Terms & Conditions — Bodilicious',
        description:
            'Review the Terms and Conditions governing your use of the Bodilicious website, products, intellectual property, and dispute resolution process.',
        keywords: 'bodilicious, skincare, haircare, natural beauty, products, buy online',
        canonical: '/terms',
    });

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8 } }
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            {/* Hero Section */}
            <div className="pt-32 pb-20 px-6 max-w-4xl mx-auto text-center">
                <motion.div initial="hidden" animate="visible" variants={containerVariants}>
                    <motion.p variants={itemVariants} className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-4">
                        Legal Information
                    </motion.p>
                    <motion.h1 variants={itemVariants} className="font-serif text-4xl lg:text-5xl text-dark-red mb-6 leading-tight">
                        Terms of Conditions
                    </motion.h1>
                    <motion.p variants={itemVariants} className="font-sans text-gray-600 text-base leading-relaxed max-w-2xl mx-auto">
                        Welcome to Bodilicious. By accessing or using our website, you agree to be bound by the Terms and Conditions set forth below. If you do not agree, please do not use this website.
                    </motion.p>
                </motion.div>
            </div>

            {/* Content Section */}
            <div className="flex-1 max-w-3xl mx-auto w-full px-6 pb-24 space-y-12">
                <div className="pb-6 border-b border-silk mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <FileText className="text-ruby-red" size={24} />
                        <h2 className="font-serif text-3xl text-dark-red">Terms & Conditions</h2>
                    </div>
                    <p className="text-sm text-gray-500 font-sans tracking-wide">Rules and guidelines for using Bodilicious.</p>
                </div>

                <div className="space-y-10">
                    <section className="bg-white p-8 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                        <h3 className="font-serif text-xl text-dark-red mb-3">Use of the Site & Features</h3>
                        <p className="text-sm text-gray-600 leading-relaxed font-light mb-4">
                            The Bodilicious.in website is provided solely for your personal use. You may not use this website for any commercial purpose without our express written consent.
                        </p>
                        <h4 className="font-sans font-medium text-dark-red mt-4 mb-2">Limited License</h4>
                        <p className="text-sm text-gray-600 leading-relaxed font-light">
                            We grant you a limited, revocable, and non-exclusive license to access and make personal use of the website. This does not include any resale or commercial use.
                        </p>
                    </section>

                    <section className="bg-white p-8 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                        <h3 className="font-serif text-xl text-dark-red mb-3">Intellectual Property</h3>
                        <p className="text-sm text-gray-600 leading-relaxed font-light">
                            All content available on the website, including text, graphics, logos, images, and software, is the property of Bodilicious or its content suppliers and is protected by intellectual property laws. Any inquiries, feedback, or submissions you provide will be treated as non-confidential and non-proprietary.
                        </p>
                    </section>

                    <section className="bg-white p-8 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                        <h3 className="font-serif text-xl text-dark-red mb-4 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-grey-beige" /> Liability & Disputes
                        </h3>
                        <div className="space-y-4 text-sm text-gray-600 leading-relaxed font-light">
                            <p><strong>Product Descriptions:</strong> We strive to ensure accuracy, but errors may occur. If we discover an error in price, we will inform you as soon as possible.</p>
                            <p><strong>Indemnification:</strong> You agree to indemnify and hold harmless Bodilicious from any claims arising from your use of this website.</p>
                            <p><strong>Disputes:</strong> Any dispute relating to your visit shall be submitted to confidential arbitration in India, except for small claims court.</p>
                        </div>
                    </section>
                </div>
            </div>

            <Footer />
        </div>
    );
}

import { useEffect } from 'react';
import Footer from '../components/Footer';
import { Truck, RotateCcw, Package, Globe, Clock, CreditCard, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSEO } from '../hooks/useSEO';

export default function ShippingRefundPage() {
    useSEO({
        title: 'Shipping & Returns Policy — Bodilicious',
        description:
            'Free shipping over ₹1500. Bodilicious delivery timelines, international shipping, and 7-day returns.',
        keywords: 'bodilicious, skincare, haircare, natural beauty, products, buy online',
        canonical: '/shipping-refund',
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
                        Order Information
                    </motion.p>
                    <motion.h1 variants={itemVariants} className="font-serif text-4xl lg:text-5xl text-dark-red mb-6 leading-tight">
                        Shipping & Refund Policy
                    </motion.h1>
                    <motion.p variants={itemVariants} className="font-sans text-gray-600 text-base leading-relaxed max-w-2xl mx-auto">
                        We are committed to delivering your luxurious Bodilicious rituals with unparalleled speed, accuracy, and care. Read below for our shipping methods and return policies.
                    </motion.p>
                </motion.div>
            </div>

            {/* Content Section */}
            <div className="flex-1 max-w-5xl mx-auto w-full px-6 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">

                {/* Shipping Policy Column */}
                <div className="lg:col-span-6 space-y-12">
                    <div className="pb-6 border-b border-silk mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <Truck className="text-ruby-red" size={24} />
                            <h2 className="font-serif text-3xl text-dark-red">Shipping Policy</h2>
                        </div>
                        <p className="text-sm text-gray-500 font-sans tracking-wide">Bringing Bodilicious straight to your doorstep.</p>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-6 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                            <h3 className="font-serif text-lg text-dark-red mb-3 flex items-center gap-2">
                                <Package size={16} className="text-grey-beige" /> Methods & Costs
                            </h3>
                            <p className="text-sm text-gray-600 leading-relaxed font-light">
                                We offer various shipping options to meet your needs. Shipping costs are calculated based on the shipping method selected, weight, dimensions of the products, and your delivery address.
                            </p>
                        </div>

                        <div className="bg-white p-6 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                            <h3 className="font-serif text-lg text-dark-red mb-3 flex items-center gap-2">
                                <Truck size={16} className="text-grey-beige" /> Domestic Shipping
                            </h3>
                            <p className="text-sm text-gray-600 leading-relaxed font-light">
                                Orders are shipped on business days only. Shipping times are estimated and may vary due to external factors. We will provide you with a tracking number once your order has shipped so you can track its progress immediately.
                            </p>
                        </div>

                        <div className="bg-white p-6 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                            <h3 className="font-serif text-lg text-dark-red mb-3 flex items-center gap-2">
                                <Globe size={16} className="text-grey-beige" /> International Shipping
                            </h3>
                            <p className="text-sm text-gray-600 leading-relaxed font-light">
                                For international orders, rates and fees may vary depending on the delivery address. Packages may be subject to customs fees or taxes, which are not included in our shipping fee and are the responsibility of the customer.
                            </p>
                        </div>

                        <div className="bg-white p-6 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                            <h3 className="font-serif text-lg text-dark-red mb-3 flex items-center gap-2">
                                <Clock size={16} className="text-grey-beige" /> Delivery Times
                            </h3>
                            <p className="text-sm text-gray-600 leading-relaxed font-light">
                                While we strive to ship your order as quickly as possible, exact delivery times cannot be guaranteed. They are influenced by product availability, geographic location, and the chosen shipping carrier.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Refund Policy Column */}
                <div className="lg:col-span-6 space-y-12">
                    <div className="pb-6 border-b border-silk mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <RotateCcw className="text-ruby-red" size={24} />
                            <h2 className="font-serif text-3xl text-dark-red">Refund Policy</h2>
                        </div>
                        <p className="text-sm text-gray-500 font-sans tracking-wide">Our dedication to your complete satisfaction.</p>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-6 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                            <h3 className="font-serif text-lg text-dark-red mb-3">Returns</h3>
                            <p className="text-sm text-gray-600 leading-relaxed font-light">
                                Our goal is for you to be completely satisfied. We offer a 7-day return policy for products purchased directly from our website, provided they are in original, unused condition and accompanied by the original receipt.
                            </p>
                        </div>

                        <div className="bg-white p-6 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                            <h3 className="font-serif text-lg text-dark-red mb-3">Exchanges & Replacements</h3>
                            <p className="text-sm text-gray-600 leading-relaxed font-light mb-3">
                                <strong>Exchanges:</strong> To exchange an item for a different size or color, please return the original item for a refund and place a new order.
                            </p>
                            <p className="text-sm text-gray-600 leading-relaxed font-light">
                                <strong className="flex items-center gap-1"><ShieldAlert size={14} className="text-dark-red inline" /> Defective Products:</strong> If you receive a defective or damaged product, please contact our customer service immediately to arrange a prompt replacement or refund.
                            </p>
                        </div>

                        <div className="bg-white p-6 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                            <h3 className="font-serif text-lg text-dark-red mb-3 flex items-center gap-2">
                                <CreditCard size={16} className="text-grey-beige" /> Refund Process
                            </h3>
                            <p className="text-sm text-gray-600 leading-relaxed font-light">
                                Refunds are processed to the original method of payment within 7-10 business days of receiving the returned item at our warehouse. Please note that original shipping fees are typically non-refundable.
                            </p>
                        </div>

                        <div className="bg-white p-6 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                            <h3 className="font-serif text-lg text-dark-red mb-3 flex items-center gap-2">
                                <Truck size={16} className="text-grey-beige" /> Return Shipping
                            </h3>
                            <p className="text-sm text-gray-600 leading-relaxed font-light">
                                The customer is responsible for return shipping costs unless the item is defective or incorrect. We highly recommend using a trackable shipping service to ensure your return reaches us safely.
                            </p>
                        </div>
                    </div>
                </div>

            </div>

            <Footer />
        </div>
    );
}

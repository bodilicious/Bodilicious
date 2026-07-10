import { useEffect } from 'react';
import Footer from '../components/Footer';
import { motion } from 'framer-motion';
import { useSEO } from '../hooks/useSEO';

export default function BrandStoryPage() {
    useSEO({
        title: 'Our Brand Story — Bodilicious',
        description:
            'Founded by Dr. Bhanuja Polani, Bodilicious blends biomedical science with traditional wisdom to create safe, targeted skincare and haircare for every concern.',
        keywords: 'bodilicious, skincare, haircare, natural beauty, products, buy online',
        canonical: '/brand-story',
        jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Our Brand Story — Bodilicious',
            url: 'https://bodilicious.in/brand-story',
            description: 'Founded by Dr. Bhanuja Polani, Bodilicious blends biomedical science with traditional wisdom to create safe, targeted skincare and haircare.',
            publisher: {
                '@type': 'Organization',
                name: 'Bodilicious',
                url: 'https://bodilicious.in',
            },
        },
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
                        Our Journey
                    </motion.p>
                    <motion.h1 variants={itemVariants} className="font-serif text-4xl lg:text-5xl text-dark-red mb-6 leading-tight">
                        Brand Story
                    </motion.h1>
                </motion.div>
            </div>

            {/* Content Section */}
            <div className="flex-1 max-w-3xl mx-auto w-full px-6 pb-24 space-y-12">
                <div className="space-y-10">
                    <section className="bg-white p-8 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                        <p className="text-sm text-gray-600 leading-relaxed font-light mb-4">
                            Bodilicious was born from a personal journey of discovery and determination. Like many people, Dr. Bhanuja Polani struggled to find skincare products that truly suited her skin. Despite the abundance of products available in the market, many failed to address individual skin concerns while remaining gentle and safe for long-term use. This experience inspired her to create something different — a skincare brand that understands the real needs of people and delivers effective yet gentle solutions.
                        </p>
                        <p className="text-sm text-gray-600 leading-relaxed font-light mb-4">
                            With a strong academic background in Biomedical Engineering and M.Tech in Biotechnology, Dr. Bhanuja Polani combined scientific knowledge with her passion for skincare to develop formulations that work in harmony with the skin. Her vision was to build a brand that focuses not only on beauty but also on skin health, confidence, and long-term care.
                        </p>
                        <p className="text-sm text-gray-600 leading-relaxed font-light mb-4">
                            Bodilicious was created with the belief that every individual deserves skincare that truly understands their concerns. The brand’s products are thoughtfully designed to address a wide range of skin and hair concerns including age spots, freckles, tanning, acne, dark circles, hair fall, and dandruff. Over time, Bodilicious has expanded its offerings to include beauty products such as serum foundations, lipsticks, and highlighters, allowing customers to enhance their natural beauty while maintaining healthy skin.
                        </p>
                    </section>

                    <section className="bg-white p-8 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                        <h3 className="font-serif text-xl text-dark-red mb-3">Our Philosophy</h3>
                        <p className="text-sm text-gray-600 leading-relaxed font-light mb-4">
                            One of the unique aspects of Bodilicious is its structured skincare philosophy. Rather than offering temporary fixes, the brand focuses on gradual and sustainable skin improvement. The skincare routines are designed around 3-month, 6-month, and 9-month programs, allowing the skin enough time to heal, adapt, and show visible transformation. Throughout this journey, Bodilicious provides personalized follow-ups and guidance, ensuring that every customer receives the support they need to achieve their desired results.
                        </p>
                        <p className="text-sm text-gray-600 leading-relaxed font-light mb-4">
                            At the heart of Bodilicious is a deep commitment to quality and care. Every product is carefully formulated using naturally derived ingredients, free from harsh chemicals, and dermatologically tested to ensure safety for all skin types. From sourcing premium raw materials to maintaining rigorous testing and production standards, every step reflects the brand’s dedication to excellence.
                        </p>
                        <p className="text-sm text-gray-600 leading-relaxed font-light">
                            Bodilicious is built on the idea that skincare should be more than just a routine — it should be a holistic experience that nurtures the skin, builds confidence, and celebrates natural beauty. In a world that often promotes unrealistic beauty standards, Bodilicious encourages people to embrace their authentic selves and take pride in their natural radiance.
                        </p>
                    </section>

                    <section className="bg-white p-8 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors text-center">
                        <h3 className="font-serif text-xl text-dark-red mb-6">Our Leadership</h3>
                        <p className="text-sm text-gray-600 leading-relaxed font-light mb-8">
                            Today, the brand continues to grow under the leadership of its founder:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-8 text-sm text-gray-600 mb-8 justify-items-center">
                            <div className="text-center">
                                <h4 className="font-bold text-dark-red mb-1">Dr. Bhanuja Polani</h4>
                                <p className="font-medium text-ruby-red mb-2">Founder</p>
                                <p className="font-light">Biomedical Engineer, M.Tech Biotechnology</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed font-light mb-4">
                            She brings a powerful combination of science, medical expertise, and passion for wellness, ensuring that every Bodilicious product reflects her vision of safe, effective, and luxurious skincare.
                        </p>
                        <p className="text-sm text-ruby-red leading-relaxed font-medium mt-6 italic">
                            Bodilicious stands as a promise — a promise to care for your skin, support your journey to healthier beauty, and inspire confidence from within.
                        </p>
                    </section>
                </div>
            </div>

            <Footer />
        </div>
    );
}

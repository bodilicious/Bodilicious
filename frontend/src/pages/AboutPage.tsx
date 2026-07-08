import { useEffect } from 'react';
import Footer from '../components/Footer';
import { motion } from 'framer-motion';
import { useSEO } from '../hooks/useSEO';

export default function AboutPage() {
    useSEO({
        title: 'About Bodilicious — Our Story & Mission',
        description:
            'Bodilicious is a certified, registered Indian beauty brand offering science-backed skincare and haircare. Learn about our mission, founders, and philosophy.',
        keywords: 'bodilicious, skincare, haircare, natural beauty, products, buy online',
        canonical: '/about',
        jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            name: 'About Bodilicious',
            url: 'https://www.bodilicious.in/about',
            description: 'Bodilicious is a certified, registered Indian beauty brand offering science-backed skincare and haircare.',
            publisher: {
                '@type': 'Organization',
                name: 'Bodilicious',
                url: 'https://www.bodilicious.in',
                logo: { '@type': 'ImageObject', url: 'https://www.bodilicious.in/logo.webp' },
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
                        Discover Our Story
                    </motion.p>
                    <motion.h1 variants={itemVariants} className="font-serif text-4xl lg:text-5xl text-dark-red mb-6 leading-tight">
                        About Bodilicious
                    </motion.h1>
                    <motion.p variants={itemVariants} className="font-sans text-gray-600 text-base leading-relaxed max-w-2xl mx-auto">
                        Bodilicious is a certified licenced brand, officially recognized in India as a registered beauty and skincare company. Our focus is on targeted skincare aimed at combating hair loss, premature greying, skin dullness, aging, pigmentation, and more.
                    </motion.p>
                </motion.div>
            </div>

            {/* Content Section */}
            <div className="flex-1 max-w-3xl mx-auto w-full px-6 pb-24 space-y-12">
                <div className="space-y-10">
                    <section className="bg-white p-8 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                        <h3 className="font-serif text-xl text-dark-red mb-3">About Us</h3>
                        <p className="text-sm text-gray-600 leading-relaxed font-light mb-4">
                            Our product line encompasses everything from skin to hair care, offering solutions for various skin problems. Our products are hand-made, free from chemicals, and dermatologically tested. The ingredients we use are formulated to address specific issues rather than simply hiding them. We believe in treating skin problems at the source, providing the right solution. Our focus is on targeted skincare, with our products aimed at combating hair loss, premature greying, skin dullness, and aging, pigmentation, wrinkles, under eye dark circles, left over acne marks, acne etc.
                        </p>
                    </section>

                    <section className="bg-white p-8 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                        <h3 className="font-serif text-xl text-dark-red mb-3">Committed to Quality</h3>
                        <p className="text-sm text-gray-600 leading-relaxed font-light">
                            Bodilicious natural products are target-oriented skincare products. Our line of products help to solve the skin or hair concern. We suggest the right products to our customers in the ocean of skin care products. We assure that you are using right products for your skin or hair concern. Using the right product is the key rather than using random products which do not solve the issue. We help our customers get the exact right products and the solution for the same. Many skin products are filled with chemicals that don't help you. Quality should never be a compromise. No matter what skin care product you're looking for, we guarantee reliability. Our goal is to provide products you can trust.
                        </p>
                    </section>

                    <section className="bg-white p-8 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                        <h3 className="font-serif text-xl text-dark-red mb-3">Look Good, Feel Good</h3>
                        <p className="text-sm text-gray-600 leading-relaxed font-light mb-4">
                            Let your inner you shine from head to toe. We are here to help get rid of fine lines, dull skin and dark circles, pigmentation, hair fall, dandruff etc. That's why we decided to share our skin care products with the world. We stock up on a wide variety of products so you can find what works best for you and the skin you're in.
                        </p>
                    </section>

                    <section className="bg-white p-8 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors">
                        <h3 className="font-serif text-xl text-dark-red mb-3">We're Here to Help!</h3>
                        <p className="text-sm text-gray-600 leading-relaxed font-light">
                            We care about our customers, and we want you to be completely happy with your experience. We curate a proper skin and hair care routine to make sure you get results with Bodilicious. If you have questions about us, our products, or our services, get in touch! Have comments about what we can do better? Send us a message! We are excited to help you on your way to healthy skin!
                        </p>
                    </section>

                    <section className="bg-white p-8 border border-silk shadow-sm rounded-sm hover:border-ruby-red/30 transition-colors text-center">
    <h3 className="font-serif text-xl text-dark-red mb-6">Our Leadership</h3>

    <div className="grid grid-cols-1 md:grid-cols-1 gap-8 text-sm text-gray-600 justify-items-center">
        <div className="text-center">
            <h4 className="font-bold text-dark-red mb-1">BHANUJA POLANI</h4>
            <p className="font-medium text-ruby-red mb-2">Founder</p>
            <p className="font-light">Bio medical engineer, M.Tech Biotechnology</p>
        </div>
    </div>
</section>
                </div>
            </div>

            <Footer />
        </div>
    );
}

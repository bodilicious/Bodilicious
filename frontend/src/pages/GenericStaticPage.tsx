import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Footer from '../components/Footer';

const PAGE_CONTENT: Record<string, { title: string; content: string[] }> = {
    '/contact': {
        title: 'Contact Us',
        content: [
            'We would love to hear from you! Please reach out to us for any inquiries, concerns, or feedback.',
            'Email: support@bodilicious.in',
            'Phone: +91 98765 43210',
            'Hours: Monday to Friday, 9:00 AM - 6:00 PM IST',
        ],
    },
    '/shipping': {
        title: 'Shipping & Returns',
        content: [
            'We offer standard and expedited shipping options across India.',
            'Orders are typically processed within 1-2 business days.',
            'If you are not entirely satisfied with your purchase, we offer a 7-day return policy for unopened and unused items.',
        ],
    },
    '/faqs': {
        title: 'Frequently Asked Questions',
        content: [
            'Q: Are your products vegan and cruelty-free?',
            'A: Yes, Bodilicious is proudly 100% vegan and strictly cruelty-free.',
            'Q: Do you ship internationally?',
            'A: Currently, we only ship within India, but we are working on expanding globally.',
        ],
    },
    '/stores': {
        title: 'Store Locator',
        content: [
            'Find bodilicious products in a retail store near you.',
            'New Delhi Flagship Store: 123 Beauty Avenue, Connaught Place, New Delhi',
            'Mumbai Retail Outlet: 456 Glow Street, Bandra West, Mumbai',
        ],
    },
    '/terms-sale': {
        title: 'Terms & Conditions of Sale',
        content: [
            'By placing an order on our website, you agree to our conditions of sale.',
            'Prices are subject to change without notice.',
            'We reserve the right to limit quantities of products purchased.',
        ],
    },
    '/terms-use': {
        title: 'Terms & Conditions of Use',
        content: [
            'Welcome to Bodilicious. By accessing our website, you agree to these terms and conditions.',
            'All content on this site is the property of Bodilicious and protected by copyright laws.',
        ],
    },
    '/accessibility': {
        title: 'Accessibility Declaration',
        content: [
            'Bodilicious is committed to ensuring digital accessibility for people with disabilities.',
            'We are continually improving the user experience for everyone and applying the relevant accessibility standards.',
        ],
    },
    '/privacy': {
        title: 'Privacy Policy',
        content: [
            'Your privacy is important to us. We will not share your personal information with third parties without your consent.',
            'We collect data strictly to process orders and improve your shopping experience.',
        ],
    },
    '/careers': {
        title: 'Careers',
        content: [
            'Join our team! We are always looking for passionate people to join Bodilicious.',
            'Send your resume to careers@bodilicious.in',
        ],
    },
    '/students': {
        title: 'Student Savings',
        content: [
            'Students get an exclusive 15% discount on all Bodilicious products!',
            'Verify your student status with StudentBeans at checkout to apply the discount.',
        ],
    },
};

export default function GenericStaticPage() {
    const location = useLocation();
    const [data, setData] = useState({ title: '', content: [] as string[] });

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const contentData = PAGE_CONTENT[location.pathname] || {
            title: 'Page Not Found',
            content: ['We could not find the information you were looking for.'],
        };
        setData(contentData);
    }, [location.pathname]);

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col pt-20">
            <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-16 animate-fade-in">
                <h1 className="font-serif text-dark-red text-4xl mb-8">{data.title}</h1>
                <div className="space-y-6">
                    {data.content.map((paragraph, idx) => (
                        <p key={idx} className="font-sans text-gray-700 leading-relaxed text-lg">
                            {paragraph}
                        </p>
                    ))}
                </div>
            </div>
            <Footer />
        </div>
    );
}

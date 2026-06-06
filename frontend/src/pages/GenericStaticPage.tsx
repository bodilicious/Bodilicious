import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Footer from '../components/Footer';

// Only include routes that App.tsx actually delegates to GenericStaticPage.
// Routes with dedicated page components (ContactPage, PrivacyPage, TermsPage,
// ShippingPage) are intentionally excluded to avoid silently showing wrong content.
const PAGE_CONTENT: Record<string, { title: string; content: string[] }> = {
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
            'Find Bodilicious products in a retail store near you.',
            'New Delhi Flagship Store: 123 Beauty Avenue, Connaught Place, New Delhi',
            'Mumbai Retail Outlet: 456 Glow Street, Bandra West, Mumbai',
        ],
    },
    '/accessibility': {
        title: 'Accessibility Declaration',
        content: [
            'Bodilicious is committed to ensuring digital accessibility for people with disabilities.',
            'We are continually improving the user experience for everyone and applying the relevant accessibility standards.',
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

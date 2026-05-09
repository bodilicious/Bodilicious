/* eslint-disable @typescript-eslint/no-explicit-any */
import { motion } from 'framer-motion';
import { Gift, ChevronRight, Sparkles, Truck, Tag } from 'lucide-react';
import { User } from '../../types';

interface Props {
    user: User | null;
    navigateTo: (page: any) => void;
}

export default function OffersSection({ user, navigateTo }: Props) {
    const welcomeOffer = (user as any)?.welcomeOffer;
    const isEligibleForWelcome = welcomeOffer?.eligible === true;

    // Static bundle offers for now (would ideally come from backend)
    const offers = [
        ...(isEligibleForWelcome ? [{
            id: 'welcome',
            title: 'Welcome Gift: 10% OFF',
            benefit: '10% discount on your first order',
            tag: 'First Order Only',
            icon: Sparkles,
            color: 'text-ruby-red bg-ruby-red/10 border-ruby-red/20'
        }] : []),
        {
            id: 'shipping',
            title: 'Complimentary Shipping',
            benefit: 'Free delivery on all orders above ₹499',
            tag: 'Always Active',
            icon: Truck,
            color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
        },
        {
            id: 'bundle',
            title: 'Routine Savings: 10% OFF',
            benefit: 'Save when you buy a full ritual bundle',
            tag: 'Member Exclusive',
            icon: Tag,
            color: 'text-amber-700 bg-amber-50 border-amber-200'
        }
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-silk rounded-2xl overflow-hidden mb-6 shadow-sm flex flex-col"
        >
            <div className="px-6 py-5 border-b border-silk/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-silk-light rounded-full flex items-center justify-center text-dark shadow-sm">
                        <Gift size={18} />
                    </div>
                    <h3 className="font-serif text-dark text-base">My Offers</h3>
                </div>
                <button
                    onClick={() => navigateTo('offers')}
                    className="flex items-center gap-1 text-ruby-red hover:text-dark-red font-sans text-xs uppercase tracking-wider transition-colors"
                >
                    View All <ChevronRight size={14} />
                </button>
            </div>

            <div className="p-4 space-y-3">
                {offers.length === 0 ? (
                    <div className="py-8 text-center bg-silk-light/30 rounded-xl">
                        <p className="font-sans text-sm text-grey-beige">No active offers right now — check back soon</p>
                    </div>
                ) : (
                    offers.slice(0, 3).map((offer) => {
                        const Icon = offer.icon;
                        return (
                            <button
                                key={offer.id}
                                onClick={() => navigateTo('offers')}
                                className="w-full bg-silk-light/30 border border-silk/40 hover:border-silk p-3 rounded-xl flex items-center gap-4 transition-all hover:bg-white text-left group"
                            >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${offer.color}`}>
                                    <Icon size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h4 className="font-serif text-dark text-sm truncate">{offer.title}</h4>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight whitespace-nowrap ${offer.color}`}>
                                            {offer.tag}
                                        </span>
                                    </div>
                                    <p className="font-sans text-xs text-grey-beige truncate">{offer.benefit}</p>
                                </div>
                                <ChevronRight size={16} className="text-silk opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        );
                    })
                )}
            </div>
        </motion.div>
    );
}

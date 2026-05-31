 
import { motion } from 'framer-motion';
import { 
    Package, 
    Heart, 
    HelpCircle, 
    ChevronRight, 
    Ticket,
    ShieldCheck
} from 'lucide-react';
import { User } from '../../types';

interface Props {
    user?: User | null;
    navigateTo: (page: any) => void;
}

export default function AccountShortcutCards({ user, navigateTo }: Props) {
    const shortcuts = [
        { id: 'orders',    label: 'Order History',    icon: Package,    page: 'tracking',          color: 'text-amber-600 bg-amber-50' },
        { id: 'wishlist',  label: 'Saved Items',      icon: Heart,      page: 'wishlist',           color: 'text-rose-600 bg-rose-50' },
        { id: 'tickets',   label: 'My Tickets',       icon: Ticket,     page: 'account/tickets',    color: 'text-violet-600 bg-violet-50' },
        { id: 'help',      label: 'Help & Support',   icon: HelpCircle, page: 'contact',            color: 'text-blue-600 bg-blue-50' },
    ];

    if (user?.role === 'admin' || user?.role === 'primary_admin') {
        shortcuts.push({
            id: 'admin',
            label: 'Admin Panel',
            icon: ShieldCheck,
            page: 'admin',
            color: 'text-ruby-red bg-ruby-red/10'
        });
    }


    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {shortcuts.map((shortcut, idx) => {
                const Icon = shortcut.icon;
                return (
                    <motion.button
                        key={shortcut.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => navigateTo(shortcut.page as any)}
                        className="bg-white border border-silk rounded-2xl p-4 text-center hover:shadow-md transition-all group flex flex-col items-center gap-3"
                    >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${shortcut.color}`}>
                            <Icon size={24} />
                        </div>
                        <div>
                            <p className="font-serif text-dark text-xs sm:text-sm">{shortcut.label}</p>
                            <div className="flex items-center justify-center gap-1 text-[10px] text-grey-beige uppercase tracking-widest mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                View <ChevronRight size={10} />
                            </div>
                        </div>
                    </motion.button>
                );
            })}
        </div>
    );
}

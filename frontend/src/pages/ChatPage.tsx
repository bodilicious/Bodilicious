 
import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, Send, Sparkles, Droplets, ShieldCheck, User, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ProductCard from "../components/ProductCard";
import { useApp } from "../context/AppContext";
import { useSEO } from "../hooks/useSEO";

type Message = {
    id: string;
    sender: "user" | "bot";
    text: string;
    products?: any[];
};

const SUGGESTIONS = [
    "Build my routine",
    "I have acne",
    "Dry skin",
    "Dark spots"
];

const renderMarkdown = (text: string) => {
    const parts = text.split('\n');
    return parts.map((part, index) => {
        let content = part;
        const isBullet = content.trim().startsWith('•') || content.trim().startsWith('-');
        if (isBullet) {
            content = content.replace(/^[•-]\s*/, '');
        }

        const elements = [];
        let lastIndex = 0;
        const boldRegex = /\*\*(.*?)\*\*/g;
        let match;

        while ((match = boldRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                elements.push(<span key={`${index}-${lastIndex}`}>{content.substring(lastIndex, match.index)}</span>);
            }
            elements.push(<strong key={`${index}-bold-${match.index}`} className="font-semibold text-dark-red">{match[1]}</strong>);
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < content.length) {
            elements.push(<span key={`${index}-${lastIndex}`}>{content.substring(lastIndex)}</span>);
        }

        return (
            <div key={index} className={`mb-1.5 ${isBullet ? 'flex items-start ml-2' : ''}`}>
                {isBullet && <span className="mr-2 text-ruby-red text-sm mt-1">•</span>}
                <span className={isBullet ? 'flex-1' : ''}>{elements.length > 0 ? elements : content}</span>
            </div>
        );
    });
};

export default function ChatPage() {
    const { products: allProducts, user, isAuthenticated } = useApp();
    const location = useLocation();

    // Session-specific conversational UI with no stable indexable content —
    // noindex keeps it out of search while still setting its own title instead
    // of inheriting the previous route's tags.
    useSEO({
        title: "Skincare Assistant — Bodilicious",
        description: "Chat with the Bodilicious skincare assistant for personalised product guidance.",
        noIndex: true,
    });

    // Initial welcome message logic
    const getInitialMessage = () => {
        if (isAuthenticated && user?.displayName) {
            const firstName = user.displayName.split(' ')[0];
            let msg = `Welcome back, ${firstName}! It's lovely to see you again. `;

            if (user.skinType) {
                msg += `I remember you have ${user.skinType.toLowerCase()} skin. How is your routine working for you today?`;
            } else {
                msg += `I'm your personal Beauty Advisor. Tell me about your skin, and we'll craft a ritual perfectly suited to you.`;
            }
            return msg;
        }
        return "Welcome to Bodilicious. I'm your personal Beauty Advisor. Tell me about your skin, and we'll craft a ritual perfectly suited to you.";
    };

    // --- State & Initialization ---
    const [messages, setMessages] = useState<Message[]>(() => {
        const saved = sessionStorage.getItem("bodilicious_chat_v1");
        if (saved) return JSON.parse(saved);
        return [
            {
                id: "1",
                sender: "bot",
                text: getInitialMessage(),
            },
        ];
    });

    const [inputMessage, setInputMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // --- Persistence ---
    useEffect(() => {
        sessionStorage.setItem("bodilicious_chat_v1", JSON.stringify(messages));
    }, [messages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (location.hash === '#faq') {
            const el = document.getElementById('faq');
            if (el) {
                setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 300);
            }
        }
    }, [location]);

    const clearChat = () => {
        const resetMsg = [
            {
                id: Date.now().toString(),
                sender: "bot" as const,
                text: getInitialMessage(),
            },
        ];
        setMessages(resetMsg);
        sessionStorage.removeItem("bodilicious_chat_v1");
    };

    const handleSendMessage = async (textOveride?: string) => {
        const textToSend = textOveride || inputMessage;
        if (!textToSend.trim()) return;

        const newMsg: Message = {
            id: Date.now().toString(),
            sender: "user",
            text: textToSend,
        };

        setMessages((prev) => [...prev, newMsg]);
        setInputMessage("");
        setIsLoading(true);

        const history = messages
            .filter((m) => m.sender === "user")
            .map((m) => m.text);

        // Structured History for AI
        const structuredHistory = messages.map(m => ({
            role: m.sender === "bot" ? "bot" : "user",
            text: m.text
        }));

        // Add profile context if available
        const profileContext = user ? {
            skinType: user.skinType,
            skinConcerns: user.skinConcerns,
            preferredRoutine: user.preferredRoutine
        } : null;

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: newMsg.text,
                    history,
                    structuredHistory,
                    profileContext
                }),
            });

            const data = await response.json();

            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    sender: "bot",
                    text: data.reply || "I'm having trouble connecting right now. Please try again later.",
                    products: data.products,
                },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    sender: "bot",
                    text: "Oops! Something went wrong while connecting to the server.",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col pt-24 pb-16">
            <div className="max-w-6xl mx-auto w-full px-6 flex-1 flex flex-col lg:flex-row gap-12 lg:gap-16">

                {/* Left Column: Hero & Value Props */}
                <div className="w-full lg:w-5/12 flex flex-col justify-center">
                    <p className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-4">
                        AI Beauty Advisor
                    </p>

                    <h1 className="font-serif text-4xl lg:text-5xl text-dark-red leading-tight mb-6">
                        Discover Your <br />
                        <span className="italic text-ruby-red">Perfect Glow.</span>
                    </h1>

                    <p className="font-sans text-gray-600 text-base leading-relaxed mb-10">
                        Experience a personalized consultation. Our luxury beauty advisor analyzes your unique skin profile to curate the ultimate Bodilicious ritual.
                    </p>

                    <div className="space-y-8">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-silk-light flex items-center justify-center shrink-0">
                                <Droplets size={20} className="text-dark-red" />
                            </div>
                            <div>
                                <h3 className="font-sans font-medium text-dark-red text-base mb-1 tracking-wide">Tailored Routines</h3>
                                <p className="font-sans text-sm text-gray-500 leading-relaxed">Step-by-step skincare regimens designed exclusively for your skin type.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-silk-light flex items-center justify-center shrink-0">
                                <ShieldCheck size={20} className="text-dark-red" />
                            </div>
                            <div>
                                <h3 className="font-sans font-medium text-dark-red text-base mb-1 tracking-wide">Expert Recommendations</h3>
                                <p className="font-sans text-sm text-gray-500 leading-relaxed">Curated selections from our premium collections.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Interactive Chat Interface */}
                <div className="w-full lg:w-7/12 flex flex-col h-[650px] bg-white border border-silk/60 shadow-xl shadow-silk-dark/10 rounded-2xl overflow-hidden relative">

                    {/* Chat Header */}
                    <div className="px-6 py-5 bg-gradient-to-r from-silk-light/40 to-white backdrop-blur-md border-b border-silk/60 flex items-center justify-between sticky top-0 z-10">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-12 h-12 bg-silk-light flex items-center justify-center rounded-full border border-silk shadow-sm">
                                    <MessageCircle size={22} className="text-dark-red" />
                                </div>
                                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                            </div>
                            <div>
                                <h2 className="font-serif text-dark-red text-xl font-medium">Bodilicious Advisor</h2>
                                <p className="font-sans text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                                    Online • Replies instantly
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={clearChat}
                            className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-gray-400 hover:text-red-500"
                            title="Clear Chat"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-neutral-50/50">
                        <AnimatePresence initial={false}>
                            {messages.map((msg) => {
                                const isUser = msg.sender === "user";

                                return (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                                    >
                                        {/* Bot Avatar */}
                                        {!isUser && (
                                            <div className="w-8 h-8 bg-silk-light flex items-center justify-center shrink-0 mr-3 mt-auto mb-1 rounded-full border border-silk shadow-sm z-10">
                                                <Sparkles size={14} className="text-dark-red" />
                                            </div>
                                        )}

                                        <div
                                            className={`max-w-[90%] sm:max-w-[85%] p-5 text-[15px] leading-relaxed shadow-sm transition-all duration-300 relative ${isUser
                                                ? "bg-gradient-to-br from-dark-red to-ruby-red text-silk ml-auto rounded-2xl rounded-tr-sm shadow-md"
                                                : "bg-white text-gray-800 border border-silk/80 rounded-2xl rounded-tl-sm shadow-md"
                                                }`}
                                        >
                                            {isUser ? (
                                                <p className="whitespace-pre-wrap font-sans font-light tracking-wide">{msg.text}</p>
                                            ) : (
                                                <div className="space-y-4 font-sans w-full tracking-wide font-light">
                                                    {renderMarkdown(msg.text)}
                                                    {msg.products && msg.products.length > 0 && (
                                                        <div className="mt-5 pt-4 border-t border-silk/30">
                                                            <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 scrollbar-thin scrollbar-thumb-silk scrollbar-track-transparent snap-x">
                                                                {msg.products.map((p: any, idx: number) => {
                                                                    const productFromApp = allProducts.find(ap => ap.pid === (p.id || p.pid));
                                                                    if (!productFromApp) return null;
                                                                    return (
                                                                        <div key={idx} className="min-w-[240px] max-w-[260px] snap-start bg-white rounded-xl overflow-hidden border border-silk/60 hover:border-ruby-red/50 transition-colors shadow-sm">
                                                                            <ProductCard product={productFromApp} />
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* User Avatar */}
                                        {isUser && (
                                            <div className="w-8 h-8 bg-silk-dark flex items-center justify-center shrink-0 ml-3 mt-auto mb-1 rounded-full border border-silk shadow-sm z-10">
                                                <User size={14} className="text-white" />
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>

                        {/* Typing Indicator */}
                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className="flex justify-start items-end"
                            >
                                <div className="w-8 h-8 bg-silk-light flex items-center justify-center shrink-0 mr-3 mb-1 rounded-full border border-silk shadow-sm z-10">
                                    <Sparkles size={14} className="text-dark-red" />
                                </div>
                                <div className="bg-white border border-silk/80 shadow-md rounded-2xl rounded-tl-sm p-4 w-auto flex items-center justify-center gap-1.5 h-[52px]">
                                    <motion.div
                                        className="w-2 h-2 bg-ruby-red/70 rounded-full"
                                        animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
                                        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0 }}
                                    />
                                    <motion.div
                                        className="w-2 h-2 bg-ruby-red/70 rounded-full"
                                        animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
                                        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
                                    />
                                    <motion.div
                                        className="w-2 h-2 bg-ruby-red/70 rounded-full"
                                        animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
                                        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                                    />
                                </div>
                            </motion.div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Replies & Input */}
                    <div className="bg-white border-t border-silk pt-3 pb-5 px-6 mt-auto">

                        {/* Suggestions */}
                        {!isLoading && (
                            <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide snap-x">
                                {SUGGESTIONS.map((suggestion) => (
                                    <motion.button
                                        key={suggestion}
                                        onClick={() => handleSendMessage(suggestion)}
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                        className="snap-start whitespace-nowrap px-5 py-2.5 rounded-full border border-silk/80 bg-white shadow-sm text-dark-red font-sans text-xs font-medium hover:bg-silk-light hover:border-silk hover:shadow-md transition-all duration-300"
                                    >
                                        {suggestion}
                                    </motion.button>
                                ))}
                            </div>
                        )}

                        {/* Input Box */}
                        <div className="relative flex items-center bg-white border border-silk rounded-full shadow-sm focus-within:border-ruby-red focus-within:ring-4 focus-within:ring-ruby-red/10 focus-within:shadow-md transition-all duration-300 p-1.5">
                            <input
                                type="text"
                                className="flex-1 bg-transparent px-5 py-3 text-[15px] focus:outline-none font-sans text-gray-800 placeholder:text-gray-400 font-light tracking-wide w-full"
                                placeholder="Type your skin concern..."
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                disabled={isLoading}
                            />
                            <button
                                onClick={() => handleSendMessage()}
                                disabled={!inputMessage.trim() || isLoading}
                                className="bg-gradient-to-r from-dark-red to-ruby-red text-silk h-12 px-7 flex items-center justify-center font-medium hover:opacity-90 disabled:opacity-50 disabled:bg-gray-300 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all duration-300 rounded-full shadow-sm focus:outline-none"
                                aria-label="Send message"
                            >
                                Send <Send size={16} className="ml-2 hidden sm:block" />
                            </button>
                        </div>
                    </div>

                </div>
            </div>


        </div>
    );
}

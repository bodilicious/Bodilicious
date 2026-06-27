import { useRef, useEffect } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { getAccessibleVariant, staggerContainerVariant, fadeUpVariant } from '../utils/motionTokens';

import EditableList from './EditableList';
import EditableBlock from './EditableBlock';

const PLACEHOLDER_VIDEOS = [
    { url: '/snipets/morning.webm', caption: 'Morning Routine', order: 1 },
    { url: '/snipets/night.webm', caption: 'Night Routine', order: 2 },
    { url: '/snipets/nourishment.webm', caption: 'Nourishment and Hydration', order: 3 },
    { url: '/snipets/instant-glow.webm', caption: 'Instant Glow', order: 4 },
];

/**
 * LazyVideo: Only loads and plays video when it enters the viewport.
 * This prevents the browser from fetching 40-62MB video files on page load.
 */
function LazyVideo({ src, className }: { src: string; className: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const hasLoaded = useRef(false);
    const lastSrc = useRef(src);

    const isInstagram = src.includes('instagram.com/reel/') || src.includes('instagram.com/p/');

    useEffect(() => {
        if (lastSrc.current !== src) {
            hasLoaded.current = false;
            lastSrc.current = src;
        }

        const container = containerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    if (!hasLoaded.current) {
                        if (isInstagram && iframeRef.current) {
                            try {
                                const urlObj = new URL(src);
                                let pathname = urlObj.pathname;
                                if (!pathname.endsWith('/')) pathname += '/';
                                if (!pathname.includes('embed')) pathname += 'embed/';
                                iframeRef.current.src = `${urlObj.origin}${pathname}`;
                            } catch(e) {
                                iframeRef.current.src = src;
                            }
                        } else if (videoRef.current) {
                            videoRef.current.src = src;
                            videoRef.current.load();
                        }
                        hasLoaded.current = true;
                    }
                    if (!isInstagram && videoRef.current) {
                        videoRef.current.play().catch(() => {});
                    }
                } else {
                    if (!isInstagram && videoRef.current) {
                        videoRef.current.pause();
                    }
                }
            },
            { threshold: 0.25 }
        );

        observer.observe(container);
        return () => observer.disconnect();
    }, [src, isInstagram]);

    return (
        <div ref={containerRef} className={className}>
            {isInstagram ? (
                <iframe
                    ref={iframeRef}
                    className="w-full h-full border-none pointer-events-auto"
                    scrolling="no"
                    allowTransparency={true}
                    allow="encrypted-media"
                />
            ) : (
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    preload="none"
                    loop
                    muted
                    playsInline
                    disablePictureInPicture
                    controlsList="nodownload nofullscreen noremoteplayback"
                />
            )}
        </div>
    );
}

interface VideoSnippetsProps {
    isEditing?: boolean;
    items?: any[];
    onItemsChange?: (newItems: any[]) => void;
}

export default function VideoSnippets({ isEditing = false, items, onItemsChange }: VideoSnippetsProps) {
    const shouldReduceMotion = useReducedMotion();
    const stagger = getAccessibleVariant(staggerContainerVariant, !!shouldReduceMotion);
    const fadeUp = getAccessibleVariant(fadeUpVariant, !!shouldReduceMotion);

    const videos = items && items.length > 0 ? items : PLACEHOLDER_VIDEOS;

    return (
        <section className="py-20 bg-white overflow-hidden">
            <m.div
                className="max-w-7xl mx-auto px-6"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={stagger}
            >
                <m.div variants={fadeUp} className="text-center mb-12">
                    <p className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-2">
                        The Bodilicious Experience
                    </p>
                    <h2 className="font-serif text-dark-red text-3xl md:text-4xl">Glow in Action</h2>
                </m.div>

                <EditableList
                    isEditing={isEditing}
                    items={videos}
                    onItemsChange={onItemsChange || (() => {})}
                    getItemId={(v) => v._id || v.caption}
                    strategy="rect"
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
                    onAdd={() => {
                        if (onItemsChange) {
                            onItemsChange([...videos, { _id: Array.from({length:24}, () => Math.floor(Math.random()*16).toString(16)).join(''), url: '', caption: 'New Video', order: videos.length + 1 }]);
                        }
                    }}
                    renderItem={(video, index) => (
                        <m.div
                            variants={isEditing ? undefined : fadeUp}
                            style={isEditing ? { opacity: 1, transform: 'none' } : undefined}
                            className={`relative overflow-hidden aspect-[9/16] rounded-sm group shadow-sm bg-silk-light flex flex-col ${isEditing ? 'border border-slate-200' : ''}`}
                        >
                            {isEditing ? (
                                <div className="absolute top-2 left-2 right-2 z-20 flex flex-col gap-1">
                                    <input
                                        type="text"
                                        placeholder="Video URL"
                                        className="w-full bg-white/90 text-xs px-2 py-1 rounded shadow-sm text-slate-800 border-none focus:ring-1 focus:ring-ruby-red"
                                        value={video.url}
                                        onChange={(e) => {
                                            if (onItemsChange) {
                                                const nv = [...videos];
                                                nv[index] = { ...nv[index], url: e.target.value };
                                                onItemsChange(nv);
                                            }
                                        }}
                                    />
                                </div>
                            ) : null}
                            <LazyVideo
                                src={video.url}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-dark-red/70 via-dark-red/10 to-transparent opacity-80 pointer-events-none" />
                            <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                                <EditableBlock
                                    isEditing={isEditing}
                                    value={video.caption}
                                    onChange={(v) => {
                                        if (onItemsChange) {
                                            const nv = [...videos];
                                            nv[index] = { ...nv[index], caption: v };
                                            onItemsChange(nv);
                                        }
                                    }}
                                    tagName="p"
                                    className="font-serif text-silk text-lg mb-1 block"
                                />
                            </div>
                        </m.div>
                    )}
                />
            </m.div>
        </section>
    );
}

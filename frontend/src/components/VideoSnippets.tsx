import { useRef, useEffect } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { getAccessibleVariant, staggerContainerVariant, fadeUpVariant } from '../utils/motionTokens';

const PLACEHOLDER_VIDEOS = [
    { src: '/snipets/morning.mp4', title: 'Morning Routine' },
    { src: '/snipets/night.mp4', title: 'Night Routine' },
    { src: '/snipets/nourishment.mp4', title: 'Nourishment and Hydration' },
    { src: '/snipets/instant-glow.mp4', title: 'Instant Glow' },
];

/**
 * LazyVideo: Only loads and plays video when it enters the viewport.
 * This prevents the browser from fetching 40-62MB video files on page load.
 */
function LazyVideo({ src, className }: { src: string; className: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hasLoaded = useRef(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    // Lazily assign src only when video enters viewport
                    if (!hasLoaded.current) {
                        video.src = src;
                        hasLoaded.current = true;
                    }
                    video.play().catch(() => {
                        // Autoplay blocked — user interaction required on some browsers
                    });
                } else {
                    video.pause();
                }
            },
            { threshold: 0.25 }
        );

        observer.observe(video);
        return () => observer.disconnect();
    }, [src]);

    return (
        <video
            ref={videoRef}
            className={className}
            // DO NOT set src here — it's assigned lazily by the IntersectionObserver
            preload="none"
            loop
            muted
            playsInline
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
        />
    );
}

export default function VideoSnippets() {
    const shouldReduceMotion = useReducedMotion();
    const stagger = getAccessibleVariant(staggerContainerVariant, !!shouldReduceMotion);
    const fadeUp = getAccessibleVariant(fadeUpVariant, !!shouldReduceMotion);

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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    {PLACEHOLDER_VIDEOS.map((video, index) => (
                        <m.div
                            key={index}
                            variants={fadeUp}
                            className="relative overflow-hidden aspect-[9/16] rounded-sm group shadow-sm bg-silk-light"
                        >
                            <LazyVideo
                                src={video.src}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-dark-red/70 via-dark-red/10 to-transparent opacity-80" />
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                                <p className="font-serif text-silk text-lg mb-1">{video.title}</p>
                            </div>
                        </m.div>
                    ))}
                </div>
            </m.div>
        </section>
    );
}

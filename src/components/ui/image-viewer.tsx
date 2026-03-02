'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCcw, Search } from 'lucide-react';

interface ImageViewerProps {
    src: string | null;
    alt?: string;
    onClose: () => void;
}

export function ImageViewer({ src, alt = '', onClose }: ImageViewerProps) {
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isMagnifierActive, setIsMagnifierActive] = useState(false);
    const [magnifierState, setMagnifierState] = useState({ x: 0, y: 0, imgX: 0, imgY: 0, rw: 0, rh: 0, active: false });
    const containerRef = useRef<HTMLDivElement>(null);

    const zoomIn = useCallback(() => {
        setScale((prev) => Math.min(prev + 0.5, 4));
        setIsMagnifierActive(false);
    }, []);

    const zoomOut = useCallback(() => {
        setScale((prev) => Math.max(prev - 0.5, 1));
        if (scale - 0.5 <= 1) {
            setPan({ x: 0, y: 0 });
        }
    }, [scale]);

    const resetZoom = useCallback(() => {
        setScale(1);
        setPan({ x: 0, y: 0 });
        setIsMagnifierActive(false);
    }, []);

    const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
        if (!isMagnifierActive) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setMagnifierState({
            x: e.clientX,
            y: e.clientY,
            imgX: e.clientX - rect.left,
            imgY: e.clientY - rect.top,
            rw: rect.width,
            rh: rect.height,
            active: true
        });
    };

    const handleMouseLeave = () => {
        setMagnifierState(prev => ({ ...prev, active: false }));
    };

    if (!src) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md"
            onClick={onClose}
        >
            {/* Top bar */}
            <div
                className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10"
                onClick={(e) => e.stopPropagation()}
            >
                <span className="text-white/70 text-sm truncate max-w-[60%]">{alt}</span>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Image */}
            <div
                ref={containerRef}
                className="flex-1 flex items-center justify-center w-full overflow-hidden p-4 relative"
                onClick={(e) => {
                    if (e.target === e.currentTarget) onClose();
                }}
            >
                <motion.img
                    key={src}
                    src={src}
                    alt={alt}
                    drag={!isMagnifierActive && scale > 1}
                    dragConstraints={containerRef}
                    dragElastic={0.1}
                    onDragEnd={(e, info) => setPan({ x: pan.x + info.offset.x, y: pan.y + info.offset.y })}
                    initial={{ scale: 0.9, opacity: 0, x: 0, y: 0 }}
                    animate={{ scale, opacity: 1, x: pan.x, y: pan.y }}
                    transition={{ duration: 0.2 }}
                    className={`max-w-full max-h-full object-contain select-none ${isMagnifierActive ? 'cursor-none' : (scale > 1 ? 'cursor-grab active:cursor-grabbing' : '')}`}
                    onClick={(e) => e.stopPropagation()}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    onMouseEnter={() => setMagnifierState(prev => ({ ...prev, active: true }))}
                    draggable={false}
                />

                {/* Magnifier Overlay */}
                {isMagnifierActive && magnifierState.active && (
                    <div
                        className="fixed pointer-events-none z-[300] rounded-full border border-white/40 shadow-2xl bg-black/60 overflow-hidden"
                        style={{
                            width: 150,
                            height: 150,
                            left: magnifierState.x - 75,
                            top: magnifierState.y - 75,
                        }}
                    >
                        <div
                            className="w-full h-full"
                            style={{
                                backgroundImage: `url('${src}')`,
                                backgroundRepeat: 'no-repeat',
                                backgroundSize: `${magnifierState.rw * 2}px ${magnifierState.rh * 2}px`,
                                backgroundPosition: `${-magnifierState.imgX * 2 + 75}px ${-magnifierState.imgY * 2 + 75}px`,
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Bottom controls */}
            <div
                className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur-xl rounded-2xl px-3 py-2 z-10"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={() => {
                        setIsMagnifierActive(!isMagnifierActive);
                        if (!isMagnifierActive) setScale(1);
                    }}
                    className={`p-2 rounded-xl transition-colors ${isMagnifierActive ? 'bg-primary text-primary-foreground' : 'hover:bg-white/10 text-white'}`}
                    title="Лупа (детальный осмотр)"
                >
                    <Search className="h-5 w-5" />
                </button>
                <div className="w-px h-5 bg-white/20 mx-1" />
                <button
                    onClick={zoomOut}
                    disabled={scale <= 1}
                    className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ZoomOut className="h-5 w-5" />
                </button>
                <span className="text-white/80 text-sm font-medium min-w-[48px] text-center">
                    {Math.round(scale * 100)}%
                </span>
                <button
                    onClick={zoomIn}
                    disabled={scale >= 4}
                    className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ZoomIn className="h-5 w-5" />
                </button>
                <div className="w-px h-5 bg-white/20 mx-1" />
                <button
                    onClick={resetZoom}
                    className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors"
                >
                    <RotateCcw className="h-4 w-4" />
                </button>
            </div>
        </motion.div>
    );
}

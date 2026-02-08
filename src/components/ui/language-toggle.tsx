'use client';

import { useTransition, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { cn } from '@/lib/utils';

const locales = ['ru', 'en'] as const;
type Locale = (typeof locales)[number];

export function LanguageToggle() {
    const currentLocale = useLocale();
    const [isPending, startTransition] = useTransition();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleChange = (newLocale: Locale) => {
        if (newLocale === currentLocale) return;

        startTransition(() => {
            document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
            window.location.reload();
        });
    };

    if (!mounted) {
        return (
            <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
                {locales.map((loc) => (
                    <div
                        key={loc}
                        className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground"
                    >
                        <span className="uppercase">{loc}</span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
            {locales.map((loc) => (
                <button
                    key={loc}
                    onClick={() => handleChange(loc)}
                    disabled={isPending}
                    className={cn(
                        'relative rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                        'disabled:opacity-50',
                        currentLocale === loc
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    {currentLocale === loc && (
                        <motion.div
                            layoutId="locale-indicator"
                            className="absolute inset-0 rounded-full bg-card shadow-sm"
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        />
                    )}
                    <span className="relative uppercase">{loc}</span>
                </button>
            ))}
        </div>
    );
}

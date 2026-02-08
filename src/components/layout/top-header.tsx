'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    LayoutDashboard,
    Warehouse,
    Users,
    Settings,
    MapPin,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

const pageMeta: Record<string, { icon: any; key: string }> = {
    '/dashboard': { icon: LayoutDashboard, key: 'overview' },
    '/dashboard/points': { icon: MapPin, key: 'points' },
    '/dashboard/warehouses': { icon: Warehouse, key: 'warehouses' },
    '/dashboard/employees': { icon: Users, key: 'employees' },
    '/dashboard/settings': { icon: Settings, key: 'settings' },
};

export function TopHeader() {
    const pathname = usePathname();
    const t = useTranslations('dashboard');
    const { user } = useAuthStore();

    // Find the matching page
    const matchedPath = Object.keys(pageMeta)
        .sort((a, b) => b.length - a.length)
        .find(path => pathname?.startsWith(path));

    const meta = matchedPath ? pageMeta[matchedPath] : pageMeta['/dashboard'];
    const Icon = meta.icon;
    const title = t(`sidebar.${meta.key}`);

    return (
        <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between px-4 py-3 sm:px-6"
        >
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h2 className="font-semibold text-lg leading-tight">{title}</h2>
                    <p className="text-xs text-muted-foreground">{user?.fullName}</p>
                </div>
            </div>
        </motion.header>
    );
}

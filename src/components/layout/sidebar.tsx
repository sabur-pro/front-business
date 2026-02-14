'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
    LayoutDashboard,
    Warehouse,
    Users,
    Settings,
    MapPin,
    Package,
    SendHorizontal,
    Store,
    Users2,
    Banknote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { warehouseApi, authApi } from '@/lib/api';

export function BottomNav() {
    const pathname = usePathname();
    const t = useTranslations('dashboard');
    const { user, setUser } = useAuthStore();
    const { settings, fetchSettings } = useSettingsStore();
    const [hasShop, setHasShop] = useState(false);
    const [hasWarehouse, setHasWarehouse] = useState(false);

    useEffect(() => {
        if (!settings) fetchSettings();
        // Refresh user data to get latest permissions
        authApi.getMe().then(setUser).catch(() => {});
    }, []);

    useEffect(() => {
        if (user) {
            warehouseApi.getAll().then(warehouses => {
                setHasShop(warehouses.some(w => w.type === 'SHOP'));
                setHasWarehouse(warehouses.some(w => w.type === 'WAREHOUSE'));
            }).catch(() => {});
        }
    }, [user]);

    const menuItems = [
        {
            icon: LayoutDashboard,
            label: t('sidebar.overview'),
            href: '/dashboard',
            exact: true,
        },
        {
            icon: MapPin,
            label: t('sidebar.points'),
            href: '/dashboard/points',
            roles: ['ORGANIZER'],
        },
        {
            icon: Warehouse,
            label: t('sidebar.warehouses'),
            href: '/dashboard/warehouses',
            roles: ['POINT_ADMIN'],
        },
        {
            icon: Package,
            label: 'Приход',
            href: '/dashboard/receipt',
        },
        {
            icon: Store,
            label: 'Магазин',
            href: '/dashboard/shop',
        },
        {
            icon: Users2,
            label: 'Контрагенты',
            href: '/dashboard/counterparties',
            roles: ['ORGANIZER'],
        },
        {
            icon: Banknote,
            label: 'Касса',
            href: '/dashboard/cash-register',
        },
        {
            icon: SendHorizontal,
            label: 'Заявки',
            href: '/dashboard/shipments',
        },
        {
            icon: Users,
            label: t('sidebar.employees'),
            href: '/dashboard/employees',
            roles: ['ORGANIZER'],
        },
        {
            icon: Settings,
            label: t('sidebar.settings'),
            href: '/dashboard/settings',
        },
    ];

    const filteredItems = menuItems.filter(item => {
        const isPointAdmin = user?.role === 'POINT_ADMIN';

        if (!item.roles) {
            // Hide Приход for POINT_ADMIN when canAddProducts is false
            if (item.href === '/dashboard/receipt' && isPointAdmin && !user?.canAddProducts) {
                return false;
            }
            // Hide Магазин if no shop warehouses
            if (item.href === '/dashboard/shop' && !hasShop) {
                return false;
            }
            // Hide Касса if no shop warehouses
            if (item.href === '/dashboard/cash-register' && !hasShop) {
                return false;
            }
            return true;
        }

        // Role-gated items
        if (item.href === '/dashboard/counterparties') {
            // ORGANIZER always sees it; POINT_ADMIN sees it only with canManageCounterparties
            if (user?.role === 'ORGANIZER') return true;
            if (isPointAdmin && user?.canManageCounterparties) return true;
            return false;
        }

        if (item.href === '/dashboard/warehouses') {
            // Only show Склады for POINT_ADMIN if they have non-shop warehouses
            if (isPointAdmin && !hasWarehouse) return false;
            return user?.role && item.roles.includes(user.role);
        }

        return user?.role && item.roles.includes(user.role);
    });

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-4 px-4 pointer-events-none">
            <motion.nav
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 25, delay: 0.1 }}
                className="pointer-events-auto flex items-center gap-1 px-3 py-2 rounded-2xl glass shadow-lg shadow-black/10 dark:shadow-black/30 border border-border/50"
            >
                {filteredItems.map((item) => {
                    const isActive = item.exact
                        ? pathname === item.href
                        : pathname?.startsWith(item.href);

                    return (
                        <Link key={item.href} href={item.href}>
                            <div
                                className={cn(
                                    "relative flex flex-col items-center gap-0.5 px-3.5 py-2 rounded-xl transition-all duration-200",
                                    isActive
                                        ? "text-primary"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="nav-indicator"
                                        className="absolute inset-0 bg-primary/10 rounded-xl"
                                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                    />
                                )}
                                <item.icon className={cn("h-5 w-5 relative z-10", isActive && "text-primary")} />
                                <span className={cn(
                                    "text-[10px] leading-tight relative z-10 font-medium",
                                    isActive && "text-primary"
                                )}>
                                    {item.label}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </motion.nav>
        </div>
    );
}

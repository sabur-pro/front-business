'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
    Warehouse,
    Package,
    TrendingUp,
    CreditCard,
    MapPin,
    Users,
    ChevronRight,
    Shield,
    SendHorizontal,
    Store,
    Users2,
    Banknote,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { useSettingsStore } from '@/stores/settings-store';
import { warehouseApi, organizationApi, productApi, WarehouseResponse, PointResponse } from '@/lib/api';

export default function DashboardPage() {
    const t = useTranslations('dashboard');
    const tWarehouses = useTranslations('warehouses');
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuthStore();

    const [warehouses, setWarehouses] = useState<WarehouseResponse[]>([]);
    const [points, setPoints] = useState<PointResponse[]>([]);
    const [totalProducts, setTotalProducts] = useState<number>(0);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const { settings, fetchSettings } = useSettingsStore();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, isLoading, router]);

    useEffect(() => {
        if (isAuthenticated) {
            loadData();
            if (!settings) fetchSettings();
        }
    }, [isAuthenticated]);

    const loadData = async () => {
        setIsLoadingData(true);
        try {
            const [warehousesData, pointsData] = await Promise.all([
                warehouseApi.getAll(),
                organizationApi.getPoints(),
            ]);
            setWarehouses(warehousesData);
            setPoints(pointsData);

            // Fetch total product count across all warehouses
            try {
                let totalProd = 0;
                for (const wh of warehousesData) {
                    const res = await productApi.searchByWarehouse(wh.id, { page: 1, limit: 1 });
                    totalProd += res.total;
                }
                setTotalProducts(totalProd);
            } catch { /* ignore */ }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setIsLoadingData(false);
        }
    };

    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <motion.div
                    className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
            </div>
        );
    }

    const isOrganizer = user?.role === 'ORGANIZER';

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-3xl font-bold mb-2">
                    {t('welcome')}, <span className="gradient-text">{user?.firstName}</span>! 👋
                </h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    <span>{isOrganizer ? 'Организатор' : 'Админ точки'}</span>
                </div>
            </motion.div>

            {/* Stats */}
            {isLoadingData ? (
                <div className="flex justify-center p-8">
                    <motion.div
                        className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                </div>
            ) : isOrganizer ? (
                <OrganizerDashboard
                    points={points}
                    warehouses={warehouses}
                    totalProducts={totalProducts}
                    router={router}
                    t={t}
                    tWarehouses={tWarehouses}
                />
            ) : (
                <PointAdminDashboard
                    points={points}
                    warehouses={warehouses}
                    canReceipt={user?.role === 'ORGANIZER' || !!settings?.canAddProducts}
                    router={router}
                />
            )}
        </div>
    );
}

// ========== ORGANIZER DASHBOARD ==========
function OrganizerDashboard({
    points,
    warehouses,
    totalProducts,
    router,
    t,
    tWarehouses,
}: {
    points: PointResponse[];
    warehouses: WarehouseResponse[];
    totalProducts: number;
    router: ReturnType<typeof useRouter>;
    t: any;
    tWarehouses: any;
}) {
    const stats = [
        { label: t('stats.totalWarehouses'), value: String(warehouses.filter(w => w.type !== 'SHOP').length), icon: Warehouse, color: 'bg-green-500/10 text-green-500' },
        { label: 'Магазинов', value: String(warehouses.filter(w => w.type === 'SHOP').length), icon: Store, color: 'bg-purple-500/10 text-purple-500' },
        { label: 'Точек', value: String(points.length), icon: MapPin, color: 'bg-blue-500/10 text-blue-500' },
        { label: t('stats.totalProducts'), value: String(totalProducts), icon: Package, color: 'bg-orange-500/10 text-orange-500' },
    ];

    const hasShops = warehouses.some(w => w.type === 'SHOP');

    return (
        <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <Card className="p-6 hover:shadow-lg transition-shadow">
                            <div className={`inline-flex p-3 rounded-xl ${stat.color} mb-4`}>
                                <stat.icon className="h-6 w-6" />
                            </div>
                            <p className="text-2xl font-bold">{stat.value}</p>
                            <p className="text-sm text-muted-foreground">{stat.label}</p>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Быстрые действия</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card
                        className="p-5 hover:shadow-lg transition-shadow cursor-pointer group"
                        onClick={() => router.push('/dashboard/receipt')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-orange-500/10">
                                    <Package className="h-5 w-5 text-orange-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Приход</h3>
                                    <p className="text-sm text-muted-foreground">Оформить приход</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Card>
                    <Card
                        className="p-5 hover:shadow-lg transition-shadow cursor-pointer group"
                        onClick={() => router.push('/dashboard/shipments')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-indigo-500/10">
                                    <SendHorizontal className="h-5 w-5 text-indigo-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Заявки</h3>
                                    <p className="text-sm text-muted-foreground">Отправки и приёмки</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Card>
                    <Card
                        className="p-5 hover:shadow-lg transition-shadow cursor-pointer group"
                        onClick={() => router.push('/dashboard/points')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-500/10">
                                    <MapPin className="h-5 w-5 text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Управление точками</h3>
                                    <p className="text-sm text-muted-foreground">{points.length} точек</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Card>
                    <Card
                        className="p-5 hover:shadow-lg transition-shadow cursor-pointer group"
                        onClick={() => router.push('/dashboard/employees')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-purple-500/10">
                                    <Users className="h-5 w-5 text-purple-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Сотрудники</h3>
                                    <p className="text-sm text-muted-foreground">Управление персоналом</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Card>
                    <Card
                        className="p-5 hover:shadow-lg transition-shadow cursor-pointer group"
                        onClick={() => router.push('/dashboard/warehouses')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-green-500/10">
                                    <Warehouse className="h-5 w-5 text-green-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Склады</h3>
                                    <p className="text-sm text-muted-foreground">{warehouses.length} складов</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Card>
                    {hasShops && (
                        <Card
                            className="p-5 hover:shadow-lg transition-shadow cursor-pointer group"
                            onClick={() => router.push('/dashboard/shop')}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-purple-500/10">
                                        <Store className="h-5 w-5 text-purple-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">Магазин</h3>
                                        <p className="text-sm text-muted-foreground">Продажи и товары</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </Card>
                    )}
                    <Card
                        className="p-5 hover:shadow-lg transition-shadow cursor-pointer group"
                        onClick={() => router.push('/dashboard/counterparties')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-teal-500/10">
                                    <Users2 className="h-5 w-5 text-teal-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Контрагенты</h3>
                                    <p className="text-sm text-muted-foreground">Поставщики и клиенты</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Card>
                    <Card
                        className="p-5 hover:shadow-lg transition-shadow cursor-pointer group"
                        onClick={() => router.push('/dashboard/cash-register')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-emerald-500/10">
                                    <Banknote className="h-5 w-5 text-emerald-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Касса</h3>
                                    <p className="text-sm text-muted-foreground">Управление финансами</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Card>
                </div>
            </div>

            {/* Recent Points with warehouses */}
            {points.length > 0 && (
                <div>
                    <h2 className="text-xl font-semibold mb-4">Точки</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {points.slice(0, 6).map((point, index) => {
                            const pointWarehouses = warehouses.filter(w => w.pointId === point.id);
                            return (
                                <motion.div
                                    key={point.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Card
                                        className="p-5 hover:shadow-lg transition-shadow cursor-pointer group"
                                        onClick={() => router.push(`/dashboard/points/${point.id}`)}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="p-2 rounded-xl bg-primary/10">
                                                <MapPin className="h-5 w-5 text-primary" />
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <h3 className="font-semibold mb-1">{point.name}</h3>
                                        {point.address && (
                                            <p className="text-sm text-muted-foreground mb-3">{point.address}</p>
                                        )}
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Warehouse className="h-3.5 w-3.5" />
                                                {pointWarehouses.filter(w => w.type !== 'SHOP').length}
                                            </span>
                                            {pointWarehouses.some(w => w.type === 'SHOP') && (
                                                <span className="flex items-center gap-1 text-purple-500">
                                                    <Store className="h-3.5 w-3.5" />
                                                    {pointWarehouses.filter(w => w.type === 'SHOP').length}
                                                </span>
                                            )}
                                        </div>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}

// ========== POINT_ADMIN DASHBOARD ==========
function PointAdminDashboard({
    points,
    warehouses,
    canReceipt,
    router,
}: {
    points: PointResponse[];
    warehouses: WarehouseResponse[];
    canReceipt: boolean;
    router: ReturnType<typeof useRouter>;
}) {
    return (
        <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="p-6">
                    <div className="inline-flex p-3 rounded-xl bg-blue-500/10 text-blue-500 mb-4">
                        <MapPin className="h-6 w-6" />
                    </div>
                    <p className="text-2xl font-bold">{points.length}</p>
                    <p className="text-sm text-muted-foreground">Мои точки</p>
                </Card>
                <Card className="p-6">
                    <div className="inline-flex p-3 rounded-xl bg-green-500/10 text-green-500 mb-4">
                        <Warehouse className="h-6 w-6" />
                    </div>
                    <p className="text-2xl font-bold">{warehouses.length}</p>
                    <p className="text-sm text-muted-foreground">Мои склады</p>
                </Card>
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Быстрые действия</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card
                        className="p-5 hover:shadow-lg transition-shadow cursor-pointer group"
                        onClick={() => router.push('/dashboard/shipments')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-indigo-500/10">
                                    <SendHorizontal className="h-5 w-5 text-indigo-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Заявки</h3>
                                    <p className="text-sm text-muted-foreground">Отправки и приёмки</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Card>
                    {canReceipt && (
                        <Card
                            className="p-5 hover:shadow-lg transition-shadow cursor-pointer group"
                            onClick={() => router.push('/dashboard/receipt')}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-orange-500/10">
                                        <Package className="h-5 w-5 text-orange-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">Приход</h3>
                                        <p className="text-sm text-muted-foreground">Оформить приход</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* Points with warehouses */}
            {points.length === 0 ? (
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <MapPin className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Нет назначенных точек</h3>
                    <p className="text-muted-foreground">
                        Ваш организатор ещё не назначил вас ни на одну точку.
                    </p>
                </Card>
            ) : (
                <div className="space-y-6">
                    {points.map((point, pi) => {
                        const pointWarehouses = warehouses.filter(w => w.pointId === point.id);
                        return (
                            <motion.div
                                key={point.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: pi * 0.1 }}
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-primary/10">
                                            <MapPin className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold">{point.name}</h2>
                                            {point.address && (
                                                <p className="text-sm text-muted-foreground">{point.address}</p>
                                            )}
                                        </div>
                                    </div>

                                    {pointWarehouses.length === 0 ? (
                                        <Card className="p-6 text-center">
                                            <p className="text-muted-foreground text-sm">Нет складов в этой точке</p>
                                        </Card>
                                    ) : (
                                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                            {pointWarehouses.map((wh, wi) => (
                                                <motion.div
                                                    key={wh.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: pi * 0.1 + wi * 0.05 }}
                                                >
                                                    <Card
                                                        className="p-5 hover:shadow-lg transition-shadow cursor-pointer group"
                                                        onClick={() => router.push(`/dashboard/warehouses/${wh.id}`)}
                                                    >
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="p-2 rounded-xl bg-green-500/10">
                                                                <Warehouse className="h-5 w-5 text-green-500" />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-xs px-2 py-1 rounded-full ${wh.isActive ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                                                                    {wh.isActive ? 'Активен' : 'Неактивен'}
                                                                </span>
                                                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </div>
                                                        </div>
                                                        <h4 className="font-semibold mb-1">{wh.name}</h4>
                                                        {wh.address && (
                                                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                                <MapPin className="h-3 w-3" />
                                                                {wh.address}
                                                            </p>
                                                        )}
                                                    </Card>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

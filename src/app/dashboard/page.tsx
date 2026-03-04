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
import { warehouseApi, organizationApi, productApi, saleApi, WarehouseResponse, PointResponse, ProductStatsResponse, SalesSummaryResponse } from '@/lib/api';

export default function DashboardPage() {
    const t = useTranslations('dashboard');
    const tWarehouses = useTranslations('warehouses');
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuthStore();

    const [warehouses, setWarehouses] = useState<WarehouseResponse[]>([]);
    const [points, setPoints] = useState<PointResponse[]>([]);
    const [totalProducts, setTotalProducts] = useState<number>(0);
    const [productStats, setProductStats] = useState<ProductStatsResponse | null>(null);
    const [salesSummary, setSalesSummary] = useState<SalesSummaryResponse | null>(null);
    const [salesPeriod, setSalesPeriod] = useState<string>('day');
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isLoadingSales, setIsLoadingSales] = useState(false);
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
            const [warehousesData, pointsData, stats, sales] = await Promise.all([
                warehouseApi.getAll(),
                organizationApi.getPoints(),
                productApi.getStats().catch(() => null),
                saleApi.getSummary('day').catch(() => null),
            ]);
            setWarehouses(warehousesData);
            setPoints(pointsData);
            if (stats) {
                setProductStats(stats);
                setTotalProducts(stats.uniqueProducts);
            }
            if (sales) {
                setSalesSummary(sales);
            }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setIsLoadingData(false);
        }
    };

    const loadSalesSummary = async (period: string) => {
        setIsLoadingSales(true);
        try {
            const sales = await saleApi.getSummary(period);
            setSalesSummary(sales);
            setSalesPeriod(period);
        } catch (error) {
            console.error('Failed to load sales summary', error);
        } finally {
            setIsLoadingSales(false);
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
                    productStats={productStats}
                    salesSummary={salesSummary}
                    salesPeriod={salesPeriod}
                    onPeriodChange={loadSalesSummary}
                    isLoadingSales={isLoadingSales}
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
    productStats,
    salesSummary,
    salesPeriod,
    onPeriodChange,
    isLoadingSales,
    router,
    t,
    tWarehouses,
}: {
    points: PointResponse[];
    warehouses: WarehouseResponse[];
    totalProducts: number;
    productStats: ProductStatsResponse | null;
    salesSummary: SalesSummaryResponse | null;
    salesPeriod: string;
    onPeriodChange: (period: string) => void;
    isLoadingSales?: boolean;
    router: ReturnType<typeof useRouter>;
    t: any;
    tWarehouses: any;
}) {
    const stats = [
        { label: t('stats.totalWarehouses'), value: String(warehouses.filter(w => w.type !== 'SHOP').length), icon: Warehouse, color: 'bg-green-500/10 text-green-500' },
        { label: 'Магазинов', value: String(warehouses.filter(w => w.type === 'SHOP').length), icon: Store, color: 'bg-purple-500/10 text-purple-500' },
        { label: 'Точек', value: String(points.length), icon: MapPin, color: 'bg-blue-500/10 text-blue-500' },
        { label: 'Уникальные товары', value: String(productStats?.uniqueProducts ?? totalProducts), icon: Package, color: 'bg-orange-500/10 text-orange-500' },
        { label: 'Всего коробок', value: String(productStats?.totalBoxes ?? 0), icon: Package, color: 'bg-amber-500/10 text-amber-500' },
        { label: 'Всего пар', value: String(productStats?.totalPairs ?? 0), icon: TrendingUp, color: 'bg-pink-500/10 text-pink-500' },
    ];

    const hasShops = warehouses.some(w => w.type === 'SHOP');

    return (
        <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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

            {/* Financial Summary */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Финансовые итоги</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Card className="p-6 bg-gradient-to-br from-red-500/10 via-rose-500/5 to-transparent border-red-500/20">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-red-500/20 rounded-xl text-red-600">
                                <Banknote className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Сумма в юанях</p>
                                <div className="flex items-baseline gap-2">
                                    <h3 className="text-2xl font-bold text-foreground">
                                        ¥ {productStats?.totalYuan?.toLocaleString('ru-RU') || 0}
                                    </h3>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-gradient-to-br from-blue-500/10 via-sky-500/5 to-transparent border-blue-500/20">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-blue-500/20 rounded-xl text-blue-600">
                                <CreditCard className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Себестоимость</p>
                                <div className="flex items-baseline gap-2">
                                    <h3 className="text-2xl font-bold text-foreground">
                                        ₽ {productStats?.totalCostRub?.toLocaleString('ru-RU') || 0}
                                    </h3>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/20">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-600">
                                <Store className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Рек. цена</p>
                                <div className="flex items-baseline gap-2">
                                    <h3 className="text-2xl font-bold text-foreground">
                                        ₽ {productStats?.totalRecommendedSale?.toLocaleString('ru-RU') || 0}
                                    </h3>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent border-orange-500/20">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-orange-500/20 rounded-xl text-orange-600">
                                <TrendingUp className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Ожидаемая прибыль</p>
                                <div className="flex items-baseline gap-2">
                                    <h3 className="text-2xl font-bold text-foreground">
                                        ₽ {productStats?.differenceRubRecommended?.toLocaleString('ru-RU') || 0}
                                    </h3>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Sales Summary */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Продажи за период</h2>
                    <div className="flex bg-muted p-1 rounded-lg">
                        {[
                            { id: 'day', label: 'День' },
                            { id: 'week', label: 'Неделя' },
                            { id: 'month', label: 'Месяц' },
                            { id: 'year', label: 'Год' },
                        ].map(period => (
                            <button
                                key={period.id}
                                onClick={() => onPeriodChange(period.id)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${salesPeriod === period.id
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                    }`}
                            >
                                {period.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-6 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/20">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-600">
                                <Banknote className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Фактическая сумма продаж</p>
                                <motion.div
                                    key={salesPeriod + (isLoadingSales ? '-loading' : '')}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-baseline gap-2"
                                >
                                    <h3 className="text-3xl font-bold text-foreground">
                                        ₽ {isLoadingSales ? '...' : salesSummary?.totalActualSales?.toLocaleString('ru-RU') || 0}
                                    </h3>
                                </motion.div>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-6 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent border-orange-500/20">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-orange-500/20 rounded-xl text-orange-600">
                                <TrendingUp className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Чистая прибыль</p>
                                <motion.div
                                    key={salesPeriod + (isLoadingSales ? '-loading' : '')}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-baseline gap-2"
                                >
                                    <h3 className="text-3xl font-bold text-foreground">
                                        ₽ {isLoadingSales ? '...' : salesSummary?.netProfit?.toLocaleString('ru-RU') || 0}
                                    </h3>
                                </motion.div>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-6 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent border-blue-500/20">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-blue-500/20 rounded-xl text-blue-600">
                                <Package className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Количество продаж</p>
                                <motion.div
                                    key={salesPeriod + (isLoadingSales ? '-loading' : '')}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-baseline gap-2"
                                >
                                    <h3 className="text-3xl font-bold text-foreground">
                                        {isLoadingSales ? '...' : salesSummary?.salesCount || 0}
                                    </h3>
                                </motion.div>
                            </div>
                        </div>
                    </Card>
                </div>
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

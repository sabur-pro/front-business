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
    Search,
    Clock,
    User,
    ChevronDown,
    ChevronUp,
    ImageIcon,
    Inbox,
    PackagePlus,
    Pencil,
    Trash2,
    RotateCcw,
    ArrowRight,
    ShoppingCart,
    Truck,
    PackageCheck,
    History,
    BarChart3,
} from 'lucide-react';
import { Button, Card, ImageViewer } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { useSettingsStore } from '@/stores/settings-store';
import {
    warehouseApi,
    organizationApi,
    productApi,
    saleApi,
    WarehouseResponse,
    PointResponse,
    ProductStatsResponse,
    SalesSummaryResponse,
    ProductTrackingResponse,
} from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const timelineConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
    RECEIPT: { label: 'Приход', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10', icon: PackagePlus },
    TRANSFER_OUT: { label: 'Отправка', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/10', icon: Truck },
    TRANSFER_IN: { label: 'Приёмка', color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-500/10', icon: PackageCheck },
    SALE: { label: 'Продажа', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500/10', icon: ShoppingCart },
    CREATED: { label: 'Создание', color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-500/10', icon: PackagePlus },
    UPDATED: { label: 'Изменение', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10', icon: Pencil },
    DELETED: { label: 'Удаление', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10', icon: Trash2 },
};

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

    // Product tracking search state
    const [searchQuery, setSearchQuery] = useState('');
    const [trackingData, setTrackingData] = useState<ProductTrackingResponse | null>(null);
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [trackingError, setTrackingError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'timeline' | 'stock' | 'receipts' | 'transfers' | 'sales'>('timeline');

    // Image viewer
    const [viewerImage, setViewerImage] = useState<string | null>(null);
    const [viewerAlt, setViewerAlt] = useState('');

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

    const isSearching = searchQuery.trim() !== '';

    const handleSearchSubmit = async () => {
        const q = searchQuery.trim();
        if (!q) return;
        setTrackingLoading(true);
        setTrackingError(null);
        setTrackingData(null);
        try {
            const data = await productApi.trackBySku(q);
            setTrackingData(data);
        } catch (err: any) {
            setTrackingError(err?.response?.data?.message || 'Ошибка поиска');
        } finally {
            setTrackingLoading(false);
        }
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearchSubmit();
    };

    const handleSearchChange = (val: string) => {
        setSearchQuery(val);
        if (!val.trim()) {
            setTrackingData(null);
            setTrackingError(null);
        }
    };

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
                setTotalProducts(stats.totalProducts);
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

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const trackingTabs = [
        { id: 'timeline' as const, label: 'Хронология', icon: History },
        { id: 'stock' as const, label: 'Остатки', icon: BarChart3 },
        { id: 'receipts' as const, label: 'Приходы', icon: PackagePlus },
        { id: 'transfers' as const, label: 'Заявки', icon: Truck },
        { id: 'sales' as const, label: 'Продажи', icon: ShoppingCart },
    ];

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-3xl font-bold mb-2">
                    {t('welcome')}, <span className="gradient-text">{user?.firstName}</span>!
                </h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    <span>{isOrganizer ? 'Организатор' : 'Админ точки'}</span>
                </div>
            </motion.div>

            {/* Dashboard Search */}
            {isOrganizer && (
                <Card className="p-4 space-y-3">
                    <div className="relative flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                placeholder="Введите артикул и нажмите Enter..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                            />
                        </div>
                        <Button onClick={handleSearchSubmit} disabled={!searchQuery.trim() || trackingLoading} size="sm" className="px-4">
                            {trackingLoading ? (
                                <motion.div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                            ) : (
                                <Search className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </Card>
            )}

            {isSearching && isOrganizer && trackingData ? (
                /* Tracking Results View */
                <div className="space-y-4">
                    {/* Product info header */}
                    {trackingData.products.length > 0 && (
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                {(() => {
                                    const p = trackingData.products[0];
                                    const photoUrl = p.photoOriginal ? `${API_URL}${p.photoOriginal}` : p.photo ? `${API_URL}${p.photo}` : null;
                                    return (
                                        <>
                                            <div className="w-14 h-14 flex-shrink-0">
                                                {photoUrl ? (
                                                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-border cursor-pointer" onClick={() => { setViewerImage(photoUrl); setViewerAlt(p.sku); }}>
                                                        <img src={photoUrl} alt={p.sku} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                                                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-bold">{p.sku}</h3>
                                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                                                    {p.sizeRange && <span>Размеры: {p.sizeRange}</span>}
                                                    <span>¥{p.priceYuan.toLocaleString()}</span>
                                                    <span>₽{p.priceRub.toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div className="text-right text-xs">
                                                <div className="text-muted-foreground">Найдено записей</div>
                                                <div className="text-lg font-bold">{trackingData.products.length}</div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </Card>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                        {trackingTabs.map(tab => {
                            const TabIcon = tab.icon;
                            const count = tab.id === 'timeline' ? trackingData.timeline.length
                                : tab.id === 'stock' ? trackingData.currentStock.length
                                : tab.id === 'receipts' ? trackingData.receipts.length
                                : tab.id === 'transfers' ? trackingData.transfers.length
                                : trackingData.sales.length;
                            return (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                                    <TabIcon className="h-3.5 w-3.5" />
                                    {tab.label} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'timeline' && (
                        <div className="space-y-0">
                            {trackingData.timeline.length === 0 ? (
                                <Card className="p-8 text-center"><p className="text-muted-foreground">Нет событий</p></Card>
                            ) : (
                                <div className="relative pl-6">
                                    <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
                                    {trackingData.timeline.map((event, i) => {
                                        const cfg = timelineConfig[event.type] || timelineConfig['CREATED'];
                                        const Icon = cfg.icon;
                                        return (
                                            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                                                className="relative mb-3">
                                                <div className={`absolute -left-6 top-3 w-5 h-5 rounded-full flex items-center justify-center ${cfg.bgColor} ring-2 ring-background`}>
                                                    <Icon className={`h-2.5 w-2.5 ${cfg.color}`} />
                                                </div>
                                                <Card className="p-3 ml-2">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
                                                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                                    <Clock className="h-2.5 w-2.5" />{formatDate(event.date)}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs font-medium">{event.description}</p>
                                                            {event.pointName && (
                                                                <span className="text-[10px] text-blue-500 flex items-center gap-0.5 mt-0.5">
                                                                    <MapPin className="h-2.5 w-2.5" />{event.pointName}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-right text-[10px] flex-shrink-0">
                                                            {event.pairCount != null && <div className="text-muted-foreground">{event.pairCount} пар</div>}
                                                            {event.boxCount != null && <div className="text-muted-foreground">{event.boxCount} кор.</div>}
                                                        </div>
                                                    </div>
                                                </Card>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'stock' && (
                        <div className="space-y-2">
                            {trackingData.currentStock.length === 0 ? (
                                <Card className="p-8 text-center"><p className="text-muted-foreground">Нет остатков на складах</p></Card>
                            ) : (
                                trackingData.currentStock.map((s, i) => (
                                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                                        <Card className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${s.warehouseType === 'SHOP' ? 'bg-purple-500/10 text-purple-600' : 'bg-green-500/10 text-green-600'}`}>
                                                        {s.warehouseType === 'SHOP' ? <Store className="h-5 w-5" /> : <Warehouse className="h-5 w-5" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm">{s.warehouseName}</p>
                                                        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{s.pointName}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-bold">{s.pairCount} <span className="text-xs text-muted-foreground">пар</span></p>
                                                    <p className="text-xs text-muted-foreground">{s.boxCount} кор.</p>
                                                </div>
                                            </div>
                                        </Card>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'receipts' && (
                        <div className="space-y-2">
                            {trackingData.receipts.length === 0 ? (
                                <Card className="p-8 text-center"><p className="text-muted-foreground">Нет приходов</p></Card>
                            ) : (
                                trackingData.receipts.map((r, i) => (
                                    <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                                        <Card className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">#{r.receiptNumber}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.status === 'COMPLETED' ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'}`}>{r.status}</span>
                                                    </div>
                                                    <p className="text-xs font-medium">{r.pointName}</p>
                                                    {r.supplierName && <p className="text-[10px] text-muted-foreground">Поставщик: {r.supplierName}</p>}
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(r.createdAt)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-sm">₽{r.totalAmount.toLocaleString()}</p>
                                                    <p className="text-[11px] text-muted-foreground">{r.quantity} шт.</p>
                                                </div>
                                            </div>
                                        </Card>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'transfers' && (
                        <div className="space-y-2">
                            {trackingData.transfers.length === 0 ? (
                                <Card className="p-8 text-center"><p className="text-muted-foreground">Нет заявок</p></Card>
                            ) : (
                                trackingData.transfers.map((t, i) => (
                                    <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                                        <Card className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">#{t.transferNumber}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.status === 'CONFIRMED' ? 'bg-green-500/10 text-green-600' : t.status === 'SENT' ? 'bg-blue-500/10 text-blue-600' : t.status === 'CANCELLED' ? 'bg-red-500/10 text-red-600' : 'bg-yellow-500/10 text-yellow-600'}`}>{t.status}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <span className="font-medium">{t.fromPointName}</span>
                                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                        <span className="font-medium">{t.toPointName}</span>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(t.createdAt)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-sm">{t.pairCount} пар</p>
                                                    <p className="text-[11px] text-muted-foreground">{t.boxCount} кор.</p>
                                                    <p className="text-[10px] text-green-600">₽{t.totalRub.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </Card>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'sales' && (
                        <div className="space-y-2">
                            {trackingData.sales.length === 0 ? (
                                <Card className="p-8 text-center"><p className="text-muted-foreground">Нет продаж</p></Card>
                            ) : (
                                trackingData.sales.map((s, i) => (
                                    <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                                        <Card className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600">#{s.saleNumber}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.status === 'COMPLETED' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>{s.status}</span>
                                                    </div>
                                                    <p className="text-xs font-medium">{s.shopName}</p>
                                                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{s.pointName}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(s.createdAt)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-sm text-green-600">₽{s.totalActual.toLocaleString()}</p>
                                                    <p className="text-[11px] text-muted-foreground">{s.pairCount} пар / {s.boxCount} кор.</p>
                                                    <p className="text-[10px] text-emerald-600">Прибыль: ₽{s.profit.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </Card>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            ) : isSearching && isOrganizer && trackingLoading ? (
                <div className="flex justify-center p-12">
                    <motion.div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                </div>
            ) : isSearching && isOrganizer && trackingError ? (
                <Card className="p-8 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                        <Inbox className="h-8 w-8 text-destructive" />
                    </div>
                    <p className="text-destructive text-sm">{trackingError}</p>
                </Card>
            ) : isSearching && isOrganizer ? (
                <Card className="p-8 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Search className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-muted-foreground">Нажмите Enter или кнопку поиска</p>
                </Card>
            ) : (
                /* Stats and Everything Else */
                <div className="space-y-8">
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
            )}

            {/* Image Viewer Dialog Outside */}
            {viewerImage && (
                <ImageViewer src={viewerImage} alt={viewerAlt} onClose={() => setViewerImage(null)} />
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
        { label: 'Всего товаров', value: String(productStats?.totalProducts ?? totalProducts), icon: Package, color: 'bg-orange-500/10 text-orange-500' },
        { label: 'Уникальных товаров', value: String(productStats?.uniqueProducts ?? 0), icon: Package, color: 'bg-cyan-500/10 text-cyan-500' },
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

            {/* Financial Summary — by category */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Финансовые итоги</h2>

                {/* Overall totals */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                    <Card className="p-6 bg-gradient-to-br from-red-500/10 via-rose-500/5 to-transparent border-red-500/20">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-500/20 rounded-lg text-red-600"><Banknote className="h-5 w-5" /></div>
                            <p className="text-sm font-medium text-muted-foreground">Сумма в юанях</p>
                        </div>
                        <h3 className="text-2xl font-bold text-foreground truncate">¥ {productStats?.totalYuan?.toLocaleString('ru-RU') || 0}</h3>
                    </Card>
                    <Card className="p-6 bg-gradient-to-br from-blue-500/10 via-sky-500/5 to-transparent border-blue-500/20">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-600"><CreditCard className="h-5 w-5" /></div>
                            <p className="text-sm font-medium text-muted-foreground">Себестоимость</p>
                        </div>
                        <h3 className="text-2xl font-bold text-foreground truncate">₽ {productStats?.totalCostRub?.toLocaleString('ru-RU') || 0}</h3>
                    </Card>
                    <Card className="p-6 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/20">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-600"><Store className="h-5 w-5" /></div>
                            <p className="text-sm font-medium text-muted-foreground">Рек. цена</p>
                        </div>
                        <h3 className="text-2xl font-bold text-foreground truncate">₽ {productStats?.totalRecommendedSale?.toLocaleString('ru-RU') || 0}</h3>
                    </Card>
                    <Card className="p-6 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent border-orange-500/20">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-orange-500/20 rounded-lg text-orange-600"><TrendingUp className="h-5 w-5" /></div>
                            <p className="text-sm font-medium text-muted-foreground">Ожидаемая прибыль</p>
                        </div>
                        <h3 className="text-2xl font-bold text-foreground truncate">₽ {productStats?.differenceRubRecommended?.toLocaleString('ru-RU') || 0}</h3>
                    </Card>
                </div>

                {/* Category breakdowns */}
                {productStats?.byCategory && (
                    <div className="space-y-4">
                        {([['warehouseOnly', 'Склады', 'from-green-500/10 via-emerald-500/5', 'border-green-500/20', 'bg-green-500/20 text-green-600'],
                        ['shopOnly', 'Магазины', 'from-purple-500/10 via-fuchsia-500/5', 'border-purple-500/20', 'bg-purple-500/20 text-purple-600'],
                        ['mixed', 'Смешанные точки', 'from-indigo-500/10 via-blue-500/5', 'border-indigo-500/20', 'bg-indigo-500/20 text-indigo-600']] as const).map(([key, title, gradient, border, iconBg]) => {
                            const cat = productStats.byCategory[key as 'warehouseOnly' | 'shopOnly' | 'mixed'];
                            if (!cat) return null;
                            return (
                                <div key={key}>
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title} ({cat.totalProducts} товаров)</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <Card className={`p-4 bg-gradient-to-br ${gradient} to-transparent ${border}`}>
                                            <p className="text-[11px] text-muted-foreground mb-1">Сумма ¥</p>
                                            <p className="text-lg font-bold truncate">¥ {cat.totalYuan.toLocaleString('ru-RU')}</p>
                                        </Card>
                                        <Card className={`p-4 bg-gradient-to-br ${gradient} to-transparent ${border}`}>
                                            <p className="text-[11px] text-muted-foreground mb-1">Себестоимость</p>
                                            <p className="text-lg font-bold truncate">₽ {cat.totalCostRub.toLocaleString('ru-RU')}</p>
                                        </Card>
                                        <Card className={`p-4 bg-gradient-to-br ${gradient} to-transparent ${border}`}>
                                            <p className="text-[11px] text-muted-foreground mb-1">Рек. цена</p>
                                            <p className="text-lg font-bold truncate">₽ {cat.totalRecommendedSale.toLocaleString('ru-RU')}</p>
                                        </Card>
                                        <Card className={`p-4 bg-gradient-to-br ${gradient} to-transparent ${border}`}>
                                            <p className="text-[11px] text-muted-foreground mb-1">Ожид. прибыль</p>
                                            <p className="text-lg font-bold truncate">₽ {cat.differenceRubRecommended.toLocaleString('ru-RU')}</p>
                                        </Card>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* In-Transit Products */}
            {(productStats?.inTransitProducts ?? 0) > 0 && (
                <div>
                    <h2 className="text-xl font-semibold mb-4">В дороге</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="p-6 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent border-violet-500/20">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-3 bg-violet-500/20 rounded-xl text-violet-600">
                                    <SendHorizontal className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Товаров в дороге</p>
                                    <div className="flex items-baseline gap-2">
                                        <h3 className="text-2xl font-bold text-foreground">
                                            {productStats?.inTransitProducts?.toLocaleString('ru-RU') || 0}
                                        </h3>
                                    </div>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-6 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-transparent border-violet-500/20">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-3 bg-violet-500/20 rounded-xl text-violet-600">
                                    <Banknote className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Сумма в юанях</p>
                                    <div className="flex items-baseline gap-2">
                                        <h3 className="text-2xl font-bold text-foreground">
                                            ¥ {productStats?.inTransitYuan?.toLocaleString('ru-RU') || 0}
                                        </h3>
                                    </div>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-6 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent border-violet-500/20">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-3 bg-violet-500/20 rounded-xl text-violet-600">
                                    <CreditCard className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Себестоимость в рублях</p>
                                    <div className="flex items-baseline gap-2">
                                        <h3 className="text-2xl font-bold text-foreground">
                                            ₽ {productStats?.inTransitRub?.toLocaleString('ru-RU') || 0}
                                        </h3>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

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

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Store,
    ArrowLeft,
    Package,
    X,
    Ban,
    ChevronDown,
    ChevronUp,
    Calendar,
    Hash,
    Banknote,
    CreditCard,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import {
    saleApi,
    warehouseApi,
    SaleResponse,
    PaginatedSalesResponse,
    WarehouseResponse,
} from '@/lib/api';
import { groupByDay, filterByDate } from '@/lib/date-utils';

export default function SalesHistoryPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const shopId = searchParams.get('shopId');
    const { user } = useAuthStore();
    const isOrganizer = user?.role === 'ORGANIZER';

    const [shop, setShop] = useState<WarehouseResponse | null>(null);
    const [sales, setSales] = useState<SaleResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [dateFilter, setDateFilter] = useState('');

    const filteredSales = useMemo(() => filterByDate(sales, s => s.createdAt, dateFilter), [sales, dateFilter]);
    const groupedSales = useMemo(() => groupByDay(filteredSales, s => s.createdAt), [filteredSales]);

    useEffect(() => {
        if (shopId) {
            loadShop();
            loadSales(1);
        }
    }, [shopId]);

    const loadShop = async () => {
        try {
            const data = await warehouseApi.getById(shopId!);
            setShop(data);
        } catch { /* ignore */ }
    };

    const loadSales = async (p: number) => {
        setIsLoading(true);
        try {
            const data = await saleApi.getByShop(shopId!, { page: p, limit: 20 });
            setSales(data.items);
            setTotal(data.total);
            setPage(data.page);
            setTotalPages(data.totalPages);
        } catch (err) {
            console.error('Failed to load sales', err);
        } finally {
            setIsLoading(false);
        }
    };

    const onCancel = async (saleId: string) => {
        if (!confirm('Отменить продажу? Товары будут возвращены в магазин.')) return;
        setIsCancelling(true);
        setError(null);
        try {
            const updated = await saleApi.cancel(saleId);
            setSales(prev => prev.map(s => s.id === saleId ? updated : s));
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка отмены продажи');
        } finally {
            setIsCancelling(false);
        }
    };

    if (!shopId) {
        return <div className="p-8 text-center text-muted-foreground">Не указан магазин.</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold">История продаж</h1>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Store className="h-3.5 w-3.5" />
                        {shop?.name || 'Магазин'}
                        {total > 0 && <span className="ml-2">· {total} продаж</span>}
                    </p>
                </div>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                {dateFilter && (
                    <button
                        onClick={() => setDateFilter('')}
                        className="px-2 py-1.5 rounded-lg text-xs font-medium bg-muted/60 text-muted-foreground hover:bg-muted transition-all"
                    >
                        Сбросить
                    </button>
                )}
            </div>

            {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="hover:opacity-70">✕</button>
                </motion.div>
            )}

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <motion.div
                        className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                </div>
            ) : sales.length === 0 ? (
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                        <Store className="h-8 w-8 text-purple-500" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Нет продаж</h3>
                    <p className="text-muted-foreground">Продажи этого магазина будут отображаться здесь</p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {groupedSales.map(group => (
                        <div key={group.date} className="space-y-2">
                            <div className="flex items-center gap-2 pt-2">
                                <div className="h-px flex-1 bg-border/60" />
                                <span className="text-xs font-semibold text-muted-foreground px-2">{group.label}</span>
                                <div className="h-px flex-1 bg-border/60" />
                            </div>
                    {group.items.map((sale) => {
                        const isExpanded = expandedSaleId === sale.id;
                        return (
                            <Card key={sale.id} className="overflow-hidden">
                                <button
                                    onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                                    className="w-full p-4 text-left flex items-center gap-4"
                                >
                                    <div className={`p-2 rounded-xl ${sale.status === 'CANCELLED' ? 'bg-gray-500/10' : 'bg-green-500/10'}`}>
                                        {sale.status === 'CANCELLED' ? (
                                            <Ban className="h-5 w-5 text-gray-500" />
                                        ) : (
                                            <Store className="h-5 w-5 text-green-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-medium text-sm">{sale.number}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                                sale.status === 'COMPLETED'
                                                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                                    : 'bg-gray-500/10 text-gray-500'
                                            }`}>
                                                {sale.status === 'COMPLETED' ? 'Завершена' : 'Отменена'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(sale.createdAt).toLocaleDateString('ru-RU')}
                                            </span>
                                            <span>{sale.items.length} поз.</span>
                                            <span className={`flex items-center gap-0.5 font-medium ${sale.paymentMethod === 'CARD' ? 'text-blue-500' : 'text-green-600 dark:text-green-400'}`}>
                                                {sale.paymentMethod === 'CARD' ? <CreditCard className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                                                {sale.paymentMethod === 'CARD' ? 'Карта' : 'Нал.'}
                                            </span>
                                            {sale.clientName && (
                                                <span className="text-blue-500 font-medium">{sale.clientName}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="font-semibold text-sm">{Number(sale.totalActual).toLocaleString('ru-RU')} ₽</p>
                                        {isOrganizer && (
                                            <p className={`text-xs ${Number(sale.profit) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                                                {Number(sale.profit) >= 0 ? '+' : ''}{Number(sale.profit).toLocaleString('ru-RU')} ₽
                                            </p>
                                        )}
                                    </div>
                                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                </button>

                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                                                {/* Items */}
                                                <div className="space-y-2">
                                                    {sale.items.map(item => (
                                                        <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                                                            {item.photo ? (
                                                                <img src={`${process.env.NEXT_PUBLIC_API_URL}${item.photo}`} alt="" className="w-9 h-9 rounded-lg object-cover" />
                                                            ) : (
                                                                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                                                                    <Package className="h-4 w-4 text-muted-foreground" />
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-medium truncate">{item.sku}</p>
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {item.boxCount} кор. / {item.pairCount} пар · {Number(item.actualSalePrice)}₽/пара
                                                                </p>
                                                            </div>
                                                            <p className="text-xs font-medium">{Number(item.totalActual).toLocaleString('ru-RU')} ₽</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Summary */}
                                                <div className="space-y-1 text-xs">
                                                    {isOrganizer && (
                                                        <>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Себестоимость (¥)</span>
                                                                <span>{Number(sale.totalYuan).toLocaleString('ru-RU')} ¥</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Себестоимость (₽)</span>
                                                                <span>{Number(sale.totalRub).toLocaleString('ru-RU')} ₽</span>
                                                            </div>
                                                        </>
                                                    )}
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Рекомендованная</span>
                                                        <span>{Number(sale.totalRecommended).toLocaleString('ru-RU')} ₽</span>
                                                    </div>
                                                    <div className="flex justify-between font-medium border-t border-border/50 pt-1">
                                                        <span>Фактическая</span>
                                                        <span>{Number(sale.totalActual).toLocaleString('ru-RU')} ₽</span>
                                                    </div>
                                                    {sale.clientName && (
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Клиент</span>
                                                            <span className="text-blue-500">{sale.clientName}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Тип оплаты</span>
                                                        <span className={sale.paymentMethod === 'CARD' ? 'text-blue-500' : 'text-green-600 dark:text-green-400'}>
                                                            {sale.paymentMethod === 'CARD' ? 'Карта' : 'Наличные'}
                                                        </span>
                                                    </div>
                                                    {Number(sale.paidAmount) > 0 && Number(sale.paidAmount) < Number(sale.totalActual) && (
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Оплачено</span>
                                                            <span>{Number(sale.paidAmount).toLocaleString('ru-RU')} ₽</span>
                                                        </div>
                                                    )}
                                                    {Number(sale.paidAmount) >= 0 && Number(sale.paidAmount) < Number(sale.totalActual) && sale.clientId && (
                                                        <div className="flex justify-between font-medium text-orange-500">
                                                            <span>Долг</span>
                                                            <span>{(Number(sale.totalActual) - Number(sale.paidAmount)).toLocaleString('ru-RU')} ₽</span>
                                                        </div>
                                                    )}
                                                    {isOrganizer && (
                                                        <div className="flex justify-between font-medium">
                                                            <span>Прибыль</span>
                                                            <span className={Number(sale.profit) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}>
                                                                {Number(sale.profit) >= 0 ? '+' : ''}{Number(sale.profit).toLocaleString('ru-RU')} ₽
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {sale.note && (
                                                    <p className="text-xs text-muted-foreground italic">Примечание: {sale.note}</p>
                                                )}

                                                {sale.status === 'COMPLETED' && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => onCancel(sale.id)}
                                                        isLoading={isCancelling}
                                                    >
                                                        <Ban className="h-3.5 w-3.5 mr-1.5" />
                                                        Отменить продажу
                                                    </Button>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </Card>
                        );
                    })}
                        </div>
                    ))}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2 pt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => loadSales(page - 1)}
                            >
                                Назад
                            </Button>
                            <span className="flex items-center text-sm text-muted-foreground px-3">
                                {page} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => loadSales(page + 1)}
                            >
                                Далее
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

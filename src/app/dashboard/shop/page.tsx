'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Store,
    Package,
    Search,
    Trash2,
    Pencil,
    History,
    CheckCircle2,
    Clock,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    CalendarDays,
    Undo2,
    ShoppingCart,
    X,
    CheckSquare,
    Square,
    Eye,
    EyeOff,
} from 'lucide-react';
import { Button, Card, ImageViewer, AuditHistoryModal, ProductEditModal } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import {
    warehouseApi,
    organizationApi,
    productApi,
    saleApi,
    shopApi,
    tzOffsetMinutes,
    WarehouseResponse,
    PointResponse,
    ProductResponse,
    ArrivalDayResponse,
    ArrivalRowResponse,
    ProductSortField,
} from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const ALL_PRODUCTS_LIMIT = 200;

type Mode = 'day' | 'all';
type SortField = 'arrivedAt' | 'sku' | 'sizeRange' | 'boxCount' | 'pairCount' | 'priceRub' | 'recommendedSalePrice' | 'total';

/** Строка таблицы: партия поступления либо товар из общего списка */
interface Row {
    key: string;
    arrivalId?: string;
    productId: string;
    sku: string;
    photo: string | null;
    sizeRange: string | null;
    barcode: string | null;
    arrivedAt: string | null;
    /** Сколько пришло в партии */
    arrivedBoxes: number;
    arrivedPairs: number;
    soldBoxes: number;
    soldPairs: number;
    /** Сколько ещё можно продать */
    availableBoxes: number;
    availablePairs: number;
    priceYuan: number;
    priceRub: number;
    recommendedSalePrice: number;
    isRemainder: boolean;
}

/** Что продавец ввёл в строке */
interface RowInput {
    selected: boolean;
    boxCount: number;
    pairCount: number;
    price: number;
}

const todayLocal = () => {
    const now = new Date();
    return new Date(now.getTime() + tzOffsetMinutes() * 60_000).toISOString().slice(0, 10);
};

const shiftDate = (date: string, days: number) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
};

const formatDate = (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'short',
        timeZone: 'UTC',
    });
};

const formatWeekday = (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('ru-RU', { weekday: 'short', timeZone: 'UTC' });
};

const money = (value: number) => Math.round(value).toLocaleString('ru-RU');

const arrivalToRow = (a: ArrivalRowResponse, isRemainder: boolean): Row => ({
    key: a.id,
    arrivalId: a.id,
    productId: a.productId ?? '',
    sku: a.sku,
    photo: a.photo,
    sizeRange: a.sizeRange,
    barcode: a.barcode,
    arrivedAt: a.arrivedAt,
    arrivedBoxes: a.boxCount,
    arrivedPairs: a.pairCount,
    soldBoxes: a.soldBoxes,
    soldPairs: a.soldPairs,
    availableBoxes: a.availableBoxes,
    availablePairs: a.availablePairs,
    priceYuan: a.priceYuan,
    priceRub: a.priceRub,
    recommendedSalePrice: a.recommendedSalePrice,
    isRemainder,
});

const productToRow = (p: ProductResponse): Row => ({
    key: `p:${p.id}`,
    productId: p.id,
    sku: p.sku,
    photo: p.photo,
    sizeRange: p.sizeRange,
    barcode: p.barcode,
    arrivedAt: p.lastArrivedAt,
    arrivedBoxes: p.boxCount,
    arrivedPairs: p.pairCount,
    soldBoxes: 0,
    soldPairs: 0,
    availableBoxes: p.boxCount,
    availablePairs: p.pairCount,
    priceYuan: p.priceYuan,
    priceRub: p.priceRub,
    recommendedSalePrice: p.recommendedSalePrice,
    isRemainder: false,
});

export default function ShopPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const isOrganizer = user?.role === 'ORGANIZER';
    const canEditProducts = isOrganizer || !!user?.canEditProducts;
    const canDeleteProducts = isOrganizer || !!user?.canDeleteProducts;

    const [shops, setShops] = useState<WarehouseResponse[]>([]);
    const [points, setPoints] = useState<PointResponse[]>([]);
    const [selectedShop, setSelectedShop] = useState<WarehouseResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingRows, setIsLoadingRows] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Дни и режим
    const [mode, setMode] = useState<Mode>('day');
    const [selectedDate, setSelectedDate] = useState(todayLocal());
    const [days, setDays] = useState<ArrivalDayResponse[]>([]);
    const [isDayListOpen, setIsDayListOpen] = useState(false);

    // Строки
    const [dayRows, setDayRows] = useState<Row[]>([]);
    const [remainderRows, setRemainderRows] = useState<Row[]>([]);
    const [allRows, setAllRows] = useState<Row[]>([]);
    const [inputs, setInputs] = useState<Record<string, RowInput>>({});
    const [showRemainders, setShowRemainders] = useState(false);
    const [hideSoldOut, setHideSoldOut] = useState(true);

    // Поиск и сортировка
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('arrivedAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // Модалки
    const [editProduct, setEditProduct] = useState<ProductResponse | null>(null);
    const [deleteRow, setDeleteRow] = useState<Row | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [historyProductId, setHistoryProductId] = useState<string | null>(null);
    const [viewerImage, setViewerImage] = useState<string | null>(null);
    const [isReturnOpen, setIsReturnOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [saleCreated, setSaleCreated] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            setIsLoading(true);
            try {
                const [warehousesData, pointsData] = await Promise.all([
                    warehouseApi.getAll(),
                    organizationApi.getPoints(),
                ]);
                setPoints(pointsData);
                const shopsList = warehousesData.filter((w) => w.type === 'SHOP');
                setShops(shopsList);
                if (shopsList.length > 0) setSelectedShop(shopsList[0]);
            } catch {
                setError('Не удалось загрузить магазины');
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const buildInputs = (rows: Row[], preselect: boolean) => {
        const next: Record<string, RowInput> = {};
        for (const row of rows) {
            next[row.key] = {
                selected: preselect && row.availablePairs > 0,
                boxCount: row.availableBoxes,
                pairCount: row.availablePairs,
                price: row.recommendedSalePrice || 0,
            };
        }
        return next;
    };

    const loadDay = useCallback(async (shopId: string, date: string) => {
        setIsLoadingRows(true);
        setError(null);
        try {
            const [data, daysData] = await Promise.all([
                shopApi.getArrivals(shopId, date, true),
                shopApi.getArrivalDays(shopId),
            ]);
            const items = data.items.filter((a) => a.productId).map((a) => arrivalToRow(a, false));
            const rest = data.remainders.filter((a) => a.productId).map((a) => arrivalToRow(a, true));
            setDayRows(items);
            setRemainderRows(rest);
            setDays(daysData);
            setInputs({ ...buildInputs(items, true), ...buildInputs(rest, false) });
        } catch (err: any) {
            setError(err.response?.data?.message || 'Не удалось загрузить поступления');
        } finally {
            setIsLoadingRows(false);
        }
    }, []);

    const loadAll = useCallback(async (shopId: string, search: string, field: SortField, dir: 'asc' | 'desc') => {
        setIsLoadingRows(true);
        setError(null);
        try {
            const sortBy: ProductSortField = field === 'total' ? 'totalRub' : field === 'sizeRange' ? 'sku' : field;
            const data = await productApi.searchByWarehouse(shopId, {
                page: 1,
                limit: ALL_PRODUCTS_LIMIT,
                search: search || undefined,
                sortBy,
                order: dir,
            });
            const rows = data.items.map(productToRow);
            setAllRows(rows);
            setInputs(buildInputs(rows, false));
        } catch (err: any) {
            setError(err.response?.data?.message || 'Не удалось загрузить товары');
        } finally {
            setIsLoadingRows(false);
        }
    }, []);

    const reload = useCallback(() => {
        if (!selectedShop) return;
        if (mode === 'day') loadDay(selectedShop.id, selectedDate);
        else loadAll(selectedShop.id, searchQuery, sortField, sortDir);
    }, [selectedShop, mode, selectedDate, searchQuery, sortField, sortDir, loadDay, loadAll]);

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedShop?.id, mode, selectedDate]);

    // В общем списке сортировка и поиск идут на сервер
    useEffect(() => {
        if (mode !== 'all' || !selectedShop) return;
        const timer = setTimeout(() => loadAll(selectedShop.id, searchQuery, sortField, sortDir), 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, sortField, sortDir]);

    const getPointName = (pointId: string) => points.find((p) => p.id === pointId)?.name || '';

    const dayInfo = useMemo(() => days.find((d) => d.date === selectedDate), [days, selectedDate]);

    /** Полностью проданные позиции прячем, чтобы не оформить продажу дважды */
    const soldOutCount = useMemo(
        () => (mode === 'day' ? dayRows : allRows).filter((r) => r.availablePairs === 0 && r.availableBoxes === 0).length,
        [mode, dayRows, allRows],
    );

    const visibleRows = useMemo(() => {
        const source = mode === 'day' ? dayRows : allRows;
        const base = hideSoldOut
            ? source.filter((row) => row.availablePairs > 0 || row.availableBoxes > 0)
            : source;
        const filtered = mode === 'day' && searchQuery
            ? base.filter((row) => {
                const q = searchQuery.toLowerCase();
                return (
                    row.sku.toLowerCase().includes(q) ||
                    (row.sizeRange || '').toLowerCase().includes(q) ||
                    (row.barcode || '').toLowerCase().includes(q)
                );
            })
            : base;

        if (mode === 'all') return filtered; // сортировка серверная

        const dir = sortDir === 'asc' ? 1 : -1;
        return [...filtered].sort((a, b) => {
            switch (sortField) {
                case 'sku':
                    return a.sku.localeCompare(b.sku) * dir;
                case 'sizeRange':
                    return (a.sizeRange || '').localeCompare(b.sizeRange || '') * dir;
                case 'boxCount':
                    return (a.availableBoxes - b.availableBoxes) * dir;
                case 'pairCount':
                    return (a.availablePairs - b.availablePairs) * dir;
                case 'priceRub':
                    return (a.priceRub - b.priceRub) * dir;
                case 'recommendedSalePrice':
                    return (a.recommendedSalePrice - b.recommendedSalePrice) * dir;
                case 'total':
                    return (a.recommendedSalePrice * a.availablePairs - b.recommendedSalePrice * b.availablePairs) * dir;
                default:
                    return ((new Date(a.arrivedAt || 0).getTime()) - new Date(b.arrivedAt || 0).getTime()) * dir;
            }
        });
    }, [mode, dayRows, allRows, searchQuery, sortField, sortDir, hideSoldOut]);

    const selectedRows = useMemo(() => {
        const pool = mode === 'day' ? [...dayRows, ...remainderRows] : allRows;
        return pool.filter((row) => {
            const input = inputs[row.key];
            return input?.selected && input.pairCount > 0 && row.productId;
        });
    }, [mode, dayRows, remainderRows, allRows, inputs]);

    const totals = useMemo(() => {
        let pairs = 0, boxes = 0, amount = 0, cost = 0;
        for (const row of selectedRows) {
            const input = inputs[row.key];
            pairs += input.pairCount;
            boxes += input.boxCount;
            amount += input.price * input.pairCount;
            cost += row.priceRub * input.pairCount;
        }
        return {
            pairs,
            boxes,
            amount: Math.round(amount * 100) / 100,
            profit: Math.round((amount - cost) * 100) / 100,
        };
    }, [selectedRows, inputs]);

    /** Остаток к возврату: доступное минус то, что продаём */
    const returnRows = useMemo(() => {
        if (mode !== 'day') return [];
        return [...dayRows, ...remainderRows]
            .map((row) => {
                const input = inputs[row.key];
                const soldBoxes = input?.selected ? input.boxCount : 0;
                const soldPairs = input?.selected ? input.pairCount : 0;
                return {
                    row,
                    boxCount: Math.max(0, row.availableBoxes - soldBoxes),
                    pairCount: Math.max(0, row.availablePairs - soldPairs),
                };
            })
            .filter((r) => r.pairCount > 0 || r.boxCount > 0);
    }, [mode, dayRows, remainderRows, inputs]);

    const updateInput = (row: Row, patch: Partial<RowInput>) => {
        setInputs((prev) => {
            const current = prev[row.key];
            if (!current) return prev;
            const next = { ...current, ...patch };

            // Коробки заданы — пары пересчитываются пропорционально партии
            if (patch.boxCount !== undefined && row.availableBoxes > 0) {
                const boxes = Math.min(Math.max(0, patch.boxCount), row.availableBoxes);
                next.boxCount = boxes;
                next.pairCount = Math.round((row.availablePairs * boxes) / row.availableBoxes);
            }
            if (patch.pairCount !== undefined) {
                next.pairCount = Math.min(Math.max(0, patch.pairCount), row.availablePairs);
            }
            return { ...prev, [row.key]: next };
        });
    };

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDir(field === 'sku' || field === 'sizeRange' ? 'asc' : 'desc');
        }
    };

    /** Проданные позиции в выделение не попадают */
    const sellableRows = useMemo(
        () => visibleRows.filter((row) => row.availablePairs > 0 || row.availableBoxes > 0),
        [visibleRows],
    );

    const toggleAll = () => {
        const allSelected = sellableRows.length > 0 && sellableRows.every((row) => inputs[row.key]?.selected);
        setInputs((prev) => {
            const next = { ...prev };
            for (const row of sellableRows) {
                if (next[row.key]) next[row.key] = { ...next[row.key], selected: !allSelected };
            }
            return next;
        });
    };

    const openEdit = async (row: Row) => {
        try {
            setEditProduct(await productApi.getById(row.productId));
        } catch (err: any) {
            setError(err.response?.data?.message || 'Не удалось загрузить товар');
        }
    };

    const handleDelete = async () => {
        if (!deleteRow) return;
        setIsDeleting(true);
        try {
            await productApi.delete(deleteRow.productId);
            setDeleteRow(null);
            flashSuccess('Товар удалён');
            reload();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка удаления товара');
        } finally {
            setIsDeleting(false);
        }
    };

    const flashSuccess = (message: string) => {
        setSuccess(message);
        setTimeout(() => setSuccess(null), 3000);
    };

    const handleSubmitSale = async () => {
        if (!selectedShop || selectedRows.length === 0) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const sale = await saleApi.create({
                shopId: selectedShop.id,
                arrivalDate: mode === 'day' ? selectedDate : undefined,
                items: selectedRows.map((row) => ({
                    productId: row.productId,
                    arrivalId: row.arrivalId,
                    boxCount: inputs[row.key].boxCount,
                    pairCount: inputs[row.key].pairCount,
                    actualSalePrice: inputs[row.key].price,
                })),
            });
            setSaleCreated(sale.number);
            reload();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка оформления продажи');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitReturn = async () => {
        if (!selectedShop || returnRows.length === 0) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const result = await shopApi.createReturn(selectedShop.id, {
                arrivalDate: selectedDate,
                items: returnRows.map((r) => ({
                    arrivalId: r.row.arrivalId,
                    productId: r.row.productId,
                    boxCount: r.boxCount,
                    pairCount: r.pairCount,
                })),
            });
            setIsReturnOpen(false);
            flashSuccess(`Возврат ${result.number} оформлен: ${result.totalPairs} пар`);
            reload();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка оформления возврата');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-12">
                <motion.div
                    className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
            </div>
        );
    }

    if (shops.length === 0) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Магазин</h1>
                    <p className="text-muted-foreground">Продажа товаров</p>
                </div>
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                        <Store className="h-8 w-8 text-purple-500" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Нет магазинов</h3>
                    <p className="text-muted-foreground mb-4">
                        {isOrganizer
                            ? 'Создайте магазин в разделе «Склады» с типом «Магазин»'
                            : 'Организатор ещё не создал магазин для вашей точки'}
                    </p>
                    {isOrganizer && (
                        <Button onClick={() => router.push('/dashboard/warehouses')}>
                            <Store className="h-4 w-4 mr-2" />
                            Перейти к складам
                        </Button>
                    )}
                </Card>
            </div>
        );
    }

    const allSelected = sellableRows.length > 0 && sellableRows.every((row) => inputs[row.key]?.selected);

    return (
        <div className="space-y-4 pb-40">
            {/* Шапка */}
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">Магазин</h1>
                {selectedShop && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/dashboard/shop/sales?shopId=${selectedShop.id}`)}
                    >
                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                        История продаж
                    </Button>
                )}
            </div>

            {shops.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {shops.map((shop) => (
                        <button
                            key={shop.id}
                            onClick={() => setSelectedShop(shop)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${selectedShop?.id === shop.id
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent'
                                }`}
                        >
                            <Store className="h-3.5 w-3.5" />
                            {shop.name}
                            <span className="text-[10px] opacity-60">{getPointName(shop.pointId)}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Уведомления */}
            <AnimatePresence>
                {success && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="p-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
                        {success}
                    </motion.div>
                )}
                {error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex justify-between items-center gap-3">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="hover:opacity-70"><X className="h-4 w-4" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Переключатель дней */}
            <Card className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 flex-shrink-0"
                        disabled={mode !== 'day'}
                        onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <button
                        onClick={() => { setMode('day'); setIsDayListOpen((v) => !v); }}
                        className={`flex-1 min-w-0 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${mode === 'day'
                            ? 'bg-primary/10 border-primary/30 text-primary'
                            : 'bg-muted/50 border-transparent text-muted-foreground hover:bg-muted'
                            }`}
                    >
                        <span className="flex items-center justify-center gap-2">
                            <CalendarDays className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                                {selectedDate === todayLocal() ? 'Сегодня' : formatWeekday(selectedDate)}, {formatDate(selectedDate)}
                            </span>
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isDayListOpen ? 'rotate-180' : ''}`} />
                        </span>
                    </button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 flex-shrink-0"
                        disabled={mode !== 'day'}
                        onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>

                    <button
                        onClick={() => setMode('all')}
                        className={`px-3 py-2 rounded-xl border text-sm font-medium whitespace-nowrap transition-all ${mode === 'all'
                            ? 'bg-primary/10 border-primary/30 text-primary'
                            : 'bg-muted/50 border-transparent text-muted-foreground hover:bg-muted'
                            }`}
                    >
                        <span className="flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5" />
                            Все товары
                        </span>
                    </button>
                </div>

                {mode === 'day' && dayInfo && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground px-1">
                        <span>Пришло: <strong className="text-foreground">{dayInfo.boxCount} кор / {dayInfo.pairCount} пар</strong></span>
                        <span>Продано: <strong className="text-green-600 dark:text-green-400">{dayInfo.soldBoxes} кор / {dayInfo.soldPairs} пар</strong></span>
                        {(dayInfo.returnedPairs > 0 || dayInfo.returnedBoxes > 0) && (
                            <span>Возврат: <strong className="text-orange-500">{dayInfo.returnedBoxes} кор / {dayInfo.returnedPairs} пар</strong></span>
                        )}
                        <span>Остаток: <strong className="text-foreground">{dayInfo.remainderBoxes} кор / {dayInfo.remainderPairs} пар</strong></span>
                    </div>
                )}

                {/* Список дней */}
                <AnimatePresence>
                    {isDayListOpen && mode === 'day' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="max-h-64 overflow-y-auto space-y-1 pt-1">
                                {days.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-3">Поступлений пока нет</p>
                                )}
                                {days.map((day) => (
                                    <button
                                        key={day.date}
                                        onClick={() => { setSelectedDate(day.date); setIsDayListOpen(false); }}
                                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors ${day.date === selectedDate ? 'bg-primary/10 text-primary' : 'hover:bg-accent/50'
                                            }`}
                                    >
                                        <span className="font-medium whitespace-nowrap">
                                            {formatWeekday(day.date)}, {formatDate(day.date)}
                                        </span>
                                        <span className="text-muted-foreground truncate">
                                            {day.pairCount} пар · продано {day.soldPairs} · остаток {day.remainderPairs}
                                        </span>
                                        <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${day.status === 'DONE'
                                                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                                : day.status === 'PARTIAL'
                                                    ? 'bg-orange-500/10 text-orange-500'
                                                    : 'bg-muted text-muted-foreground'
                                                }`}
                                        >
                                            {day.status === 'DONE' ? 'закрыт' : day.status === 'PARTIAL' ? 'частично' : 'новый'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>

            {/* Поиск */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Поиск по артикулу, размеру, баркоду..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                </div>
                {soldOutCount > 0 && (
                    <button
                        onClick={() => setHideSoldOut((v) => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium whitespace-nowrap transition-all ${hideSoldOut
                            ? 'bg-muted/50 border-transparent text-muted-foreground hover:bg-muted'
                            : 'bg-primary/10 border-primary/30 text-primary'
                            }`}
                        title={hideSoldOut ? 'Показать проданные позиции' : 'Скрыть проданные позиции'}
                    >
                        {hideSoldOut ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        Проданные ({soldOutCount})
                    </button>
                )}
            </div>

            {/* Продажа оформлена */}
            {saleCreated && (
                <Card className="p-6 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                    </div>
                    <h2 className="text-lg font-bold mb-1">Продажа оформлена</h2>
                    <p className="text-muted-foreground text-sm mb-4">Номер: <strong>{saleCreated}</strong></p>
                    <Button size="sm" variant="outline" onClick={() => setSaleCreated(null)}>Продолжить</Button>
                </Card>
            )}

            {/* Таблица */}
            {isLoadingRows ? (
                <div className="flex justify-center p-10">
                    <motion.div
                        className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                </div>
            ) : visibleRows.length === 0 ? (
                <Card className="p-10 text-center">
                    <div className="mx-auto w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
                        <Package className="h-7 w-7 text-purple-500" />
                    </div>
                    <h3 className="font-semibold mb-1">
                        {soldOutCount > 0
                            ? 'Всё продано'
                            : mode === 'day' ? 'В этот день поступлений не было' : 'Нет товаров'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {soldOutCount > 0
                            ? `Все позиции (${soldOutCount}) уже проданы`
                            : mode === 'day'
                                ? 'Выберите другой день или откройте «Все товары»'
                                : 'В магазине пока нет товаров для продажи'}
                    </p>
                    {soldOutCount > 0 && hideSoldOut && (
                        <Button size="sm" variant="outline" className="mt-4" onClick={() => setHideSoldOut(false)}>
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            Показать проданные
                        </Button>
                    )}
                </Card>
            ) : (
                <ProductTable
                    rows={visibleRows}
                    inputs={inputs}
                    isOrganizer={isOrganizer}
                    allSelected={allSelected}
                    sortField={sortField}
                    sortDir={sortDir}
                    onToggleSort={toggleSort}
                    onToggleAll={toggleAll}
                    onUpdate={updateInput}
                    onEdit={openEdit}
                    onDelete={setDeleteRow}
                    onHistory={setHistoryProductId}
                    onPhoto={setViewerImage}
                    canEdit={canEditProducts}
                    canDelete={canDeleteProducts}
                    showArrivedAt={mode === 'all'}
                />
            )}

            {/* Остаток прошлых дней */}
            {mode === 'day' && remainderRows.length > 0 && (
                <Card className="p-3">
                    <button
                        onClick={() => setShowRemainders((v) => !v)}
                        className="w-full flex items-center justify-between text-sm font-medium"
                    >
                        <span className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-orange-500" />
                            Остаток прошлых дней
                            <span className="text-xs text-muted-foreground">
                                ({remainderRows.length} поз. · {remainderRows.reduce((s, r) => s + r.availablePairs, 0)} пар)
                            </span>
                        </span>
                        {showRemainders ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    <AnimatePresence>
                        {showRemainders && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="pt-3">
                                    <ProductTable
                                        rows={remainderRows}
                                        inputs={inputs}
                                        isOrganizer={isOrganizer}
                                        allSelected={remainderRows.every((r) => inputs[r.key]?.selected)}
                                        sortField={sortField}
                                        sortDir={sortDir}
                                        onToggleSort={toggleSort}
                                        onToggleAll={() => {
                                            const all = remainderRows.every((r) => inputs[r.key]?.selected);
                                            setInputs((prev) => {
                                                const next = { ...prev };
                                                for (const row of remainderRows) {
                                                    if (next[row.key]) next[row.key] = { ...next[row.key], selected: !all };
                                                }
                                                return next;
                                            });
                                        }}
                                        onUpdate={updateInput}
                                        onEdit={openEdit}
                                        onDelete={setDeleteRow}
                                        onHistory={setHistoryProductId}
                                        onPhoto={setViewerImage}
                                        canEdit={canEditProducts}
                                        canDelete={canDeleteProducts}
                                        showArrivedAt
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>
            )}

            {/* Подвал с итогами */}
            <div className="fixed bottom-[76px] left-0 right-0 z-40 px-4 sm:px-6 pointer-events-none">
                <div className="mx-auto max-w-5xl pointer-events-auto">
                    <Card className="p-3 shadow-2xl border-border">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                <span className="text-muted-foreground">
                                    Выбрано: <strong className="text-foreground">{selectedRows.length}</strong> поз. ·{' '}
                                    <strong className="text-foreground">{totals.boxes}</strong> кор ·{' '}
                                    <strong className="text-foreground">{totals.pairs}</strong> пар
                                </span>
                                <span className="font-semibold">
                                    Итого: <span className="text-primary">{money(totals.amount)} ₽</span>
                                </span>
                                {isOrganizer && totals.pairs > 0 && (
                                    <span className="font-semibold">
                                        Прибыль:{' '}
                                        <span className={totals.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}>
                                            {totals.profit >= 0 ? '+' : ''}{money(totals.profit)} ₽
                                        </span>
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {mode === 'day' && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={returnRows.length === 0}
                                        onClick={() => setIsReturnOpen(true)}
                                    >
                                        <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                                        Возврат остатка
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    disabled={selectedRows.length === 0}
                                    isLoading={isSubmitting && !isReturnOpen}
                                    onClick={handleSubmitSale}
                                >
                                    <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                                    {mode === 'day' ? `Продажа за ${formatDate(selectedDate)}` : 'Оформить продажу'}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Подтверждение удаления */}
            <AnimatePresence>
                {deleteRow && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setDeleteRow(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-sm bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 p-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-full bg-destructive/10">
                                    <Trash2 className="h-5 w-5 text-destructive" />
                                </div>
                                <h3 className="text-lg font-semibold">Удалить {deleteRow.sku}?</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                Товар будет помечен как удалённый. Его можно восстановить через историю.
                            </p>
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setDeleteRow(null)}>
                                    Отмена
                                </Button>
                                <Button variant="destructive" className="flex-1" isLoading={isDeleting} onClick={handleDelete}>
                                    Удалить
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Подтверждение возврата */}
            <AnimatePresence>
                {isReturnOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setIsReturnOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-md bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-5 border-b border-border/50 flex items-center justify-between">
                                <h3 className="text-lg font-semibold">Возврат остатка</h3>
                                <button onClick={() => setIsReturnOpen(false)}>
                                    <X className="h-5 w-5 text-muted-foreground" />
                                </button>
                            </div>
                            <div className="p-5 space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Непроданный остаток за {formatDate(selectedDate)} будет списан из магазина.
                                    Чтобы вернуть меньше — сначала отметьте товары к продаже в таблице.
                                </p>
                                <div className="max-h-56 overflow-y-auto space-y-1">
                                    {returnRows.map((r) => (
                                        <div key={r.row.key} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                                            <span className="font-medium truncate">{r.row.sku}</span>
                                            <span className="text-muted-foreground whitespace-nowrap ml-2">
                                                {r.boxCount} кор / {r.pairCount} пар
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between text-sm font-semibold pt-1">
                                    <span>Всего к возврату</span>
                                    <span>
                                        {returnRows.reduce((s, r) => s + r.boxCount, 0)} кор /{' '}
                                        {returnRows.reduce((s, r) => s + r.pairCount, 0)} пар
                                    </span>
                                </div>
                            </div>
                            <div className="p-5 border-t border-border/50 flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setIsReturnOpen(false)}>
                                    Отмена
                                </Button>
                                <Button className="flex-1" isLoading={isSubmitting} onClick={handleSubmitReturn}>
                                    Оформить возврат
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ProductEditModal
                product={editProduct}
                onClose={() => setEditProduct(null)}
                onSaved={() => { setEditProduct(null); flashSuccess('Товар обновлён'); reload(); }}
            />

            <AuditHistoryModal
                isOpen={!!historyProductId}
                onClose={() => setHistoryProductId(null)}
                entityType="PRODUCT"
                entityId={historyProductId || ''}
                title="История товара"
            />

            <AnimatePresence>
                {viewerImage && <ImageViewer src={viewerImage} alt="" onClose={() => setViewerImage(null)} />}
            </AnimatePresence>
        </div>
    );
}

// ==================== ТАБЛИЦА ТОВАРОВ ====================

interface ProductTableProps {
    rows: Row[];
    inputs: Record<string, RowInput>;
    isOrganizer: boolean;
    allSelected: boolean;
    sortField: SortField;
    sortDir: 'asc' | 'desc';
    onToggleSort: (field: SortField) => void;
    onToggleAll: () => void;
    onUpdate: (row: Row, patch: Partial<RowInput>) => void;
    onEdit: (row: Row) => void;
    onDelete: (row: Row) => void;
    onHistory: (productId: string) => void;
    onPhoto: (url: string) => void;
    canEdit: boolean;
    canDelete: boolean;
    showArrivedAt?: boolean;
}

function ProductTable({
    rows,
    inputs,
    isOrganizer,
    allSelected,
    sortField,
    sortDir,
    onToggleSort,
    onToggleAll,
    onUpdate,
    onEdit,
    onDelete,
    onHistory,
    onPhoto,
    canEdit,
    canDelete,
    showArrivedAt,
}: ProductTableProps) {
    const SortHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
        <th className={`px-2 py-2 font-medium ${className || ''}`}>
            <button onClick={() => onToggleSort(field)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                {label}
                {sortField === field && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            </button>
        </th>
    );

    return (
        <Card className="overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead className="text-xs text-muted-foreground border-b border-border/50 bg-muted/30">
                        <tr>
                            <th className="px-2 py-2 w-8">
                                <button onClick={onToggleAll} className="flex items-center">
                                    {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                                </button>
                            </th>
                            <th className="px-2 py-2 w-12" />
                            <SortHeader field="sku" label="Артикул" className="text-left" />
                            <SortHeader field="sizeRange" label="Размер" className="text-left hidden md:table-cell" />
                            {showArrivedAt && <SortHeader field="arrivedAt" label="Приход" className="text-left hidden lg:table-cell" />}
                            <SortHeader field="boxCount" label="Кор" className="text-right" />
                            <SortHeader field="pairCount" label="Пар" className="text-right" />
                            {isOrganizer && <SortHeader field="priceRub" label="Себест. ₽" className="text-right hidden lg:table-cell" />}
                            <SortHeader field="recommendedSalePrice" label="Рек. ₽" className="text-right hidden sm:table-cell" />
                            <th className="px-2 py-2 font-medium text-right text-primary">Факт. цена ₽</th>
                            <SortHeader field="total" label="Сумма" className="text-right" />
                            <th className="px-2 py-2 w-24" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const input = inputs[row.key];
                            if (!input) return null;
                            const rowTotal = input.price * input.pairCount;
                            const soldOut = row.availablePairs === 0 && row.availableBoxes === 0;

                            return (
                                <tr
                                    key={row.key}
                                    className={`border-b border-border/30 last:border-0 transition-colors ${soldOut
                                        ? 'opacity-60'
                                        : input.selected ? 'bg-primary/5' : 'hover:bg-accent/30'
                                        }`}
                                >
                                    <td className="px-2 py-1.5">
                                        {soldOut ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <button onClick={() => onUpdate(row, { selected: !input.selected })}>
                                                {input.selected
                                                    ? <CheckSquare className="h-4 w-4 text-primary" />
                                                    : <Square className="h-4 w-4 text-muted-foreground" />}
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5">
                                        {row.photo ? (
                                            <img
                                                src={`${API_URL}${row.photo}`}
                                                alt=""
                                                onClick={() => onPhoto(`${API_URL}${row.photo}`)}
                                                className="w-9 h-9 rounded-lg object-cover cursor-pointer"
                                            />
                                        ) : (
                                            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                                        {row.sku}
                                        <span className="block md:hidden text-[10px] text-muted-foreground">{row.sizeRange}</span>
                                    </td>
                                    <td className="px-2 py-1.5 text-muted-foreground hidden md:table-cell">{row.sizeRange || '—'}</td>
                                    {showArrivedAt && (
                                        <td className="px-2 py-1.5 text-muted-foreground text-xs hidden lg:table-cell whitespace-nowrap">
                                            {row.arrivedAt ? new Date(row.arrivedAt).toLocaleDateString('ru-RU') : '—'}
                                        </td>
                                    )}
                                    <td className="px-2 py-1.5 text-right">
                                        {soldOut ? (
                                            <>
                                                <span className="text-muted-foreground">{row.arrivedBoxes}</span>
                                                <span className="block text-[10px] text-green-600 dark:text-green-400">продано</span>
                                            </>
                                        ) : (
                                            <>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={input.boxCount || ''}
                                                    onChange={(e) => onUpdate(row, { boxCount: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })}
                                                    className="w-14 rounded-lg border border-border/50 bg-card/80 px-1.5 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                />
                                                <span className="block text-[10px] text-muted-foreground">
                                                    из {row.availableBoxes}{row.soldBoxes > 0 ? ` · пришло ${row.arrivedBoxes}` : ''}
                                                </span>
                                            </>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 text-right">
                                        {soldOut ? (
                                            <>
                                                <span className="text-muted-foreground">{row.arrivedPairs}</span>
                                                <span className="block text-[10px] text-green-600 dark:text-green-400">продано</span>
                                            </>
                                        ) : (
                                            <>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={input.pairCount || ''}
                                                    onChange={(e) => onUpdate(row, { pairCount: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })}
                                                    className="w-16 rounded-lg border border-border/50 bg-card/80 px-1.5 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                />
                                                <span className="block text-[10px] text-muted-foreground">
                                                    из {row.availablePairs}{row.soldPairs > 0 ? ` · пришло ${row.arrivedPairs}` : ''}
                                                </span>
                                            </>
                                        )}
                                    </td>
                                    {isOrganizer && (
                                        <td className="px-2 py-1.5 text-right text-muted-foreground hidden lg:table-cell">
                                            {money(row.priceRub)}
                                        </td>
                                    )}
                                    <td className="px-2 py-1.5 text-right text-muted-foreground hidden sm:table-cell">
                                        {money(row.recommendedSalePrice)}
                                    </td>
                                    <td className="px-2 py-1.5 text-right">
                                        {soldOut ? (
                                            <span className="text-muted-foreground">—</span>
                                        ) : (
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={input.price || ''}
                                                onChange={(e) => onUpdate(row, { price: Number(e.target.value.replace(/[^0-9.]/g, '')) || 0 })}
                                                className="w-20 rounded-lg border-2 border-primary/30 bg-primary/5 px-1.5 py-1 text-right text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                                            />
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">
                                        {soldOut ? <span className="text-muted-foreground font-normal">—</span> : `${money(rowTotal)} ₽`}
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <div className="flex justify-end gap-0.5">
                                            <button
                                                onClick={() => onHistory(row.productId)}
                                                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
                                                title="История"
                                            >
                                                <History className="h-3.5 w-3.5" />
                                            </button>
                                            {canEdit && (
                                                <button
                                                    onClick={() => onEdit(row)}
                                                    className="p-1.5 rounded hover:bg-accent transition-colors"
                                                    title="Редактировать"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => onDelete(row)}
                                                    className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
                                                    title="Удалить"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

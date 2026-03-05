'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    PackagePlus,
    Clock,
    User,
    Package,
    Inbox,
    Search,
    ChevronDown,
    ChevronUp,
    ImageIcon,
    MapPin,
} from 'lucide-react';
import { Button, Card, ImageViewer } from '@/components/ui';
import { auditApi, AuditLogResponse } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface ReceiptBatch {
    key: string;
    logs: AuditLogResponse[];
    date: string;
    userName: string;
    metadata: Record<string, any> | null | undefined;
}

export default function ReceiptHistoryPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();

    const [logs, setLogs] = useState<AuditLogResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

    // Image viewer
    const [viewerImage, setViewerImage] = useState<string | null>(null);
    const [viewerAlt, setViewerAlt] = useState('');

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push('/login');
    }, [isAuthenticated, authLoading, router]);

    useEffect(() => {
        if (isAuthenticated && user?.accountId) {
            loadLogs(1);
        }
    }, [isAuthenticated, user?.accountId]);

    const loadLogs = async (p: number) => {
        if (!user?.accountId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await auditApi.getByAccount(user.accountId, {
                page: p,
                limit: 200,
                action: 'PRODUCT_BATCH_CREATED',
            });
            setLogs(data.items);
            setTotalPages(data.totalPages);
            setPage(p);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Ошибка загрузки истории приходов');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Group logs by batch (same user + close timestamps within 10 seconds)
    const groupByBatch = (items: AuditLogResponse[]): ReceiptBatch[] => {
        const groups: ReceiptBatch[] = [];

        for (const log of items) {
            const logTime = new Date(log.createdAt).getTime();
            const existing = groups.find(g => {
                const gTime = new Date(g.date).getTime();
                return g.userName === (log.userName || '') && Math.abs(gTime - logTime) < 10000;
            });

            if (existing) {
                existing.logs.push(log);
            } else {
                groups.push({
                    key: log.id,
                    logs: [log],
                    date: log.createdAt,
                    userName: log.userName || 'Неизвестный',
                    metadata: log.metadata,
                });
            }
        }

        return groups;
    };

    const batches = groupByBatch(logs);
    const filteredBatches = searchQuery.trim()
        ? batches.filter(b =>
            b.logs.some(l => {
                const nd = l.newData || {};
                return Object.values(nd).some(v =>
                    String(v).toLowerCase().includes(searchQuery.toLowerCase())
                );
            }) || b.userName.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : batches;

    const getBatchTotals = (batch: ReceiptBatch) => {
        let totalBoxes = 0, totalPairs = 0, totalYuan = 0, totalRub = 0, totalRec = 0;
        for (const log of batch.logs) {
            const d = log.newData || {};
            totalBoxes += Number(d.boxCount || 0);
            totalPairs += Number(d.pairCount || 0);
            totalYuan += Number(d.totalYuan || 0);
            totalRub += Number(d.totalRub || 0);
            totalRec += Number(d.totalRecommendedSale || 0);
        }
        return { totalBoxes, totalPairs, totalYuan, totalRub, totalRec };
    };

    if (authLoading || !isAuthenticated) {
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

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <PackagePlus className="h-5 w-5 text-emerald-500" />
                        <h1 className="text-2xl font-bold">История приходов</h1>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Все оформленные приходы товаров с детализацией
                    </p>
                </div>
            </div>

            {/* Search */}
            <Card className="p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Поиск по артикулу, пользователю..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    />
                </div>
            </Card>

            {/* Error */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm"
                    >
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Loading */}
            {loading && (
                <div className="flex justify-center p-12">
                    <motion.div
                        className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                </div>
            )}

            {/* Empty */}
            {!loading && filteredBatches.length === 0 && (
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Inbox className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                        {searchQuery ? 'Ничего не найдено' : 'Нет приходов'}
                    </h3>
                    <p className="text-muted-foreground">
                        {searchQuery ? 'Попробуйте изменить запрос' : 'Оформите первый приход через страницу «Приход»'}
                    </p>
                </Card>
            )}

            {/* Receipt Batches */}
            {!loading && filteredBatches.length > 0 && (
                <div className="space-y-3">
                    {filteredBatches.map((batch, index) => {
                        const totals = getBatchTotals(batch);
                        const isExpanded = expandedBatch === batch.key;

                        return (
                            <motion.div
                                key={batch.key}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                            >
                                <Card className="overflow-hidden">
                                    {/* Batch Header — clickable */}
                                    <button
                                        className="w-full p-4 text-left hover:bg-muted/30 transition-colors"
                                        onClick={() => setExpandedBatch(isExpanded ? null : batch.key)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 rounded-xl bg-emerald-500/10 flex-shrink-0 mt-0.5">
                                                <PackagePlus className="h-5 w-5 text-emerald-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <h3 className="font-semibold text-sm">
                                                        Приход: {batch.logs.length} позиций
                                                    </h3>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {formatDate(batch.date)}
                                                        </span>
                                                        {isExpanded ? (
                                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-3 mb-2">
                                                    <span className="flex items-center gap-1">
                                                        <User className="h-3 w-3" />
                                                        {batch.userName}
                                                    </span>
                                                    {batch.metadata?.pointName && (
                                                        <span className="flex items-center gap-1 text-blue-500">
                                                            <MapPin className="h-3 w-3" />
                                                            {batch.metadata.pointName}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Summary stats */}
                                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-[11px]">
                                                    <div className="text-center px-2 py-1 rounded-lg bg-muted/50">
                                                        <span className="text-muted-foreground block">Коробок</span>
                                                        <span className="font-bold">{totals.totalBoxes}</span>
                                                    </div>
                                                    <div className="text-center px-2 py-1 rounded-lg bg-muted/50">
                                                        <span className="text-muted-foreground block">Пар</span>
                                                        <span className="font-bold">{totals.totalPairs}</span>
                                                    </div>
                                                    <div className="text-center px-2 py-1 rounded-lg bg-blue-500/5">
                                                        <span className="text-muted-foreground block">Сумма ¥</span>
                                                        <span className="font-bold text-blue-600 dark:text-blue-400">{totals.totalYuan.toLocaleString()}</span>
                                                    </div>
                                                    <div className="text-center px-2 py-1 rounded-lg bg-green-500/5 hidden sm:block">
                                                        <span className="text-muted-foreground block">Сумма ₽</span>
                                                        <span className="font-bold text-green-600 dark:text-green-400">{totals.totalRub.toLocaleString()}</span>
                                                    </div>
                                                    <div className="text-center px-2 py-1 rounded-lg bg-orange-500/5 hidden sm:block">
                                                        <span className="text-muted-foreground block">Рек. продажа</span>
                                                        <span className="font-bold text-orange-600 dark:text-orange-400">{totals.totalRec.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Expanded detail — product list */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="border-t border-border/50 px-4 pb-4">
                                                    {/* Table head */}
                                                    <div className="grid grid-cols-[auto_1fr_repeat(8,minmax(0,1fr))] gap-2 py-2 text-[10px] text-muted-foreground font-medium border-b border-border/30 mb-1">
                                                        <span className="w-10" />
                                                        <span>Артикул / Размеры</span>
                                                        <span className="text-center">Кор</span>
                                                        <span className="text-center">Пар</span>
                                                        <span className="text-center">¥/шт</span>
                                                        <span className="text-center">₽/шт</span>
                                                        <span className="text-center">Итого ¥</span>
                                                        <span className="text-center">Итого ₽</span>
                                                        <span className="text-center">Рек. цена</span>
                                                        <span className="text-center">Итого рек.</span>
                                                    </div>

                                                    {batch.logs.map((log, li) => {
                                                        const d = log.newData || {};
                                                        const photoOrigUrl = d.photoOriginal ? `${API_URL}${d.photoOriginal}` : null;
                                                        const photoUrl = d.photo ? `${API_URL}${d.photo}` : null;
                                                        const displayPhoto = photoOrigUrl || photoUrl;

                                                        return (
                                                            <motion.div
                                                                key={log.id}
                                                                initial={{ opacity: 0, x: -5 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: li * 0.02 }}
                                                                className="grid grid-cols-[auto_1fr_repeat(8,minmax(0,1fr))] gap-2 py-2 items-center text-xs border-b border-border/20 last:border-0"
                                                            >
                                                                {/* Photo */}
                                                                <div className="w-10 h-10 flex-shrink-0">
                                                                    {displayPhoto ? (
                                                                        <div
                                                                            className="w-10 h-10 rounded-lg overflow-hidden border border-border cursor-pointer group relative"
                                                                            onClick={() => { setViewerImage(displayPhoto); setViewerAlt(d.sku || ''); }}
                                                                        >
                                                                            <img
                                                                                src={displayPhoto}
                                                                                alt={d.sku || ''}
                                                                                className="w-full h-full object-cover"
                                                                            />
                                                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                                                                <Search className="h-3 w-3 text-white" />
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                                                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* SKU + Size */}
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold text-xs truncate">{d.sku || '—'}</p>
                                                                    {d.sizeRange && (
                                                                        <p className="text-[10px] text-muted-foreground truncate">{d.sizeRange}</p>
                                                                    )}
                                                                    {d.barcode && (
                                                                        <p className="text-[9px] text-muted-foreground truncate">{d.barcode}</p>
                                                                    )}
                                                                </div>

                                                                {/* Boxes */}
                                                                <span className="text-center font-medium">{d.boxCount ?? '—'}</span>

                                                                {/* Pairs */}
                                                                <span className="text-center font-medium">{d.pairCount ?? '—'}</span>

                                                                {/* Price Yuan */}
                                                                <span className="text-center text-blue-600 dark:text-blue-400">
                                                                    {d.priceYuan != null ? Number(d.priceYuan).toLocaleString() : '—'}
                                                                </span>

                                                                {/* Price Rub */}
                                                                <span className="text-center text-green-600 dark:text-green-400">
                                                                    {d.priceRub != null ? Number(d.priceRub).toLocaleString() : '—'}
                                                                </span>

                                                                {/* Total Yuan */}
                                                                <span className="text-center font-bold text-blue-600 dark:text-blue-400">
                                                                    {d.totalYuan != null ? Number(d.totalYuan).toLocaleString() : '—'}
                                                                </span>

                                                                {/* Total Rub */}
                                                                <span className="text-center font-bold text-green-600 dark:text-green-400">
                                                                    {d.totalRub != null ? Number(d.totalRub).toLocaleString() : '—'}
                                                                </span>

                                                                {/* Recommended Sale Price */}
                                                                <span className="text-center text-orange-600 dark:text-orange-400">
                                                                    {d.recommendedSalePrice != null ? Number(d.recommendedSalePrice).toLocaleString() : '—'}
                                                                </span>

                                                                {/* Total Recommended */}
                                                                <span className="text-center font-bold text-orange-600 dark:text-orange-400">
                                                                    {d.totalRecommendedSale != null ? Number(d.totalRecommendedSale).toLocaleString() : '—'}
                                                                </span>
                                                            </motion.div>
                                                        );
                                                    })}

                                                    {/* Batch total footer */}
                                                    <div className="grid grid-cols-[auto_1fr_repeat(8,minmax(0,1fr))] gap-2 py-2 text-xs font-bold border-t border-border/50 mt-1">
                                                        <span className="w-10" />
                                                        <span>Итого:</span>
                                                        <span className="text-center">{totals.totalBoxes}</span>
                                                        <span className="text-center">{totals.totalPairs}</span>
                                                        <span className="text-center" />
                                                        <span className="text-center" />
                                                        <span className="text-center text-blue-600 dark:text-blue-400">¥{totals.totalYuan.toLocaleString()}</span>
                                                        <span className="text-center text-green-600 dark:text-green-400">₽{totals.totalRub.toLocaleString()}</span>
                                                        <span className="text-center" />
                                                        <span className="text-center text-orange-600 dark:text-orange-400">₽{totals.totalRec.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => loadLogs(page - 1)}
                    >
                        Назад
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        {page} / {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => loadLogs(page + 1)}
                    >
                        Далее
                    </Button>
                </div>
            )}

            {/* Image Viewer */}
            <AnimatePresence>
                {viewerImage && (
                    <ImageViewer src={viewerImage} alt={viewerAlt} onClose={() => setViewerImage(null)} />
                )}
            </AnimatePresence>
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    PackagePlus,
    Pencil,
    Trash2,
    RotateCcw,
    Clock,
    User,
    Search,
    Inbox,
    ChevronDown,
    ChevronUp,
    ImageIcon,
    MapPin,
} from 'lucide-react';
import { Button, Card, ImageViewer } from '@/components/ui';
import { auditApi, AuditLogResponse } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const actionConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
    PRODUCT_BATCH_CREATED: { label: 'Приход', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10', icon: PackagePlus },
    PRODUCT_CREATED: { label: 'Создание', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/10', icon: PackagePlus },
    PRODUCT_UPDATED: { label: 'Изменение', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10', icon: Pencil },
    PRODUCT_DELETED: { label: 'Удаление', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10', icon: Trash2 },
    PRODUCT_RESTORED: { label: 'Восстановление', color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-500/10', icon: RotateCcw },
};

const actionFilters = [
    { id: '', label: 'Все' },
    { id: 'PRODUCT_BATCH_CREATED', label: 'Приходы' },
    { id: 'PRODUCT_UPDATED', label: 'Изменения' },
    { id: 'PRODUCT_DELETED', label: 'Удаления' },
    { id: 'PRODUCT_RESTORED', label: 'Восстановления' },
];

export default function ProductHistoryPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();

    const [logs, setLogs] = useState<AuditLogResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    // Image viewer
    const [viewerImage, setViewerImage] = useState<string | null>(null);
    const [viewerAlt, setViewerAlt] = useState('');

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push('/login');
    }, [isAuthenticated, authLoading, router]);

    useEffect(() => {
        if (isAuthenticated && user?.accountId) {
            loadLogs(1, actionFilter);
        }
    }, [isAuthenticated, user?.accountId, actionFilter]);

    const loadLogs = async (p: number, action?: string) => {
        if (!user?.accountId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await auditApi.getByAccount(user.accountId, {
                page: p,
                limit: 50,
                entityType: 'PRODUCT',
                action: action || undefined,
            });
            setLogs(data.items);
            setTotalPages(data.totalPages);
            setPage(p);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Ошибка загрузки истории');
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

    const filteredLogs = searchQuery.trim()
        ? logs.filter(log => {
            const nd = log.newData || {};
            const od = log.oldData || {};
            const search = searchQuery.toLowerCase();
            return (
                String(nd.sku || '').toLowerCase().includes(search) ||
                String(od.sku || '').toLowerCase().includes(search) ||
                (log.userName || '').toLowerCase().includes(search)
            );
        })
        : logs;

    const getDisplayData = (log: AuditLogResponse) => {
        const d = log.action === 'PRODUCT_DELETED' ? log.oldData : log.newData;
        return d || {};
    };

    const getPhotoUrl = (log: AuditLogResponse) => {
        const d = getDisplayData(log);
        const photoOrig = d.photoOriginal ? `${API_URL}${d.photoOriginal}` : null;
        const photo = d.photo ? `${API_URL}${d.photo}` : null;
        return photoOrig || photo;
    };

    const renderChanges = (log: AuditLogResponse) => {
        if (log.action !== 'PRODUCT_UPDATED') return null;
        const oldD = log.oldData || {};
        const newD = log.newData || {};
        const fieldLabels: Record<string, string> = {
            sku: 'Артикул',
            boxCount: 'Коробок',
            pairCount: 'Пар',
            priceYuan: 'Цена ¥',
            priceRub: 'Цена ₽',
            totalYuan: 'Сумма ¥',
            totalRub: 'Сумма ₽',
            recommendedSalePrice: 'Рек. цена',
            totalRecommendedSale: 'Итого рек.',
            sizeRange: 'Размерный ряд',
            barcode: 'Баркод',
            isActive: 'Активен',
            photo: 'Фото',
            photoOriginal: 'Фото оригинал',
        };

        return (
            <div className="mt-2 space-y-1">
                {Object.keys(newD).map(key => {
                    const label = fieldLabels[key] || key;
                    return (
                        <div key={key} className="flex items-center gap-2 text-[11px]">
                            <span className="text-muted-foreground w-24 flex-shrink-0">{label}:</span>
                            <span className="line-through text-red-500/70">{String(oldD[key] ?? '—')}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-green-600 dark:text-green-400 font-medium">{String(newD[key] ?? '—')}</span>
                        </div>
                    );
                })}
            </div>
        );
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
                        <Clock className="h-5 w-5 text-primary" />
                        <h1 className="text-2xl font-bold">История изменений товаров</h1>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Все создания, изменения, удаления и восстановления товаров
                    </p>
                </div>
            </div>

            {/* Filters */}
            <Card className="p-4 space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Поиск по артикулу, пользователю..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    />
                </div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    {actionFilters.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setActionFilter(f.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${actionFilter === f.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
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
            {!loading && filteredLogs.length === 0 && (
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Inbox className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                        {searchQuery || actionFilter ? 'Ничего не найдено' : 'Нет истории'}
                    </h3>
                    <p className="text-muted-foreground">
                        {searchQuery || actionFilter ? 'Попробуйте изменить фильтры' : 'История изменений товаров пока пуста'}
                    </p>
                </Card>
            )}

            {/* Logs */}
            {!loading && filteredLogs.length > 0 && (
                <div className="space-y-2">
                    {filteredLogs.map((log, index) => {
                        const config = actionConfig[log.action] || actionConfig['PRODUCT_CREATED'];
                        const Icon = config.icon;
                        const d = getDisplayData(log);
                        const photoUrl = getPhotoUrl(log);
                        const isExpanded = expandedLog === log.id;

                        return (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.02 }}
                            >
                                <Card className="overflow-hidden">
                                    <button
                                        className="w-full p-3 text-left hover:bg-muted/30 transition-colors"
                                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Photo */}
                                            <div className="w-10 h-10 flex-shrink-0">
                                                {photoUrl ? (
                                                    <div
                                                        className="w-10 h-10 rounded-lg overflow-hidden border border-border cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setViewerImage(photoUrl);
                                                            setViewerAlt(d.sku || '');
                                                        }}
                                                    >
                                                        <img src={photoUrl} alt={d.sku || ''} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${config.bgColor} ${config.color}`}>
                                                        <Icon className="h-3 w-3" />
                                                        {config.label}
                                                    </span>
                                                    <span className="font-semibold text-xs truncate">{d.sku || '—'}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                                    <span className="flex items-center gap-0.5">
                                                        <Clock className="h-2.5 w-2.5" />
                                                        {formatDate(log.createdAt)}
                                                    </span>
                                                    <span className="flex items-center gap-0.5">
                                                        <User className="h-2.5 w-2.5" />
                                                        {log.userName || 'Неизвестный'}
                                                    </span>
                                                    {log.metadata?.pointName && (
                                                        <span className="flex items-center gap-0.5 text-blue-500">
                                                            <MapPin className="h-2.5 w-2.5" />
                                                            {log.metadata.pointName}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Summary & Expand */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {log.action !== 'PRODUCT_UPDATED' && d.pairCount != null && (
                                                    <div className="text-right text-[10px] hidden sm:block">
                                                        <div className="text-muted-foreground">{d.pairCount} пар</div>
                                                        {d.totalRub != null && (
                                                            <div className="font-medium text-green-600 dark:text-green-400">₽{Number(d.totalRub).toLocaleString()}</div>
                                                        )}
                                                    </div>
                                                )}
                                                {isExpanded ? (
                                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </div>
                                        </div>
                                    </button>

                                    {/* Expanded detail */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="border-t border-border/50 px-4 py-3 text-xs space-y-2">
                                                    {log.action === 'PRODUCT_UPDATED' ? (
                                                        renderChanges(log)
                                                    ) : (
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                            {d.boxCount != null && (
                                                                <div className="text-center p-2 rounded-lg bg-muted/50">
                                                                    <span className="text-muted-foreground block text-[10px]">Коробок</span>
                                                                    <span className="font-bold">{d.boxCount}</span>
                                                                </div>
                                                            )}
                                                            {d.pairCount != null && (
                                                                <div className="text-center p-2 rounded-lg bg-muted/50">
                                                                    <span className="text-muted-foreground block text-[10px]">Пар</span>
                                                                    <span className="font-bold">{d.pairCount}</span>
                                                                </div>
                                                            )}
                                                            {d.priceYuan != null && (
                                                                <div className="text-center p-2 rounded-lg bg-blue-500/5">
                                                                    <span className="text-muted-foreground block text-[10px]">Цена ¥</span>
                                                                    <span className="font-bold text-blue-600 dark:text-blue-400">{Number(d.priceYuan).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            {d.priceRub != null && (
                                                                <div className="text-center p-2 rounded-lg bg-green-500/5">
                                                                    <span className="text-muted-foreground block text-[10px]">Цена ₽</span>
                                                                    <span className="font-bold text-green-600 dark:text-green-400">{Number(d.priceRub).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            {d.totalYuan != null && (
                                                                <div className="text-center p-2 rounded-lg bg-blue-500/5">
                                                                    <span className="text-muted-foreground block text-[10px]">Сумма ¥</span>
                                                                    <span className="font-bold text-blue-600 dark:text-blue-400">{Number(d.totalYuan).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            {d.totalRub != null && (
                                                                <div className="text-center p-2 rounded-lg bg-green-500/5">
                                                                    <span className="text-muted-foreground block text-[10px]">Сумма ₽</span>
                                                                    <span className="font-bold text-green-600 dark:text-green-400">{Number(d.totalRub).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            {d.recommendedSalePrice != null && Number(d.recommendedSalePrice) > 0 && (
                                                                <div className="text-center p-2 rounded-lg bg-orange-500/5">
                                                                    <span className="text-muted-foreground block text-[10px]">Рек. цена</span>
                                                                    <span className="font-bold text-orange-600 dark:text-orange-400">{Number(d.recommendedSalePrice).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            {d.totalRecommendedSale != null && Number(d.totalRecommendedSale) > 0 && (
                                                                <div className="text-center p-2 rounded-lg bg-orange-500/5">
                                                                    <span className="text-muted-foreground block text-[10px]">Итого рек.</span>
                                                                    <span className="font-bold text-orange-600 dark:text-orange-400">{Number(d.totalRecommendedSale).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            {d.sizeRange && (
                                                                <div className="text-center p-2 rounded-lg bg-muted/50">
                                                                    <span className="text-muted-foreground block text-[10px]">Размеры</span>
                                                                    <span className="font-bold">{d.sizeRange}</span>
                                                                </div>
                                                            )}
                                                            {d.barcode && (
                                                                <div className="text-center p-2 rounded-lg bg-muted/50">
                                                                    <span className="text-muted-foreground block text-[10px]">Баркод</span>
                                                                    <span className="font-bold truncate">{d.barcode}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
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
                        onClick={() => loadLogs(page - 1, actionFilter)}
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
                        onClick={() => loadLogs(page + 1, actionFilter)}
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

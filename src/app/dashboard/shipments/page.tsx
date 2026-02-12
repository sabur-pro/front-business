'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    SendHorizontal,
    ArrowDownLeft,
    ArrowUpRight,
    Plus,
    Package,
    Clock,
    CheckCircle2,
    XCircle,
    ChevronRight,
    ChevronDown,
    Filter,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import {
    shipmentApi,
    organizationApi,
    ShipmentResponse,
    ShipmentStatus,
    AccountResponse,
} from '@/lib/api';

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; color: string; icon: typeof Clock }> = {
    PENDING: { label: 'Ожидает', color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400', icon: Clock },
    SENT: { label: 'Отправлен', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: SendHorizontal },
    CONFIRMED: { label: 'Принят', color: 'bg-green-500/10 text-green-600 dark:text-green-400', icon: CheckCircle2 },
    CANCELLED: { label: 'Отменён', color: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: XCircle },
};

type Tab = 'outgoing' | 'incoming';

export default function ShipmentsPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();

    const [accounts, setAccounts] = useState<AccountResponse[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [activeTab, setActiveTab] = useState<Tab>('outgoing');
    const [shipments, setShipments] = useState<ShipmentResponse[]>([]);
    const [statusFilter, setStatusFilter] = useState<ShipmentStatus | ''>('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, authLoading, router]);

    useEffect(() => {
        if (isAuthenticated) {
            loadAccounts();
        }
    }, [isAuthenticated]);

    const loadAccounts = async () => {
        setIsLoadingAccounts(true);
        try {
            const data = await organizationApi.getAccounts();
            setAccounts(data);
            if (data.length > 0) {
                setSelectedAccountId(data[0].id);
            }
        } catch (err) {
            console.error('Failed to load accounts', err);
        } finally {
            setIsLoadingAccounts(false);
        }
    };

    const loadShipments = useCallback(async () => {
        if (!selectedAccountId) return;
        setIsLoading(true);
        try {
            const params: any = { page, limit: 20 };
            if (statusFilter) params.status = statusFilter;

            const data = activeTab === 'outgoing'
                ? await shipmentApi.getOutgoing(selectedAccountId, params)
                : await shipmentApi.getIncoming(selectedAccountId, params);

            setShipments(data.items);
            setTotalPages(data.totalPages);
            setTotal(data.total);
        } catch (err) {
            console.error('Failed to load shipments', err);
        } finally {
            setIsLoading(false);
        }
    }, [selectedAccountId, activeTab, statusFilter, page]);

    useEffect(() => {
        if (selectedAccountId) {
            setPage(1);
        }
    }, [selectedAccountId, activeTab, statusFilter]);

    useEffect(() => {
        loadShipments();
    }, [loadShipments]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (authLoading || !isAuthenticated) {
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

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Заявки</h1>
                    <p className="text-muted-foreground">Отправки и приёмки товаров</p>
                </div>
                <Button size="sm" onClick={() => router.push('/dashboard/shipments/create')}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Отправить
                </Button>
            </div>

            {/* Account Selector (if multiple) */}
            {accounts.length > 1 && (
                <Card className="p-4">
                    <label className="block text-sm font-medium mb-2">Аккаунт</label>
                    <div className="relative">
                        <select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-border bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                        >
                            {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                </Card>
            )}

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('outgoing')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        activeTab === 'outgoing'
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                            : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                    }`}
                >
                    <ArrowUpRight className="h-4 w-4" />
                    Исходящие
                </button>
                <button
                    onClick={() => setActiveTab('incoming')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        activeTab === 'incoming'
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                            : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                    }`}
                >
                    <ArrowDownLeft className="h-4 w-4" />
                    Входящие
                </button>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <button
                    onClick={() => setStatusFilter('')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        statusFilter === '' ? 'bg-primary/10 text-primary' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                    }`}
                >
                    Все
                </button>
                {(Object.entries(STATUS_CONFIG) as [ShipmentStatus, typeof STATUS_CONFIG[ShipmentStatus]][]).map(([status, config]) => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            statusFilter === status ? config.color + ' ring-1 ring-current' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                        }`}
                    >
                        {config.label}
                    </button>
                ))}
            </div>

            {/* Shipments List */}
            {isLoading || isLoadingAccounts ? (
                <div className="flex justify-center p-12">
                    <motion.div
                        className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                </div>
            ) : shipments.length === 0 ? (
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <SendHorizontal className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                        {activeTab === 'outgoing' ? 'Нет исходящих заявок' : 'Нет входящих заявок'}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                        {activeTab === 'outgoing'
                            ? 'Создайте первую отправку, чтобы она появилась здесь'
                            : 'Когда вам отправят товары, они появятся здесь'}
                    </p>
                    {activeTab === 'outgoing' && (
                        <Button size="sm" className="mt-4" onClick={() => router.push('/dashboard/shipments/create')}>
                            <Plus className="h-4 w-4 mr-1.5" />
                            Создать отправку
                        </Button>
                    )}
                </Card>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Найдено: {total}
                    </p>
                    <AnimatePresence mode="popLayout">
                        {shipments.map((shipment, index) => {
                            const statusCfg = STATUS_CONFIG[shipment.status];
                            const StatusIcon = statusCfg.icon;
                            const totalItems = shipment.items.reduce((s, i) => s + i.boxCount, 0);

                            return (
                                <motion.div
                                    key={shipment.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ delay: index * 0.03 }}
                                >
                                    <Card
                                        className="p-4 hover:shadow-lg transition-shadow cursor-pointer group"
                                        onClick={() => router.push(`/dashboard/shipments/${shipment.id}`)}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-lg ${activeTab === 'outgoing' ? 'bg-blue-500/10' : 'bg-green-500/10'}`}>
                                                    {activeTab === 'outgoing'
                                                        ? <ArrowUpRight className="h-4 w-4 text-blue-500" />
                                                        : <ArrowDownLeft className="h-4 w-4 text-green-500" />
                                                    }
                                                </div>
                                                <span className="font-semibold text-sm">#{shipment.number}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${statusCfg.color}`}>
                                                    <StatusIcon className="h-3 w-3" />
                                                    {statusCfg.label}
                                                </span>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </div>

                                        <div className={`grid gap-2 text-xs ${user?.role === 'POINT_ADMIN' ? 'grid-cols-2' : 'grid-cols-2'}`}>
                                            <div>
                                                <span className="text-muted-foreground">Коробок:</span>
                                                <span className="ml-1 font-medium">{totalItems}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Позиций:</span>
                                                <span className="ml-1 font-medium">{shipment.items.length}</span>
                                            </div>
                                            {user?.role !== 'POINT_ADMIN' && (
                                                <>
                                                    <div>
                                                        <span className="text-muted-foreground">Сумма ¥:</span>
                                                        <span className="ml-1 font-medium text-blue-600 dark:text-blue-400">{Number(shipment.totalYuan).toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">Сумма ₽:</span>
                                                        <span className="ml-1 font-medium text-green-600 dark:text-green-400">{Number(shipment.totalRub).toLocaleString()}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="mt-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                                            Создано: {formatDate(shipment.createdAt)}
                                            {shipment.confirmedAt && ` · Принято: ${formatDate(shipment.confirmedAt)}`}
                                        </div>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
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
                                onClick={() => setPage(p => p + 1)}
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

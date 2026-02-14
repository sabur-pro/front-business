'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Truck,
    ShoppingBag,
    Phone,
    StickyNote,
    Pencil,
    Banknote,
    X,
    ArrowDownCircle,
    ArrowUpCircle,
    Package,
    ShoppingCart,
    User,
} from 'lucide-react';
import { Button, Card, PaymentModal } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import {
    counterpartyApi,
    warehouseApi,
    CounterpartyResponse,
    CounterpartyTransactionResponse,
    WarehouseResponse,
    CounterpartyTransactionType,
} from '@/lib/api';

const txTypeConfig: Record<CounterpartyTransactionType, { label: string; color: string; icon: typeof Package }> = {
    GOODS_RECEIVED: { label: 'Приход товара', color: 'text-orange-500 bg-orange-500/10', icon: Package },
    GOODS_SOLD: { label: 'Продажа', color: 'text-green-500 bg-green-500/10', icon: ShoppingCart },
    PAYMENT_IN: { label: 'Входящий платёж', color: 'text-green-500 bg-green-500/10', icon: ArrowDownCircle },
    PAYMENT_OUT: { label: 'Исходящий платёж', color: 'text-red-500 bg-red-500/10', icon: ArrowUpCircle },
};

export default function CounterpartyDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuthStore();
    const id = params.id as string;

    const [counterparty, setCounterparty] = useState<CounterpartyResponse | null>(null);
    const [transactions, setTransactions] = useState<CounterpartyTransactionResponse[]>([]);
    const [txTotal, setTxTotal] = useState(0);
    const [txPage, setTxPage] = useState(1);
    const [txTotalPages, setTxTotalPages] = useState(1);
    const [shops, setShops] = useState<WarehouseResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTxLoading, setIsTxLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Edit modal
    const [showEdit, setShowEdit] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editNote, setEditNote] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Payment modal
    const [showPayment, setShowPayment] = useState(false);

    useEffect(() => {
        loadCounterparty();
        loadTransactions(1);
        loadShops();
    }, [id]);

    useEffect(() => {
        if (success) {
            const t = setTimeout(() => setSuccess(null), 3000);
            return () => clearTimeout(t);
        }
    }, [success]);

    const loadCounterparty = async () => {
        setIsLoading(true);
        try {
            const data = await counterpartyApi.getById(id);
            setCounterparty(data);
            setEditName(data.name);
            setEditPhone(data.phone || '');
            setEditNote(data.note || '');
        } catch (err) {
            console.error('Failed to load counterparty', err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadTransactions = async (p: number) => {
        setIsTxLoading(true);
        try {
            const res = await counterpartyApi.getTransactions(id, { page: p, limit: 20 });
            setTransactions(res.items);
            setTxTotal(res.total);
            setTxPage(res.page);
            setTxTotalPages(res.totalPages);
        } catch (err) {
            console.error('Failed to load transactions', err);
        } finally {
            setIsTxLoading(false);
        }
    };

    const loadShops = async () => {
        try {
            const warehouses = await warehouseApi.getAll();
            setShops(warehouses.filter(w => w.type === 'SHOP'));
        } catch { /* ignore */ }
    };

    const handleEdit = async () => {
        if (!editName.trim()) return;
        setIsEditing(true);
        setError(null);
        try {
            const updated = await counterpartyApi.update(id, {
                name: editName.trim(),
                phone: editPhone.trim() || undefined,
                note: editNote.trim() || undefined,
            });
            setCounterparty(updated);
            setShowEdit(false);
            setSuccess('Данные обновлены');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка обновления');
        } finally {
            setIsEditing(false);
        }
    };

    const handlePaymentSuccess = () => {
        setSuccess('Оплата проведена');
        loadCounterparty();
        loadTransactions(1);
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

    if (!counterparty) {
        return (
            <Card className="p-12 text-center">
                <h3 className="text-lg font-semibold mb-2">Контрагент не найден</h3>
                <Button onClick={() => router.back()}>Назад</Button>
            </Card>
        );
    }

    const isSupplier = counterparty.type === 'SUPPLIER';

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-start gap-4">
                <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-muted transition-colors mt-1">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold">{counterparty.name}</h1>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            isSupplier
                                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}>
                            {isSupplier ? 'Поставщик' : 'Клиент'}
                        </span>
                    </div>
                    {counterparty.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" />
                            {counterparty.phone}
                        </p>
                    )}
                    {counterparty.note && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <StickyNote className="h-3.5 w-3.5" />
                            {counterparty.note}
                        </p>
                    )}
                </div>
            </div>

            {/* Success/Error */}
            <AnimatePresence>
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 text-sm"
                    >
                        {success}
                    </motion.div>
                )}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm flex justify-between items-center"
                    >
                        <span>{error}</span>
                        <button onClick={() => setError(null)}><X className="h-3.5 w-3.5" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Balance card */}
            <Card className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Текущий баланс (долг)</p>
                        <p className={`text-3xl font-bold ${
                            Number(counterparty.balance) === 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                            {Number(counterparty.balance) === 0
                                ? '0 ₽'
                                : `${Math.abs(Number(counterparty.balance)).toLocaleString('ru-RU')} ₽`}
                        </p>
                    </div>
                    <div className={`p-3 rounded-xl ${isSupplier ? 'bg-orange-500/10' : 'bg-blue-500/10'}`}>
                        {isSupplier ? (
                            <Truck className="h-6 w-6 text-orange-500" />
                        ) : (
                            <ShoppingBag className="h-6 w-6 text-blue-500" />
                        )}
                    </div>
                </div>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowEdit(true)} className="flex-1">
                    <Pencil className="h-4 w-4 mr-2" />
                    Редактировать
                </Button>
                <Button onClick={() => setShowPayment(true)} className="flex-1">
                    <Banknote className="h-4 w-4 mr-2" />
                    Оплатить долг
                </Button>
            </div>

            {/* Transactions */}
            <div>
                <h2 className="text-lg font-semibold mb-3">История транзакций {txTotal > 0 && `(${txTotal})`}</h2>

                {isTxLoading ? (
                    <div className="flex justify-center p-8">
                        <motion.div
                            className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                    </div>
                ) : transactions.length === 0 ? (
                    <Card className="p-8 text-center">
                        <p className="text-sm text-muted-foreground">Нет транзакций</p>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {transactions.map((tx, index) => {
                            const config = txTypeConfig[tx.type];
                            const Icon = config.icon;
                            return (
                                <motion.div
                                    key={tx.id}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.02 }}
                                >
                                    <Card className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl ${config.color.split(' ')[1]}`}>
                                                <Icon className={`h-4 w-4 ${config.color.split(' ')[0]}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium">{config.label}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(tx.createdAt).toLocaleDateString('ru-RU', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </p>
                                                {tx.description && (
                                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{tx.description}</p>
                                                )}
                                            </div>
                                            <span className={`text-sm font-semibold flex-shrink-0 ${config.color.split(' ')[0]}`}>
                                                {(tx.type === 'PAYMENT_OUT' || tx.type === 'GOODS_RECEIVED') ? '-' : '+'}
                                                {Number(tx.amount).toLocaleString('ru-RU')} ₽
                                            </span>
                                        </div>
                                    </Card>
                                </motion.div>
                            );
                        })}

                        {/* Pagination */}
                        {txTotalPages > 1 && (
                            <div className="flex justify-center gap-2 pt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={txPage <= 1}
                                    onClick={() => loadTransactions(txPage - 1)}
                                >
                                    Назад
                                </Button>
                                <span className="flex items-center text-sm text-muted-foreground px-3">
                                    {txPage} / {txTotalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={txPage >= txTotalPages}
                                    onClick={() => loadTransactions(txPage + 1)}
                                >
                                    Далее
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {showEdit && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                        onClick={() => setShowEdit(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">Редактировать</h2>
                                <button onClick={() => setShowEdit(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Имя *</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Телефон</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <input
                                            value={editPhone}
                                            onChange={(e) => setEditPhone(e.target.value)}
                                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Заметка</label>
                                    <textarea
                                        value={editNote}
                                        onChange={(e) => setEditNote(e.target.value)}
                                        rows={2}
                                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <Button variant="outline" onClick={() => setShowEdit(false)} className="flex-1">
                                        Отмена
                                    </Button>
                                    <Button onClick={handleEdit} isLoading={isEditing} disabled={!editName.trim()} className="flex-1">
                                        Сохранить
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Payment Modal */}
            {counterparty && (
                <PaymentModal
                    isOpen={showPayment}
                    onClose={() => setShowPayment(false)}
                    counterparty={counterparty}
                    onSuccess={handlePaymentSuccess}
                    shops={shops}
                />
            )}
        </div>
    );
}

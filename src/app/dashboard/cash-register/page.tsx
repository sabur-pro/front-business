'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Banknote,
    Wallet,
    TrendingUp,
    TrendingDown,
    Store,
    ChevronDown,
    X,
    ArrowDownCircle,
    ArrowUpCircle,
    ShoppingCart,
    Truck,
    ShoppingBag,
    Plus,
    Minus,
    CreditCard,
    Lock,
    ArrowRightLeft,
    Receipt,
    Send,
    Check,
    XCircle,
    Clock,
    Calendar,
} from 'lucide-react';
import { Button, Card, CounterpartySelect } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import {
    warehouseApi,
    cashRegisterApi,
    WarehouseResponse,
    CashRegisterSummaryResponse,
    CashTransactionResponse,
    CashTransactionType,
    ExpenseResponse,
    PayoutResponse,
    PaymentMethod,
} from '@/lib/api';
import { groupByDay, filterByDate } from '@/lib/date-utils';

const cashTxConfig: Record<CashTransactionType, { label: string; color: string; icon: typeof ShoppingCart }> = {
    SALE_INCOME: { label: 'Продажа (наличные)', color: 'text-green-500 bg-green-500/10', icon: ShoppingCart },
    SALE_INCOME_CARD: { label: 'Продажа (карта)', color: 'text-green-500 bg-green-500/10', icon: CreditCard },
    PAYMENT_TO_SUPPLIER: { label: 'Оплата поставщику', color: 'text-red-500 bg-red-500/10', icon: Truck },
    PAYMENT_FROM_CLIENT: { label: 'Оплата от клиента', color: 'text-green-500 bg-green-500/10', icon: ShoppingBag },
    EXPENSE: { label: 'Расход', color: 'text-orange-500 bg-orange-500/10', icon: Receipt },
    ADJUSTMENT: { label: 'Корректировка', color: 'text-gray-500 bg-gray-500/10', icon: ArrowRightLeft },
    TRANSFER_TO_SAFE: { label: 'В сейф (наличные)', color: 'text-purple-500 bg-purple-500/10', icon: Lock },
    TRANSFER_FROM_SAFE: { label: 'Из сейфа', color: 'text-purple-500 bg-purple-500/10', icon: Lock },
    CARD_TO_SAFE: { label: 'В сейф (карта)', color: 'text-purple-500 bg-purple-500/10', icon: Lock },
    SAFE_TO_CARD: { label: 'Из сейфа на карту', color: 'text-purple-500 bg-purple-500/10', icon: Lock },
    PAYOUT_CASH: { label: 'Выдача (наличные)', color: 'text-red-500 bg-red-500/10', icon: Send },
    PAYOUT_SAFE: { label: 'Выдача (сейф)', color: 'text-red-500 bg-red-500/10', icon: Send },
    PAYOUT_CARD: { label: 'Выдача (карта)', color: 'text-red-500 bg-red-500/10', icon: Send },
};

const negativeTxTypes: CashTransactionType[] = [
    'PAYMENT_TO_SUPPLIER', 'EXPENSE', 'TRANSFER_TO_SAFE', 'CARD_TO_SAFE',
    'PAYOUT_CASH', 'PAYOUT_SAFE', 'PAYOUT_CARD',
];

type TabType = 'transactions' | 'expenses' | 'payouts';

function Modal({ show, onClose, title, children }: { show: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">{title}</h2>
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
                        </div>
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default function CashRegisterPage() {
    const { user } = useAuthStore();
    const isOrganizer = user?.role === 'ORGANIZER';

    const [shops, setShops] = useState<WarehouseResponse[]>([]);
    const [selectedShopId, setSelectedShopId] = useState('');
    const [summary, setSummary] = useState<CashRegisterSummaryResponse | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('transactions');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Transactions
    const [transactions, setTransactions] = useState<CashTransactionResponse[]>([]);
    const [txPage, setTxPage] = useState(1);
    const [txTotalPages, setTxTotalPages] = useState(1);
    const [isTxLoading, setIsTxLoading] = useState(false);

    // Expenses
    const [expenses, setExpenses] = useState<ExpenseResponse[]>([]);
    const [expPage, setExpPage] = useState(1);
    const [expTotalPages, setExpTotalPages] = useState(1);
    const [isExpLoading, setIsExpLoading] = useState(false);

    // Payouts
    const [payouts, setPayouts] = useState<PayoutResponse[]>([]);
    const [payPage, setPayPage] = useState(1);
    const [payTotalPages, setPayTotalPages] = useState(1);
    const [isPayLoading, setIsPayLoading] = useState(false);

    // Date filters
    const [txDateFilter, setTxDateFilter] = useState('');
    const [expDateFilter, setExpDateFilter] = useState('');
    const [payDateFilter, setPayDateFilter] = useState('');

    // Pay supplier modal
    const [showPaySupplier, setShowPaySupplier] = useState(false);
    const [paySupplierCounterpartyId, setPaySupplierCounterpartyId] = useState<string | null>(null);
    const [paySupplierAmount, setPaySupplierAmount] = useState('');
    const [paySupplierDesc, setPaySupplierDesc] = useState('');
    const [isPayingSupplier, setIsPayingSupplier] = useState(false);

    // Receive from client modal
    const [showReceiveClient, setShowReceiveClient] = useState(false);
    const [receiveClientCounterpartyId, setReceiveClientCounterpartyId] = useState<string | null>(null);
    const [receiveClientAmount, setReceiveClientAmount] = useState('');
    const [receiveClientDesc, setReceiveClientDesc] = useState('');
    const [isReceivingClient, setIsReceivingClient] = useState(false);

    // Transfer to safe modal
    const [showTransferSafe, setShowTransferSafe] = useState(false);
    const [safeSource, setSafeSource] = useState<'CASH' | 'CARD'>('CASH');
    const [safeAmount, setSafeAmount] = useState('');
    const [isTransferring, setIsTransferring] = useState(false);

    // Expense modal
    const [showExpense, setShowExpense] = useState(false);
    const [expCategory, setExpCategory] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expDesc, setExpDesc] = useState('');
    const [expPayMethod, setExpPayMethod] = useState<PaymentMethod>('CASH');
    const [isCreatingExpense, setIsCreatingExpense] = useState(false);

    // Payout modal
    const [showPayout, setShowPayout] = useState(false);
    const [payoutCash, setPayoutCash] = useState('');
    const [payoutSafe, setPayoutSafe] = useState('');
    const [payoutCard, setPayoutCard] = useState('');
    const [payoutNote, setPayoutNote] = useState('');
    const [isCreatingPayout, setIsCreatingPayout] = useState(false);

    useEffect(() => { loadShops(); }, []);

    useEffect(() => {
        if (selectedShopId) {
            loadSummary();
            loadTransactions(1);
            loadExpenses(1);
            loadPayouts(1);
        }
    }, [selectedShopId]);

    useEffect(() => {
        if (success) {
            const t = setTimeout(() => setSuccess(null), 3000);
            return () => clearTimeout(t);
        }
    }, [success]);

    const loadShops = async () => {
        setIsLoading(true);
        try {
            const warehouses = await warehouseApi.getAll();
            const shopsList = warehouses.filter(w => w.type === 'SHOP');
            setShops(shopsList);
            if (shopsList.length > 0) setSelectedShopId(shopsList[0].id);
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    const loadSummary = async () => {
        try { setSummary(await cashRegisterApi.getSummary(selectedShopId)); }
        catch (err) { console.error(err); }
    };

    const loadTransactions = async (p: number) => {
        setIsTxLoading(true);
        try {
            const data = await cashRegisterApi.getTransactions(selectedShopId, { page: p, limit: 20 });
            setTransactions(data.items); setTxPage(data.page); setTxTotalPages(data.totalPages);
        } catch (err) { console.error(err); }
        finally { setIsTxLoading(false); }
    };

    const loadExpenses = async (p: number) => {
        setIsExpLoading(true);
        try {
            const data = await cashRegisterApi.getExpenses(selectedShopId, { page: p, limit: 20 });
            setExpenses(data.items); setExpPage(data.page); setExpTotalPages(data.totalPages);
        } catch (err) { console.error(err); }
        finally { setIsExpLoading(false); }
    };

    const loadPayouts = async (p: number) => {
        setIsPayLoading(true);
        try {
            const data = await cashRegisterApi.getPayoutsByShop(selectedShopId, { page: p, limit: 20 });
            setPayouts(data.items); setPayPage(data.page); setPayTotalPages(data.totalPages);
        } catch (err) { console.error(err); }
        finally { setIsPayLoading(false); }
    };

    const refreshAll = () => { loadSummary(); loadTransactions(1); loadExpenses(1); loadPayouts(1); };

    const filteredTx = useMemo(() => filterByDate(transactions, t => t.createdAt, txDateFilter), [transactions, txDateFilter]);
    const groupedTx = useMemo(() => groupByDay(filteredTx, t => t.createdAt), [filteredTx]);
    const filteredExp = useMemo(() => filterByDate(expenses, e => e.createdAt, expDateFilter), [expenses, expDateFilter]);
    const groupedExp = useMemo(() => groupByDay(filteredExp, e => e.createdAt), [filteredExp]);
    const filteredPay = useMemo(() => filterByDate(payouts, p => p.createdAt, payDateFilter), [payouts, payDateFilter]);
    const groupedPay = useMemo(() => groupByDay(filteredPay, p => p.createdAt), [filteredPay]);

    const handlePaySupplier = async () => {
        const amount = parseFloat(paySupplierAmount);
        if (!amount || amount <= 0 || !paySupplierCounterpartyId) return;
        setIsPayingSupplier(true); setError(null);
        try {
            await cashRegisterApi.paySupplier({ shopId: selectedShopId, counterpartyId: paySupplierCounterpartyId, amount, description: paySupplierDesc || undefined });
            setShowPaySupplier(false); setPaySupplierCounterpartyId(null); setPaySupplierAmount(''); setPaySupplierDesc('');
            setSuccess('Оплата поставщику проведена'); refreshAll();
        } catch (err: any) { setError(err.response?.data?.message || 'Ошибка оплаты'); }
        finally { setIsPayingSupplier(false); }
    };

    const handleReceiveClient = async () => {
        const amount = parseFloat(receiveClientAmount);
        if (!amount || amount <= 0 || !receiveClientCounterpartyId) return;
        setIsReceivingClient(true); setError(null);
        try {
            await cashRegisterApi.receiveFromClient({ shopId: selectedShopId, counterpartyId: receiveClientCounterpartyId, amount, description: receiveClientDesc || undefined });
            setShowReceiveClient(false); setReceiveClientCounterpartyId(null); setReceiveClientAmount(''); setReceiveClientDesc('');
            setSuccess('Оплата от клиента принята'); refreshAll();
        } catch (err: any) { setError(err.response?.data?.message || 'Ошибка'); }
        finally { setIsReceivingClient(false); }
    };

    const handleTransferToSafe = async () => {
        const amount = parseFloat(safeAmount);
        if (!amount || amount <= 0) return;
        setIsTransferring(true); setError(null);
        try {
            await cashRegisterApi.transferToSafe({ shopId: selectedShopId, amount, source: safeSource });
            setShowTransferSafe(false); setSafeAmount('');
            setSuccess(`Переведено в сейф: ${amount.toLocaleString('ru-RU')} ₽`); refreshAll();
        } catch (err: any) { setError(err.response?.data?.message || 'Ошибка перевода'); }
        finally { setIsTransferring(false); }
    };

    const handleCreateExpense = async () => {
        const amount = parseFloat(expAmount);
        if (!amount || amount <= 0 || !expCategory.trim()) return;
        setIsCreatingExpense(true); setError(null);
        try {
            await cashRegisterApi.createExpense({ shopId: selectedShopId, category: expCategory.trim(), amount, description: expDesc || undefined, paymentMethod: expPayMethod });
            setShowExpense(false); setExpCategory(''); setExpAmount(''); setExpDesc(''); setExpPayMethod('CASH');
            setSuccess('Расход добавлен'); refreshAll();
        } catch (err: any) { setError(err.response?.data?.message || 'Ошибка'); }
        finally { setIsCreatingExpense(false); }
    };

    const handleCreatePayout = async () => {
        const cash = parseFloat(payoutCash) || 0;
        const safe = parseFloat(payoutSafe) || 0;
        const card = parseFloat(payoutCard) || 0;
        if (cash + safe + card <= 0) return;
        setIsCreatingPayout(true); setError(null);
        try {
            await cashRegisterApi.createPayout({ shopId: selectedShopId, cashAmount: cash || undefined, safeAmount: safe || undefined, cardAmount: card || undefined, note: payoutNote || undefined });
            setShowPayout(false); setPayoutCash(''); setPayoutSafe(''); setPayoutCard(''); setPayoutNote('');
            setSuccess('Выдача создана, ожидает одобрения организатором'); refreshAll();
        } catch (err: any) { setError(err.response?.data?.message || 'Ошибка'); }
        finally { setIsCreatingPayout(false); }
    };

    const handleApprovePayout = async (id: string) => {
        setError(null);
        try {
            await cashRegisterApi.approvePayout(id);
            setSuccess('Выдача одобрена'); refreshAll();
        } catch (err: any) { setError(err.response?.data?.message || 'Ошибка одобрения'); }
    };

    const handleRejectPayout = async (id: string) => {
        setError(null);
        try {
            await cashRegisterApi.rejectPayout(id);
            setSuccess('Выдача отклонена'); refreshAll();
        } catch (err: any) { setError(err.response?.data?.message || 'Ошибка отклонения'); }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-12">
                <motion.div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
                    animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
            </div>
        );
    }

    if (shops.length === 0) {
        return (
            <div className="space-y-6">
                <div><h1 className="text-3xl font-bold">Касса</h1><p className="text-muted-foreground">Управление кассой магазина</p></div>
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4"><Banknote className="h-8 w-8 text-emerald-500" /></div>
                    <h3 className="text-lg font-semibold mb-2">Нет магазинов</h3>
                    <p className="text-muted-foreground">Для работы кассы нужен магазин</p>
                </Card>
            </div>
        );
    }

    const tabs: { key: TabType; label: string }[] = [
        { key: 'transactions', label: 'Операции' },
        { key: 'expenses', label: 'Расходы' },
        { key: 'payouts', label: 'Выдачи' },
    ];

    return (
        <div className="space-y-6 pb-24">
            <div><h1 className="text-3xl font-bold">Касса</h1><p className="text-muted-foreground">Управление кассой магазина</p></div>

            {/* Notifications */}
            <AnimatePresence>
                {success && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 text-sm">{success}</motion.div>
                )}
                {error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm flex justify-between items-center">
                        <span>{error}</span>
                        <button onClick={() => setError(null)}><X className="h-3.5 w-3.5" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Shop selector */}
            <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select value={selectedShopId} onChange={(e) => setSelectedShopId(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors">
                    {shops.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>

            {/* Balance cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-green-500/10"><Banknote className="h-4 w-4 text-green-500" /></div>
                                <span className="text-xs text-muted-foreground">Наличные</span>
                            </div>
                            <p className="text-lg font-bold text-green-500">{Number(summary.register.balance).toLocaleString('ru-RU')} ₽</p>
                        </Card>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-blue-500/10"><CreditCard className="h-4 w-4 text-blue-500" /></div>
                                <span className="text-xs text-muted-foreground">Карта</span>
                            </div>
                            <p className="text-lg font-bold text-blue-500">{Number(summary.register.cardBalance).toLocaleString('ru-RU')} ₽</p>
                        </Card>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-purple-500/10"><Lock className="h-4 w-4 text-purple-500" /></div>
                                <span className="text-xs text-muted-foreground">Сейф</span>
                            </div>
                            <p className="text-lg font-bold text-purple-500">{Number(summary.register.safeBalance).toLocaleString('ru-RU')} ₽</p>
                        </Card>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-sky-500/10"><TrendingUp className="h-4 w-4 text-sky-500" /></div>
                                <span className="text-xs text-muted-foreground">Долг клиентов</span>
                            </div>
                            <p className="text-lg font-bold text-sky-500">{Number(summary.totalOwedByClients).toLocaleString('ru-RU')} ₽</p>
                        </Card>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-red-500/10"><TrendingDown className="h-4 w-4 text-red-500" /></div>
                                <span className="text-xs text-muted-foreground">Долг поставщ.</span>
                            </div>
                            <p className="text-lg font-bold text-red-500">{Number(summary.totalOwedToSuppliers).toLocaleString('ru-RU')} ₽</p>
                        </Card>
                    </motion.div>
                </div>
            )}

            {/* Quick actions */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowPaySupplier(true)}>
                    <ArrowUpCircle className="h-3.5 w-3.5 mr-1.5 text-red-500" />Поставщику
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowReceiveClient(true)}>
                    <ArrowDownCircle className="h-3.5 w-3.5 mr-1.5 text-green-500" />От клиента
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowTransferSafe(true)}>
                    <Lock className="h-3.5 w-3.5 mr-1.5 text-purple-500" />В сейф
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowExpense(true)}>
                    <Receipt className="h-3.5 w-3.5 mr-1.5 text-orange-500" />Расход
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowPayout(true)}>
                    <Send className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />Выдача
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-muted/50">
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}>{tab.label}</button>
                ))}
            </div>

            {/* TAB: Transactions */}
            {activeTab === 'transactions' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <input type="date" value={txDateFilter} onChange={(e) => setTxDateFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                        {txDateFilter && <button onClick={() => setTxDateFilter('')} className="px-2 py-1.5 rounded-lg text-xs font-medium bg-muted/60 text-muted-foreground hover:bg-muted transition-all">Сбросить</button>}
                    </div>
                    {isTxLoading ? (
                        <div className="flex justify-center p-8">
                            <motion.div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full"
                                animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                        </div>
                    ) : transactions.length === 0 ? (
                        <Card className="p-8 text-center">
                            <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3"><Banknote className="h-7 w-7 text-muted-foreground" /></div>
                            <p className="text-sm text-muted-foreground">Нет операций</p>
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {groupedTx.map(group => (
                                <div key={group.date} className="space-y-2">
                                    <div className="flex items-center gap-2 pt-1">
                                        <div className="h-px flex-1 bg-border/60" />
                                        <span className="text-xs font-semibold text-muted-foreground px-2">{group.label}</span>
                                        <div className="h-px flex-1 bg-border/60" />
                                    </div>
                                    {group.items.map((tx, idx) => {
                                        const config = cashTxConfig[tx.type] || { label: tx.type, color: 'text-gray-500 bg-gray-500/10', icon: ArrowRightLeft };
                                        const Icon = config.icon;
                                        // Знак задаёт и тип операции, и знак суммы: отмена продажи
                                        // приходит как SALE_INCOME с отрицательной суммой — это возврат денег
                                        const amount = Number(tx.amount);
                                        const typeSign = negativeTxTypes.includes(tx.type) ? -1 : 1;
                                        const isNeg = typeSign * (amount < 0 ? -1 : 1) < 0;
                                        return (
                                            <motion.div key={tx.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
                                                <Card className="p-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-xl ${config.color.split(' ')[1]}`}><Icon className={`h-4 w-4 ${config.color.split(' ')[0]}`} /></div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium">{config.label}</p>
                                                            <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
                                                            {tx.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{tx.description}</p>}
                                                        </div>
                                                        <span className={`text-sm font-semibold flex-shrink-0 ${isNeg ? 'text-red-500' : 'text-green-500'}`}>
                                                            {isNeg ? '-' : '+'}{Math.abs(amount).toLocaleString('ru-RU')} ₽
                                                        </span>
                                                    </div>
                                                </Card>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ))}
                            {txTotalPages > 1 && (
                                <div className="flex justify-center gap-2 pt-4">
                                    <Button variant="outline" size="sm" disabled={txPage <= 1} onClick={() => loadTransactions(txPage - 1)}>Назад</Button>
                                    <span className="flex items-center text-sm text-muted-foreground px-3">{txPage} / {txTotalPages}</span>
                                    <Button variant="outline" size="sm" disabled={txPage >= txTotalPages} onClick={() => loadTransactions(txPage + 1)}>Далее</Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Expenses */}
            {activeTab === 'expenses' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <input type="date" value={expDateFilter} onChange={(e) => setExpDateFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                        {expDateFilter && <button onClick={() => setExpDateFilter('')} className="px-2 py-1.5 rounded-lg text-xs font-medium bg-muted/60 text-muted-foreground hover:bg-muted transition-all">Сбросить</button>}
                    </div>
                    {isExpLoading ? (
                        <div className="flex justify-center p-8">
                            <motion.div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full"
                                animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                        </div>
                    ) : expenses.length === 0 ? (
                        <Card className="p-8 text-center">
                            <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3"><Receipt className="h-7 w-7 text-muted-foreground" /></div>
                            <p className="text-sm text-muted-foreground">Нет расходов</p>
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {groupedExp.map(group => (
                                <div key={group.date} className="space-y-2">
                                    <div className="flex items-center gap-2 pt-1">
                                        <div className="h-px flex-1 bg-border/60" />
                                        <span className="text-xs font-semibold text-muted-foreground px-2">{group.label}</span>
                                        <div className="h-px flex-1 bg-border/60" />
                                    </div>
                                    {group.items.map((exp, idx) => (
                                        <motion.div key={exp.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
                                            <Card className="p-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-xl bg-orange-500/10"><Receipt className="h-4 w-4 text-orange-500" /></div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium">{exp.category}</p>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs text-muted-foreground">{new Date(exp.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${exp.paymentMethod === 'CARD' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>
                                                                {exp.paymentMethod === 'CARD' ? 'Карта' : 'Наличные'}
                                                            </span>
                                                        </div>
                                                        {exp.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{exp.description}</p>}
                                                    </div>
                                                    <span className="text-sm font-semibold text-red-500 flex-shrink-0">-{Number(exp.amount).toLocaleString('ru-RU')} ₽</span>
                                                </div>
                                            </Card>
                                        </motion.div>
                                    ))}
                                </div>
                            ))}
                            {expTotalPages > 1 && (
                                <div className="flex justify-center gap-2 pt-4">
                                    <Button variant="outline" size="sm" disabled={expPage <= 1} onClick={() => loadExpenses(expPage - 1)}>Назад</Button>
                                    <span className="flex items-center text-sm text-muted-foreground px-3">{expPage} / {expTotalPages}</span>
                                    <Button variant="outline" size="sm" disabled={expPage >= expTotalPages} onClick={() => loadExpenses(expPage + 1)}>Далее</Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Payouts */}
            {activeTab === 'payouts' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <input type="date" value={payDateFilter} onChange={(e) => setPayDateFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                        {payDateFilter && <button onClick={() => setPayDateFilter('')} className="px-2 py-1.5 rounded-lg text-xs font-medium bg-muted/60 text-muted-foreground hover:bg-muted transition-all">Сбросить</button>}
                    </div>
                    {isPayLoading ? (
                        <div className="flex justify-center p-8">
                            <motion.div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full"
                                animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                        </div>
                    ) : payouts.length === 0 ? (
                        <Card className="p-8 text-center">
                            <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3"><Send className="h-7 w-7 text-muted-foreground" /></div>
                            <p className="text-sm text-muted-foreground">Нет выдач</p>
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {groupedPay.map(group => (
                                <div key={group.date} className="space-y-2">
                                    <div className="flex items-center gap-2 pt-1">
                                        <div className="h-px flex-1 bg-border/60" />
                                        <span className="text-xs font-semibold text-muted-foreground px-2">{group.label}</span>
                                        <div className="h-px flex-1 bg-border/60" />
                                    </div>
                                    {group.items.map((p, idx) => {
                                        const statusConfig = {
                                            PENDING: { label: 'Ожидает', color: 'bg-yellow-500/10 text-yellow-600', icon: Clock },
                                            APPROVED: { label: 'Одобрено', color: 'bg-green-500/10 text-green-600', icon: Check },
                                            REJECTED: { label: 'Отклонено', color: 'bg-red-500/10 text-red-600', icon: XCircle },
                                        };
                                        const sc = statusConfig[p.status];
                                        const StatusIcon = sc.icon;
                                        return (
                                            <motion.div key={p.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
                                                <Card className="p-4">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div>
                                                            <p className="text-sm font-medium">{p.number}</p>
                                                            <p className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
                                                        </div>
                                                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${sc.color}`}>
                                                            <StatusIcon className="h-3 w-3" />{sc.label}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                                                        {Number(p.cashAmount) > 0 && <div className="bg-green-500/5 rounded-lg p-2"><span className="text-muted-foreground">Наличные</span><p className="font-semibold">{Number(p.cashAmount).toLocaleString('ru-RU')} ₽</p></div>}
                                                        {Number(p.safeAmount) > 0 && <div className="bg-purple-500/5 rounded-lg p-2"><span className="text-muted-foreground">Сейф</span><p className="font-semibold">{Number(p.safeAmount).toLocaleString('ru-RU')} ₽</p></div>}
                                                        {Number(p.cardAmount) > 0 && <div className="bg-blue-500/5 rounded-lg p-2"><span className="text-muted-foreground">Карта</span><p className="font-semibold">{Number(p.cardAmount).toLocaleString('ru-RU')} ₽</p></div>}
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-bold">Итого: {Number(p.totalAmount).toLocaleString('ru-RU')} ₽</span>
                                                        {p.status === 'PENDING' && isOrganizer && (
                                                            <div className="flex gap-2">
                                                                <Button size="sm" variant="outline" onClick={() => handleRejectPayout(p.id)}>
                                                                    <XCircle className="h-3.5 w-3.5 mr-1 text-red-500" />Отклонить
                                                                </Button>
                                                                <Button size="sm" onClick={() => handleApprovePayout(p.id)}>
                                                                    <Check className="h-3.5 w-3.5 mr-1" />Одобрить
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {p.note && <p className="text-xs text-muted-foreground mt-1">{p.note}</p>}
                                                </Card>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ))}
                            {payTotalPages > 1 && (
                                <div className="flex justify-center gap-2 pt-4">
                                    <Button variant="outline" size="sm" disabled={payPage <= 1} onClick={() => loadPayouts(payPage - 1)}>Назад</Button>
                                    <span className="flex items-center text-sm text-muted-foreground px-3">{payPage} / {payTotalPages}</span>
                                    <Button variant="outline" size="sm" disabled={payPage >= payTotalPages} onClick={() => loadPayouts(payPage + 1)}>Далее</Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ========= MODALS ========= */}

            {/* Pay Supplier */}
            <Modal show={showPaySupplier} onClose={() => setShowPaySupplier(false)} title="Оплата поставщику">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Поставщик</label>
                        {user?.accountId && <CounterpartySelect accountId={user.accountId} type="SUPPLIER" value={paySupplierCounterpartyId} onChange={setPaySupplierCounterpartyId} showBalance allowCreate={false} />}
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Сумма</label>
                        <div className="relative">
                            <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input type="text" inputMode="decimal" value={paySupplierAmount} onChange={(e) => setPaySupplierAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00"
                                className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Комментарий</label>
                        <input value={paySupplierDesc} onChange={(e) => setPaySupplierDesc(e.target.value)} placeholder="Необязательно"
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" onClick={() => setShowPaySupplier(false)} className="flex-1">Отмена</Button>
                        <Button onClick={handlePaySupplier} isLoading={isPayingSupplier} disabled={!paySupplierCounterpartyId || !paySupplierAmount} className="flex-1">Оплатить</Button>
                    </div>
                </div>
            </Modal>

            {/* Receive from Client */}
            <Modal show={showReceiveClient} onClose={() => setShowReceiveClient(false)} title="Принять от клиента">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Клиент</label>
                        {user?.accountId && <CounterpartySelect accountId={user.accountId} type="CLIENT" value={receiveClientCounterpartyId} onChange={setReceiveClientCounterpartyId} showBalance allowCreate={false} />}
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Сумма</label>
                        <div className="relative">
                            <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input type="text" inputMode="decimal" value={receiveClientAmount} onChange={(e) => setReceiveClientAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00"
                                className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Комментарий</label>
                        <input value={receiveClientDesc} onChange={(e) => setReceiveClientDesc(e.target.value)} placeholder="Необязательно"
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" onClick={() => setShowReceiveClient(false)} className="flex-1">Отмена</Button>
                        <Button onClick={handleReceiveClient} isLoading={isReceivingClient} disabled={!receiveClientCounterpartyId || !receiveClientAmount} className="flex-1">Принять</Button>
                    </div>
                </div>
            </Modal>

            {/* Transfer to Safe */}
            <Modal show={showTransferSafe} onClose={() => setShowTransferSafe(false)} title="Перевод в сейф">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Источник</label>
                        <div className="flex gap-2">
                            <button onClick={() => setSafeSource('CASH')}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${safeSource === 'CASH' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'}`}>
                                <Banknote className="h-4 w-4" />Наличные
                            </button>
                            <button onClick={() => setSafeSource('CARD')}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${safeSource === 'CARD' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'}`}>
                                <CreditCard className="h-4 w-4" />Карта
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Сумма</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input type="text" inputMode="decimal" value={safeAmount} onChange={(e) => setSafeAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00"
                                className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" onClick={() => setShowTransferSafe(false)} className="flex-1">Отмена</Button>
                        <Button onClick={handleTransferToSafe} isLoading={isTransferring} disabled={!safeAmount} className="flex-1">Перевести</Button>
                    </div>
                </div>
            </Modal>

            {/* Create Expense */}
            <Modal show={showExpense} onClose={() => setShowExpense(false)} title="Добавить расход">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Категория</label>
                        <input value={expCategory} onChange={(e) => setExpCategory(e.target.value)} placeholder="Обед, грузчик, аренда..."
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Сумма</label>
                        <div className="relative">
                            <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input type="text" inputMode="decimal" value={expAmount} onChange={(e) => setExpAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00"
                                className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Оплата из</label>
                        <div className="flex gap-2">
                            <button onClick={() => setExpPayMethod('CASH')}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${expPayMethod === 'CASH' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'}`}>
                                <Banknote className="h-4 w-4" />Наличные
                            </button>
                            <button onClick={() => setExpPayMethod('CARD')}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${expPayMethod === 'CARD' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'}`}>
                                <CreditCard className="h-4 w-4" />Карта
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Описание</label>
                        <input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="Необязательно"
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" onClick={() => setShowExpense(false)} className="flex-1">Отмена</Button>
                        <Button onClick={handleCreateExpense} isLoading={isCreatingExpense} disabled={!expCategory.trim() || !expAmount} className="flex-1">Добавить</Button>
                    </div>
                </div>
            </Modal>

            {/* Create Payout */}
            <Modal show={showPayout} onClose={() => setShowPayout(false)} title="Выдача организатору">
                <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">Укажите суммы из каждого источника. После создания, организатор должен одобрить выдачу.</p>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Наличные</label>
                        <div className="relative">
                            <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                            <input type="text" inputMode="decimal" value={payoutCash} onChange={(e) => setPayoutCash(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0"
                                className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Из сейфа</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-500" />
                            <input type="text" inputMode="decimal" value={payoutSafe} onChange={(e) => setPayoutSafe(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0"
                                className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">На карту</label>
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
                            <input type="text" inputMode="decimal" value={payoutCard} onChange={(e) => setPayoutCard(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0"
                                className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
                        </div>
                    </div>
                    {(parseFloat(payoutCash) || 0) + (parseFloat(payoutSafe) || 0) + (parseFloat(payoutCard) || 0) > 0 && (
                        <div className="p-3 rounded-xl bg-muted/50 text-center">
                            <span className="text-sm text-muted-foreground">Итого: </span>
                            <span className="text-sm font-bold">{((parseFloat(payoutCash) || 0) + (parseFloat(payoutSafe) || 0) + (parseFloat(payoutCard) || 0)).toLocaleString('ru-RU')} ₽</span>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Примечание</label>
                        <input value={payoutNote} onChange={(e) => setPayoutNote(e.target.value)} placeholder="Необязательно"
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" onClick={() => setShowPayout(false)} className="flex-1">Отмена</Button>
                        <Button onClick={handleCreatePayout} isLoading={isCreatingPayout}
                            disabled={(parseFloat(payoutCash) || 0) + (parseFloat(payoutSafe) || 0) + (parseFloat(payoutCard) || 0) <= 0} className="flex-1">Создать</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

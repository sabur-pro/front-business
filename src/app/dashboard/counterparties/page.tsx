'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users2,
    Search,
    Plus,
    X,
    Phone,
    StickyNote,
    User,
    Truck,
    ShoppingBag,
} from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import {
    counterpartyApi,
    CounterpartyResponse,
    CounterpartyType,
} from '@/lib/api';

export default function CounterpartiesPage() {
    const router = useRouter();
    const { user } = useAuthStore();

    const [activeTab, setActiveTab] = useState<CounterpartyType>('SUPPLIER');
    const [items, setItems] = useState<CounterpartyResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Create modal
    const [showCreate, setShowCreate] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createPhone, setCreatePhone] = useState('');
    const [createNote, setCreateNote] = useState('');
    const [createType, setCreateType] = useState<CounterpartyType>('SUPPLIER');
    const [isCreating, setIsCreating] = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

    useEffect(() => {
        loadData(1, activeTab, '');
    }, [activeTab]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            loadData(1, activeTab, search);
        }, 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [search]);

    useEffect(() => {
        if (success) {
            const t = setTimeout(() => setSuccess(null), 3000);
            return () => clearTimeout(t);
        }
    }, [success]);

    const loadData = async (p: number, type: CounterpartyType, q: string) => {
        if (!user?.accountId) return;
        setIsLoading(true);
        try {
            const res = await counterpartyApi.getByAccount(user.accountId, {
                page: p,
                limit: 20,
                type,
                search: q || undefined,
            });
            setItems(res.items);
            setTotal(res.total);
            setPage(res.page);
            setTotalPages(res.totalPages);
        } catch (err) {
            console.error('Failed to load counterparties', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTabChange = (tab: CounterpartyType) => {
        setActiveTab(tab);
        setSearch('');
        setPage(1);
    };

    const handleCreate = async () => {
        if (!createName.trim()) return;
        setIsCreating(true);
        setError(null);
        try {
            await counterpartyApi.create({
                name: createName.trim(),
                phone: createPhone.trim() || undefined,
                note: createNote.trim() || undefined,
                type: createType,
            });
            setShowCreate(false);
            setCreateName('');
            setCreatePhone('');
            setCreateNote('');
            setSuccess('Контрагент создан');
            loadData(1, activeTab, search);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка создания');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Контрагенты</h1>
                    <p className="text-muted-foreground">Поставщики и клиенты</p>
                </div>
                <Button onClick={() => { setCreateType(activeTab); setShowCreate(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить
                </Button>
            </div>

            {/* Success/Error */}
            <AnimatePresence>
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 text-sm flex items-center justify-between"
                    >
                        <span>{success}</span>
                        <button onClick={() => setSuccess(null)}><X className="h-3.5 w-3.5" /></button>
                    </motion.div>
                )}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm flex items-center justify-between"
                    >
                        <span>{error}</span>
                        <button onClick={() => setError(null)}><X className="h-3.5 w-3.5" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => handleTabChange('SUPPLIER')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        activeTab === 'SUPPLIER'
                            ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent'
                    }`}
                >
                    <Truck className="h-4 w-4" />
                    Поставщики
                </button>
                <button
                    onClick={() => handleTabChange('CLIENT')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        activeTab === 'CLIENT'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent'
                    }`}
                >
                    <ShoppingBag className="h-4 w-4" />
                    Клиенты
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Поиск по имени или телефону..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex justify-center p-12">
                    <motion.div
                        className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                </div>
            ) : items.length === 0 ? (
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Users2 className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                        {search ? 'Ничего не найдено' : activeTab === 'SUPPLIER' ? 'Нет поставщиков' : 'Нет клиентов'}
                    </h3>
                    <p className="text-muted-foreground">
                        {search ? 'Попробуйте изменить запрос' : 'Добавьте первого контрагента'}
                    </p>
                </Card>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {items.map((item, index) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                        >
                            <Card
                                className="p-4 hover:shadow-lg transition-shadow cursor-pointer group"
                                onClick={() => router.push(`/dashboard/counterparties/${item.id}`)}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-xl ${item.type === 'SUPPLIER' ? 'bg-orange-500/10' : 'bg-blue-500/10'}`}>
                                        {item.type === 'SUPPLIER' ? (
                                            <Truck className="h-5 w-5 text-orange-500" />
                                        ) : (
                                            <ShoppingBag className="h-5 w-5 text-blue-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                                item.type === 'SUPPLIER'
                                                    ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                                                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                            }`}>
                                                {item.type === 'SUPPLIER' ? 'Поставщик' : 'Клиент'}
                                            </span>
                                        </div>
                                        {item.phone && (
                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                                <Phone className="h-3 w-3" />
                                                {item.phone}
                                            </p>
                                        )}
                                        {item.note && (
                                            <p className="text-xs text-muted-foreground truncate">
                                                {item.note}
                                            </p>
                                        )}
                                        <div className="mt-2">
                                            <span className={`text-sm font-semibold ${
                                                Number(item.balance) === 0
                                                    ? 'text-green-500'
                                                    : 'text-red-500'
                                            }`}>
                                                {Number(item.balance) === 0
                                                    ? 'Нет долга'
                                                    : `Долг: ${Math.abs(Number(item.balance)).toLocaleString('ru-RU')} ₽`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => loadData(page - 1, activeTab, search)}
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
                        onClick={() => loadData(page + 1, activeTab, search)}
                    >
                        Далее
                    </Button>
                </div>
            )}

            {/* Create Modal */}
            <AnimatePresence>
                {showCreate && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                        onClick={() => setShowCreate(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">Новый контрагент</h2>
                                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Type radio */}
                                <div className="flex gap-3">
                                    <label className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                                        createType === 'SUPPLIER'
                                            ? 'border-orange-500/50 bg-orange-500/5'
                                            : 'border-border hover:bg-muted/50'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="type"
                                            checked={createType === 'SUPPLIER'}
                                            onChange={() => setCreateType('SUPPLIER')}
                                            className="sr-only"
                                        />
                                        <Truck className={`h-4 w-4 ${createType === 'SUPPLIER' ? 'text-orange-500' : 'text-muted-foreground'}`} />
                                        <span className={`text-sm font-medium ${createType === 'SUPPLIER' ? 'text-orange-600 dark:text-orange-400' : ''}`}>Поставщик</span>
                                    </label>
                                    <label className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                                        createType === 'CLIENT'
                                            ? 'border-blue-500/50 bg-blue-500/5'
                                            : 'border-border hover:bg-muted/50'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="type"
                                            checked={createType === 'CLIENT'}
                                            onChange={() => setCreateType('CLIENT')}
                                            className="sr-only"
                                        />
                                        <ShoppingBag className={`h-4 w-4 ${createType === 'CLIENT' ? 'text-blue-500' : 'text-muted-foreground'}`} />
                                        <span className={`text-sm font-medium ${createType === 'CLIENT' ? 'text-blue-600 dark:text-blue-400' : ''}`}>Клиент</span>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Имя *</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <input
                                            value={createName}
                                            onChange={(e) => setCreateName(e.target.value)}
                                            placeholder="Имя контрагента"
                                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Телефон</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <input
                                            value={createPhone}
                                            onChange={(e) => setCreatePhone(e.target.value)}
                                            placeholder="+7 (999) 123-45-67"
                                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Заметка</label>
                                    <div className="relative">
                                        <StickyNote className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <textarea
                                            value={createNote}
                                            onChange={(e) => setCreateNote(e.target.value)}
                                            placeholder="Необязательно"
                                            rows={2}
                                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1">
                                        Отмена
                                    </Button>
                                    <Button
                                        onClick={handleCreate}
                                        isLoading={isCreating}
                                        disabled={!createName.trim()}
                                        className="flex-1"
                                    >
                                        Создать
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

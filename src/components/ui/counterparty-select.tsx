'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Plus, User, Phone, ChevronDown, AlertCircle, Loader2 } from 'lucide-react';
import {
    counterpartyApi,
    CounterpartyResponse,
    CounterpartyType,
    CreateCounterpartyData,
} from '@/lib/api';
import { Button, Input } from '@/components/ui';

interface CounterpartySelectProps {
    accountId: string;
    type: CounterpartyType;
    value: string | null;
    onChange: (id: string | null) => void;
    placeholder?: string;
    showBalance?: boolean;
    allowCreate?: boolean;
}

export function CounterpartySelect({
    accountId,
    type,
    value,
    onChange,
    placeholder,
    showBalance = true,
    allowCreate = true,
}: CounterpartySelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [items, setItems] = useState<CounterpartyResponse[]>([]);
    const [selected, setSelected] = useState<CounterpartyResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createPhone, setCreatePhone] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

    useEffect(() => {
        if (value && !selected) {
            counterpartyApi.getById(value).then(setSelected).catch(() => {});
        }
        if (!value) setSelected(null);
    }, [value]);

    useEffect(() => {
        if (!isOpen) return;
        loadItems(search, 1, false);
        updateDropdownPosition();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleScrollOrResize = () => updateDropdownPosition();
        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);
        return () => {
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [isOpen]);

    const updateDropdownPosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setDropdownStyle({
            position: 'fixed',
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 9999,
        });
    };

    useEffect(() => {
        if (!isOpen) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => loadItems(search, 1, false), 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [search]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                containerRef.current && !containerRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setIsOpen(false);
                setShowCreateForm(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadItems = async (q: string, p: number, append: boolean) => {
        if (append) {
            setIsLoadingMore(true);
        } else {
            setIsLoading(true);
        }
        setError(null);
        try {
            const res = await counterpartyApi.getByAccount(accountId, {
                type,
                search: q.trim() || undefined,
                page: p,
                limit: 20,
            });
            if (append) {
                setItems(prev => [...prev, ...res.items]);
            } else {
                setItems(res.items);
            }
            setPage(res.page);
            setTotalPages(res.totalPages);
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Ошибка загрузки';
            setError(msg);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    const handleScroll = useCallback(() => {
        if (!listRef.current || isLoadingMore || page >= totalPages) return;
        const el = listRef.current;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
            loadItems(search, page + 1, true);
        }
    }, [page, totalPages, isLoadingMore, search]);

    const handleSelect = (item: CounterpartyResponse) => {
        setSelected(item);
        onChange(item.id);
        setIsOpen(false);
        setSearch('');
        setShowCreateForm(false);
    };

    const handleClear = () => {
        setSelected(null);
        onChange(null);
    };

    const handleCreate = async () => {
        if (!createName.trim()) return;
        setIsCreating(true);
        try {
            const created = await counterpartyApi.create({
                name: createName.trim(),
                phone: createPhone.trim() || undefined,
                type,
            });
            handleSelect(created);
            setCreateName('');
            setCreatePhone('');
            setShowCreateForm(false);
        } catch {
            // ignore
        } finally {
            setIsCreating(false);
        }
    };

    const typeLabel = type === 'SUPPLIER' ? 'поставщика' : 'клиента';
    const defaultPlaceholder = type === 'SUPPLIER' ? 'Выберите поставщика...' : 'Выберите клиента...';

    const dropdownContent = isOpen ? (
        <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={dropdownStyle}
            className="rounded-xl border border-border bg-background shadow-lg overflow-hidden"
        >
            <div className="p-2">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Поиск по имени или телефону..."
                        autoFocus
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                </div>
            </div>

            {error && (
                <div className="px-3 pb-2">
                    <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 rounded-lg px-2 py-1.5">
                        <AlertCircle className="h-3 w-3 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            <div
                ref={listRef}
                className="max-h-48 overflow-y-auto"
                onScroll={handleScroll}
            >
                {isLoading ? (
                    <div className="flex justify-center py-4">
                        <motion.div
                            className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                    </div>
                ) : items.length === 0 && !error ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                        {search ? 'Ничего не найдено' : 'Нет контрагентов'}
                    </p>
                ) : (
                    <>
                        {items.map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleSelect(item)}
                                className="w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors flex items-center gap-2"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{item.name}</p>
                                    {item.phone && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Phone className="h-2.5 w-2.5" />
                                            {item.phone}
                                        </p>
                                    )}
                                </div>
                                {showBalance && (
                                    <span className={`text-xs font-medium flex-shrink-0 ${Number(item.balance) === 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {Number(item.balance) === 0 ? '0 ₽' : `${Number(item.balance).toLocaleString('ru-RU')} ₽`}
                                    </span>
                                )}
                            </button>
                        ))}
                        {isLoadingMore && (
                            <div className="flex justify-center py-2">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </>
                )}
            </div>

            {allowCreate && !showCreateForm && (
                <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full px-3 py-2 text-left border-t border-border hover:bg-accent/50 transition-colors flex items-center gap-2 text-primary text-sm font-medium"
                >
                    <Plus className="h-4 w-4" />
                    Создать {typeLabel}
                </button>
            )}

            {allowCreate && showCreateForm && (
                <div className="p-3 border-t border-border space-y-2">
                    <input
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        placeholder="Имя *"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                    <input
                        value={createPhone}
                        onChange={(e) => setCreatePhone(e.target.value)}
                        placeholder="Телефон"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowCreateForm(false)}
                            className="flex-1"
                        >
                            Отмена
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleCreate}
                            isLoading={isCreating}
                            disabled={!createName.trim()}
                            className="flex-1"
                        >
                            Создать
                        </Button>
                    </div>
                </div>
            )}
        </motion.div>
    ) : null;

    return (
        <div ref={containerRef}>
            <div ref={triggerRef}>
            {selected ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{selected.name}</span>
                        {selected.phone && (
                            <span className="text-xs text-muted-foreground ml-2">{selected.phone}</span>
                        )}
                        {showBalance && Number(selected.balance) !== 0 && (
                            <span className={`text-xs ml-2 font-medium ${Number(selected.balance) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                Долг: {Math.abs(Number(selected.balance)).toLocaleString('ru-RU')} ₽
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleClear}
                        className="p-1 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                    >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background text-left hover:bg-muted/50 transition-colors"
                >
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 text-sm text-muted-foreground">{placeholder || defaultPlaceholder}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
            )}

            </div>

            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>{dropdownContent}</AnimatePresence>,
                document.body
            )}
        </div>
    );
}

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Banknote, Store } from 'lucide-react';
import {
    counterpartyApi,
    CounterpartyResponse,
    WarehouseResponse,
    cashRegisterApi,
} from '@/lib/api';
import { Button } from '@/components/ui';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    counterparty: CounterpartyResponse;
    onSuccess: () => void;
    shops?: WarehouseResponse[];
}

export function PaymentModal({ isOpen, onClose, counterparty, onSuccess, shops }: PaymentModalProps) {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [fromCashRegister, setFromCashRegister] = useState(false);
    const [selectedShopId, setSelectedShopId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0) {
            setError('Введите корректную сумму');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            if (fromCashRegister && selectedShopId) {
                if (counterparty.type === 'SUPPLIER') {
                    await cashRegisterApi.paySupplier({
                        shopId: selectedShopId,
                        counterpartyId: counterparty.id,
                        amount: numAmount,
                        description: description || undefined,
                    });
                } else {
                    await cashRegisterApi.receiveFromClient({
                        shopId: selectedShopId,
                        counterpartyId: counterparty.id,
                        amount: numAmount,
                        description: description || undefined,
                    });
                }
            } else {
                await counterpartyApi.payDebt({
                    counterpartyId: counterparty.id,
                    amount: numAmount,
                    description: description || undefined,
                });
            }
            onSuccess();
            onClose();
            setAmount('');
            setDescription('');
            setFromCashRegister(false);
            setSelectedShopId('');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка оплаты');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isSupplier = counterparty.type === 'SUPPLIER';
    const title = isSupplier ? 'Оплата поставщику' : 'Принять оплату от клиента';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">{title}</h2>
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-3 rounded-xl bg-muted/50">
                                <p className="text-sm font-medium">{counterparty.name}</p>
                                <p className={`text-xs mt-1 ${Number(counterparty.balance) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    Текущий долг: {Math.abs(Number(counterparty.balance)).toLocaleString('ru-RU')} ₽
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5">Сумма</label>
                                <div className="relative">
                                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5">Комментарий</label>
                                <input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Необязательно"
                                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                            </div>

                            {shops && shops.length > 0 && (
                                <div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={fromCashRegister}
                                            onChange={(e) => {
                                                setFromCashRegister(e.target.checked);
                                                if (!e.target.checked) setSelectedShopId('');
                                            }}
                                            className="rounded border-border"
                                        />
                                        <span className="text-sm">
                                            {isSupplier ? 'Оплатить из кассы магазина' : 'Принять в кассу магазина'}
                                        </span>
                                    </label>

                                    {fromCashRegister && (
                                        <div className="mt-2 relative">
                                            <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <select
                                                value={selectedShopId}
                                                onChange={(e) => setSelectedShopId(e.target.value)}
                                                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                            >
                                                <option value="">Выберите магазин...</option>
                                                {shops.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {error && (
                                <p className="text-sm text-destructive">{error}</p>
                            )}

                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" onClick={onClose} className="flex-1">
                                    Отмена
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    isLoading={isSubmitting}
                                    disabled={!amount || (fromCashRegister && !selectedShopId)}
                                    className="flex-1"
                                >
                                    {isSupplier ? 'Оплатить' : 'Принять'}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

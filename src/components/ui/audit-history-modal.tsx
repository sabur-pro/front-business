'use client';

import React, { useEffect, useState } from 'react';
import {
    Plus,
    Pencil,
    Trash2,
    RotateCcw,
    PackagePlus,
    Send,
    CheckCircle2,
    XCircle,
    FileText,
    User,
    ArrowRight,
    Clock,
    X,
    Loader2,
    Inbox,
} from 'lucide-react';
import { auditApi, AuditLogResponse } from '@/lib/api';

interface AuditHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    entityType: string;
    entityId: string;
    title?: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
    PRODUCT_CREATED: { label: 'Создание', color: 'text-green-500', Icon: Plus },
    PRODUCT_BATCH_CREATED: { label: 'Приход', color: 'text-emerald-500', Icon: PackagePlus },
    PRODUCT_UPDATED: { label: 'Изменение', color: 'text-blue-500', Icon: Pencil },
    PRODUCT_DELETED: { label: 'Удаление', color: 'text-red-500', Icon: Trash2 },
    PRODUCT_RESTORED: { label: 'Восстановление', color: 'text-purple-500', Icon: RotateCcw },
    SHIPMENT_CREATED: { label: 'Создание отправки', color: 'text-blue-500', Icon: Send },
    SHIPMENT_ACCEPTED: { label: 'Принятие отправки', color: 'text-green-500', Icon: CheckCircle2 },
    SHIPMENT_CANCELLED: { label: 'Отмена отправки', color: 'text-red-500', Icon: XCircle },
};

const FIELD_LABELS: Record<string, string> = {
    sku: 'Артикул',
    photo: 'Фото',
    photoOriginal: 'Фото оригинал',
    sizeRange: 'Размерный ряд',
    boxCount: 'Коробки',
    pairCount: 'Пары',
    priceYuan: 'Цена (¥)',
    priceRub: 'Цена (₽)',
    totalYuan: 'Сумма (¥)',
    totalRub: 'Сумма (₽)',
    barcode: 'Баркод',
    isActive: 'Активен',
    number: 'Номер',
    fromPointId: 'Откуда',
    toPointId: 'Куда',
    itemCount: 'Товаров',
    status: 'Статус',
    warehouseId: 'Склад',
    pointId: 'Точка',
    supplierId: 'Поставщик',
    batchSize: 'Кол-во позиций',
    recommendedSalePrice: 'Рек. цена продажи',
    totalRecommendedSale: 'Итого рек. продажа',
    actualSalePrice: 'Факт. цена продажи',
    totalActualSale: 'Итого факт. продажа',
};

function formatValue(value: any): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
    if (typeof value === 'number') return value.toLocaleString('ru-RU');
    return String(value);
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function AuditHistoryModal({ isOpen, onClose, entityType, entityId, title }: AuditHistoryModalProps) {
    const [logs, setLogs] = useState<AuditLogResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && entityId) {
            setLoading(true);
            setError(null);
            auditApi.getByEntity(entityType, entityId)
                .then(setLogs)
                .catch((err) => setError(err?.response?.data?.message || 'Ошибка загрузки истории'))
                .finally(() => setLoading(false));
        }
    }, [isOpen, entityType, entityId]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />

            {/* Modal */}
            <div
                className="relative w-full max-w-2xl max-h-[85vh] mx-4 rounded-2xl overflow-hidden animate-scale-in"
                style={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="px-6 py-4 flex items-center justify-between"
                    style={{
                        borderBottom: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--muted) / 0.5)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                            {title || 'История изменений'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[hsl(var(--muted))]"
                        style={{ color: 'hsl(var(--muted-foreground))' }}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(85vh - 72px)' }}>
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2
                                className="w-8 h-8 animate-spin"
                                style={{ color: 'hsl(var(--primary))' }}
                            />
                        </div>
                    )}

                    {error && (
                        <div
                            className="text-center py-8 rounded-xl px-4"
                            style={{ background: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}
                        >
                            {error}
                        </div>
                    )}

                    {!loading && !error && logs.length === 0 && (
                        <div className="text-center py-12" style={{ color: 'hsl(var(--muted-foreground))' }}>
                            <Inbox className="h-10 w-10 mx-auto mb-3 opacity-50" />
                            <p>История изменений пуста</p>
                        </div>
                    )}

                    {!loading && !error && logs.length > 0 && (
                        <div className="relative">
                            {/* Timeline line */}
                            <div
                                className="absolute left-[19px] top-2 bottom-2 w-0.5"
                                style={{ background: 'hsl(var(--border))' }}
                            />

                            <div className="space-y-4">
                                {logs.map((log, index) => {
                                    const actionMeta = ACTION_LABELS[log.action] || {
                                        label: log.action,
                                        color: 'text-gray-500',
                                        Icon: FileText,
                                    };
                                    const ActionIcon = actionMeta.Icon;

                                    return (
                                        <div
                                            key={log.id}
                                            className="relative flex gap-4 animate-fade-up"
                                            style={{ animationDelay: `${index * 0.05}s` }}
                                        >
                                            {/* Timeline dot */}
                                            <div
                                                className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                                                style={{
                                                    background: 'hsl(var(--card))',
                                                    border: '2px solid hsl(var(--border))',
                                                }}
                                            >
                                                <ActionIcon className={`h-4 w-4 ${actionMeta.color}`} />
                                            </div>

                                            {/* Content */}
                                            <div
                                                className="flex-1 rounded-xl p-4 transition-all hover:shadow-md"
                                                style={{
                                                    background: 'hsl(var(--muted) / 0.3)',
                                                    border: '1px solid hsl(var(--border) / 0.5)',
                                                }}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={`font-medium text-sm ${actionMeta.color}`}>
                                                        {actionMeta.label}
                                                    </span>
                                                    <span
                                                        className="text-xs flex items-center gap-1"
                                                        style={{ color: 'hsl(var(--muted-foreground))' }}
                                                    >
                                                        <Clock className="h-3 w-3" />
                                                        {formatDate(log.createdAt)}
                                                    </span>
                                                </div>

                                                {/* User */}
                                                <div
                                                    className="text-xs mb-2 flex items-center gap-1"
                                                    style={{ color: 'hsl(var(--muted-foreground))' }}
                                                >
                                                    <User className="h-3 w-3" />
                                                    {log.userName || 'Неизвестный'}
                                                </div>

                                                {/* Changes diff */}
                                                {log.oldData && log.newData && (
                                                    <div className="mt-2 space-y-1">
                                                        {Object.keys(log.newData).map((key) => {
                                                            const oldVal = log.oldData?.[key];
                                                            const newVal = log.newData?.[key];
                                                            const label = FIELD_LABELS[key] || key;
                                                            return (
                                                                <div
                                                                    key={key}
                                                                    className="flex items-center gap-2 text-xs rounded-lg px-3 py-1.5"
                                                                    style={{
                                                                        background: 'hsl(var(--background) / 0.5)',
                                                                    }}
                                                                >
                                                                    <span
                                                                        className="font-medium min-w-[100px]"
                                                                        style={{ color: 'hsl(var(--foreground))' }}
                                                                    >
                                                                        {label}:
                                                                    </span>
                                                                    <span className="text-red-400 line-through">
                                                                        {formatValue(oldVal)}
                                                                    </span>
                                                                    <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                                    <span className="text-green-400 font-medium">
                                                                        {formatValue(newVal)}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* New data only (for CREATE) */}
                                                {log.newData && !log.oldData && (
                                                    <div className="mt-2 space-y-1">
                                                        {Object.entries(log.newData).map(([key, value]) => {
                                                            const label = FIELD_LABELS[key] || key;
                                                            return (
                                                                <div
                                                                    key={key}
                                                                    className="flex items-center gap-2 text-xs rounded-lg px-3 py-1.5"
                                                                    style={{
                                                                        background: 'hsl(var(--background) / 0.5)',
                                                                    }}
                                                                >
                                                                    <span
                                                                        className="font-medium min-w-[100px]"
                                                                        style={{ color: 'hsl(var(--foreground))' }}
                                                                    >
                                                                        {label}:
                                                                    </span>
                                                                    <span className="text-green-400">
                                                                        {formatValue(value)}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Old data only (for DELETE) */}
                                                {log.oldData && !log.newData && (
                                                    <div className="mt-2 space-y-1">
                                                        {Object.entries(log.oldData).map(([key, value]) => {
                                                            const label = FIELD_LABELS[key] || key;
                                                            return (
                                                                <div
                                                                    key={key}
                                                                    className="flex items-center gap-2 text-xs rounded-lg px-3 py-1.5"
                                                                    style={{
                                                                        background: 'hsl(var(--destructive) / 0.05)',
                                                                    }}
                                                                >
                                                                    <span
                                                                        className="font-medium min-w-[100px]"
                                                                        style={{ color: 'hsl(var(--foreground))' }}
                                                                    >
                                                                        {label}:
                                                                    </span>
                                                                    <span className="text-red-400">
                                                                        {formatValue(value)}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Metadata */}
                                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                    <div
                                                        className="mt-2 text-xs rounded-lg px-3 py-2"
                                                        style={{
                                                            background: 'hsl(var(--primary) / 0.05)',
                                                            color: 'hsl(var(--muted-foreground))',
                                                        }}
                                                    >
                                                        {Object.entries(log.metadata).map(([key, value]) => {
                                                            const label = FIELD_LABELS[key] || key;
                                                            return (
                                                                <span key={key} className="mr-4">
                                                                    {label}: <strong>{formatValue(value)}</strong>
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import {
    Package,
    MapPin,
    Plus,
    Trash2,
    Upload,
    ImageIcon,
    X,
    Check,
    ChevronDown,
    FileSpreadsheet,
    AlertCircle,
    Camera,
} from 'lucide-react';
import { Button, Card, Input, CounterpartySelect } from '@/components/ui';
import {
    organizationApi,
    productApi,
    uploadApi,
    PointResponse,
    BatchProductItem,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface ProductRow {
    id: string;
    sku: string;
    photoOriginalFile: File | null;
    photoOriginalPreview: string;
    photoFile: File | null;
    photoPreview: string;
    sizeRange: string;
    boxCount: number;
    pairCount: number;
    priceYuan: number;
    priceRub: number;
    totalYuan: number;
    totalRub: number;
    recommendedSalePrice: number;
    totalRecommendedSale: number;
    actualSalePrice: number;
    totalActualSale: number;
    barcode: string;
}

const emptyRow = (): ProductRow => ({
    id: crypto.randomUUID(),
    sku: '',
    photoOriginalFile: null,
    photoOriginalPreview: '',
    photoFile: null,
    photoPreview: '',
    sizeRange: '',
    boxCount: 0,
    pairCount: 0,
    priceYuan: 0,
    priceRub: 0,
    totalYuan: 0,
    totalRub: 0,
    recommendedSalePrice: 0,
    totalRecommendedSale: 0,
    actualSalePrice: 0,
    totalActualSale: 0,
    barcode: '',
});

export default function ReceiptPage() {
    const { user } = useAuthStore();
    const searchParams = useSearchParams();
    const initialPointId = searchParams.get('pointId') || '';
    const [points, setPoints] = useState<PointResponse[]>([]);
    const [selectedPointId, setSelectedPointId] = useState<string>(initialPointId);
    const [rows, setRows] = useState<ProductRow[]>([emptyRow()]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Supplier & payment
    const [supplierId, setSupplierId] = useState<string | null>(null);
    const [supplierPaidAmount, setSupplierPaidAmount] = useState<number>(0);

    const normalizeSkuPrefix = (char: string): string => {
        const upper = char.toUpperCase();
        if (upper === 'A' || upper === '\u0410') return 'A';
        if (upper === 'B' || upper === '\u0412') return 'B';
        return upper;
    };

    const getWarehouseNameBySku = (sku: string): string | null => {
        const prefix = normalizeSkuPrefix(sku.trim().charAt(0));
        if (prefix === 'A') return 'Мужской';
        if (prefix === 'B') return 'Женский';
        return null;
    };

    const isSkuValid = (sku: string): boolean => {
        if (!sku.trim()) return true;
        return getWarehouseNameBySku(sku) !== null;
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const pointsData = await organizationApi.getPoints();
            setPoints(pointsData);
        } catch (err) {
            console.error('Failed to load data', err);
        } finally {
            setIsLoading(false);
        }
    };

    const updateRow = (id: string, field: keyof ProductRow, value: any) => {
        setRows(prev => prev.map(row => {
            if (row.id !== id) return row;
            const updated = { ...row, [field]: value };
            // Auto-calculate totals
            if (field === 'boxCount' || field === 'pairCount' || field === 'priceYuan' || field === 'priceRub') {
                updated.totalYuan = updated.pairCount * updated.priceYuan;
                updated.totalRub = updated.pairCount * updated.priceRub;
            }
            if (field === 'recommendedSalePrice' || field === 'pairCount') {
                updated.totalRecommendedSale = updated.pairCount * updated.recommendedSalePrice;
            }
            return updated;
        }));
    };

    const handlePhotoUpload = (rowId: string, field: 'photoOriginalFile' | 'photoFile', file: File) => {
        const previewField = field === 'photoOriginalFile' ? 'photoOriginalPreview' : 'photoPreview';
        const reader = new FileReader();
        reader.onloadend = () => {
            setRows(prev => prev.map(row =>
                row.id === rowId
                    ? { ...row, [field]: file, [previewField]: reader.result as string }
                    : row
            ));
        };
        reader.readAsDataURL(file);
    };

    const removeRow = (id: string) => {
        if (rows.length <= 1) return;
        setRows(prev => prev.filter(r => r.id !== id));
    };

    const addRow = () => {
        setRows(prev => [...prev, emptyRow()]);
    };

    // ---- File Upload Parser ----
    const [isParsing, setIsParsing] = useState(false);
    const [parseInfo, setParseInfo] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (file: File) => {
        setIsParsing(true);
        setError(null);
        setParseInfo(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

                if (jsonData.length < 2) {
                    setError('Файл пустой или содержит только заголовки');
                    setIsParsing(false);
                    return;
                }

                // First row is headers, detect column mapping
                const headers = (jsonData[0] as any[]).map((h: any) => String(h || '').toLowerCase().trim());

                // Column index detection - flexible matching
                const findCol = (keywords: string[]): number => {
                    return headers.findIndex(h => keywords.some(k => h.includes(k)));
                };

                const colCode = findCol(['代码', 'code', 'код']);
                const colSku = findCol(['货号', 'article', 'артикул', 'sku']);
                const colPhotoOrig = findCol(['实物照', 'original photo', 'оригинал']);
                const colPhoto = findCol(['图片', 'photo', 'фото']);
                const colSizeRange = findCol(['配码', 'size range', 'размер']);
                const colBoxCount = findCol(['件数', 'number of boxes', 'коробок', 'boxes']);
                const colPairCount = findCol(['双数', 'number of pairs', 'пар', 'pairs']);
                const colPriceYuan = findCol(['单价', 'price', 'цена']);
                const colTotalYuan = findCol(['金额', 'total price', 'total', 'сумма']);

                // Validate required columns
                const missing: string[] = [];
                if (colSku === -1) missing.push('Артикул (货号/article)');
                if (colSizeRange === -1) missing.push('Размерный ряд (配码/size range)');
                if (colBoxCount === -1) missing.push('Коробок (件数/boxes)');
                if (colPairCount === -1) missing.push('Пар (双数/pairs)');
                if (colPriceYuan === -1) missing.push('Цена ¥ (单价/price)');
                if (colTotalYuan === -1) missing.push('Сумма ¥ (金额/total)');

                if (missing.length > 0) {
                    setError(`Не найдены обязательные столбцы: ${missing.join(', ')}`);
                    setIsParsing(false);
                    return;
                }

                // Parse data rows (skip header)
                const parsedRows: ProductRow[] = [];
                let skipped = 0;
                const invalidSkus: string[] = [];

                for (let i = 1; i < jsonData.length; i++) {
                    const r = jsonData[i] as any[];
                    if (!r || r.length === 0) continue;

                    const sku = String(r[colSku] || '').trim();
                    if (!sku) { skipped++; continue; }

                    const skuPrefix = normalizeSkuPrefix(sku.charAt(0));
                    if (skuPrefix !== 'A' && skuPrefix !== 'B') {
                        invalidSkus.push(sku);
                        continue;
                    }

                    const boxCount = parseInt(r[colBoxCount]) || 0;
                    const pairCount = parseInt(r[colPairCount]) || 0;
                    const priceYuan = parseFloat(r[colPriceYuan]) || 0;
                    const totalYuan = parseFloat(r[colTotalYuan]) || 0;

                    parsedRows.push({
                        id: crypto.randomUUID(),
                        sku,
                        photoOriginalFile: null,
                        photoOriginalPreview: colPhotoOrig !== -1 ? String(r[colPhotoOrig] || '').trim() : '',
                        photoFile: null,
                        photoPreview: colPhoto !== -1 ? String(r[colPhoto] || '').trim() : '',
                        sizeRange: colSizeRange !== -1 ? String(r[colSizeRange] || '').trim() : '',
                        boxCount,
                        pairCount,
                        priceYuan,
                        priceRub: 0,
                        totalYuan,
                        totalRub: 0,
                        recommendedSalePrice: 0,
                        totalRecommendedSale: 0,
                        actualSalePrice: 0,
                        totalActualSale: 0,
                        barcode: '',
                    });
                }

                if (parsedRows.length === 0) {
                    setError('Не удалось распарсить ни одной строки с артикулом');
                    setIsParsing(false);
                    return;
                }

                setRows(parsedRows);
                let info = `Загружено ${parsedRows.length} товаров из файла`;
                if (skipped > 0) info += ` (пропущено ${skipped} пустых строк)`;
                if (invalidSkus.length > 0) info += `. Пропущено ${invalidSkus.length} с невалидным артикулом (не A/B): ${invalidSkus.slice(0, 5).join(', ')}${invalidSkus.length > 5 ? '...' : ''}`;
                setParseInfo(info);
            } catch (err: any) {
                setError('Ошибка чтения файла: ' + (err.message || 'неизвестная ошибка'));
            } finally {
                setIsParsing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSubmit = async () => {
        setError(null);
        setSuccess(null);

        if (!selectedPointId) {
            setError('Выберите точку');
            return;
        }

        const validRows = rows.filter(r => r.sku.trim());
        if (validRows.length === 0) {
            setError('Добавьте хотя бы один товар с артикулом');
            return;
        }

        const invalidSkuRows = validRows.filter(r => !isSkuValid(r.sku));
        if (invalidSkuRows.length > 0) {
            setError(`Артикул должен начинаться на A/А (Мужской) или B/В (Женский). Невалидные: ${invalidSkuRows.map(r => r.sku).join(', ')}`);
            return;
        }

        setIsSubmitting(true);

        try {
            // Upload photos first
            const items: BatchProductItem[] = [];

            for (const row of validRows) {
                let photoOriginalUrl: string | undefined;
                let photoUrl: string | undefined;

                if (row.photoOriginalFile) {
                    const uploaded = await uploadApi.uploadPhoto(row.photoOriginalFile);
                    photoOriginalUrl = uploaded.url;
                }
                if (row.photoFile) {
                    const uploaded = await uploadApi.uploadPhoto(row.photoFile);
                    photoUrl = uploaded.url;
                }

                items.push({
                    sku: row.sku,
                    photoOriginal: photoOriginalUrl,
                    photo: photoUrl,
                    sizeRange: row.sizeRange || undefined,
                    boxCount: row.boxCount,
                    pairCount: row.pairCount,
                    priceYuan: row.priceYuan,
                    priceRub: row.priceRub,
                    totalYuan: row.totalYuan,
                    totalRub: row.totalRub,
                    recommendedSalePrice: row.recommendedSalePrice || 0,
                    totalRecommendedSale: row.totalRecommendedSale || 0,
                    actualSalePrice: 0,
                    totalActualSale: 0,
                    barcode: row.barcode || undefined,
                });
            }

            const result = await productApi.batchCreate({
                pointId: selectedPointId,
                supplierId: supplierId || undefined,
                paidAmount: supplierId ? supplierPaidAmount : undefined,
                items,
            });

            setSuccess(`Приход оформлен! Добавлено товаров: ${result.count}`);
            setRows([emptyRow()]);
            setSupplierId(null);
            setSupplierPaidAmount(0);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Ошибка оформления прихода');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Summary calculations
    const totalBoxes = rows.reduce((sum, r) => sum + (r.boxCount || 0), 0);
    const totalPairs = rows.reduce((sum, r) => sum + (r.pairCount || 0), 0);
    const grandTotalYuan = rows.reduce((sum, r) => sum + (r.totalYuan || 0), 0);
    const grandTotalRub = rows.reduce((sum, r) => sum + (r.totalRub || 0), 0);
    const grandTotalRecommended = rows.reduce((sum, r) => sum + (r.totalRecommendedSale || 0), 0);

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

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">Приход товаров</h1>
                <p className="text-muted-foreground">Добавление товаров на склад</p>
            </div>

            {/* Success/Error banners */}
            <AnimatePresence>
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-4 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <Check className="h-5 w-5" />
                            <span>{success}</span>
                        </div>
                        <button onClick={() => setSuccess(null)}>
                            <X className="h-4 w-4" />
                        </button>
                    </motion.div>
                )}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-4 rounded-xl bg-destructive/10 text-destructive flex items-center justify-between"
                    >
                        <span>{error}</span>
                        <button onClick={() => setError(null)}>
                            <X className="h-4 w-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Point Selection */}
            <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Выберите точку</h2>
                <div>
                    <label className="block text-sm font-medium mb-2">Точка</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <select
                            value={selectedPointId}
                            onChange={(e) => setSelectedPointId(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                        >
                            <option value="">Выберите точку...</option>
                            {points.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                </div>
                {selectedPointId && (
                    <div className="mt-4 p-3 rounded-xl bg-blue-500/10 text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium">Склад определяется автоматически по артикулу:</p>
                            <p className="mt-1">Артикул на <span className="font-bold">A/А</span> → склад <span className="font-bold">Мужской</span> | Артикул на <span className="font-bold">B/В</span> → склад <span className="font-bold">Женский</span></p>
                        </div>
                    </div>
                )}

                {/* Supplier selection */}
                {selectedPointId && user?.accountId && (user?.role === 'ORGANIZER' || user?.canManageCounterparties) && (
                    <div className="mt-4 space-y-3">
                        <div>
                            <label className="block text-sm font-medium mb-2">Поставщик (необязательно)</label>
                            <CounterpartySelect
                                accountId={user.accountId}
                                type="SUPPLIER"
                                value={supplierId}
                                onChange={(id) => {
                                    setSupplierId(id);
                                    if (!id) setSupplierPaidAmount(0);
                                }}
                                showBalance
                                allowCreate
                            />
                        </div>
                        {supplierId && (
                            <div>
                                <label className="block text-sm font-medium mb-2">Сумма оплаты поставщику</label>
                                <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={supplierPaidAmount || ''}
                                    onChange={(e) => setSupplierPaidAmount(parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                                    <span className="text-muted-foreground">Итого товаров: <span className="font-bold text-foreground">{grandTotalRub.toLocaleString()} ₽</span></span>
                                    <span className="text-muted-foreground">Оплачено: <span className="font-bold text-green-600 dark:text-green-400">{supplierPaidAmount.toLocaleString()} ₽</span></span>
                                    <span className="text-muted-foreground">Остаток долга: <span className="font-bold text-red-500">{Math.max(0, grandTotalRub - supplierPaidAmount).toLocaleString()} ₽</span></span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Product Rows */}
            {selectedPointId && (
                <div className="space-y-4">
                    {/* File Upload Zone */}
                    <Card className="p-0 overflow-hidden">
                        <label
                            className={`flex flex-col items-center justify-center gap-3 p-6 cursor-pointer transition-colors border-2 border-dashed rounded-xl ${isParsing ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-muted/50 hover:border-primary/20'}`}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const file = e.dataTransfer.files?.[0];
                                if (file) handleFileUpload(file);
                            }}
                        >
                            {isParsing ? (
                                <motion.div
                                    className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                />
                            ) : (
                                <div className="p-3 rounded-xl bg-primary/10">
                                    <FileSpreadsheet className="h-6 w-6 text-primary" />
                                </div>
                            )}
                            <div className="text-center">
                                <p className="font-semibold text-sm">
                                    {isParsing ? 'Обработка файла...' : 'Загрузить файл с товарами'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Формат: .xlsx или .csv — перетащите или нажмите
                                </p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file);
                                }}
                            />
                        </label>
                    </Card>

                    {/* Parse info */}
                    <AnimatePresence>
                        {parseInfo && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-between text-sm"
                            >
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4 flex-shrink-0" />
                                    <span>{parseInfo}</span>
                                </div>
                                <button onClick={() => setParseInfo(null)}>
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Товары ({rows.filter(r => r.sku.trim()).length})</h2>
                        <Button variant="outline" size="sm" onClick={addRow}>
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Добавить вручную
                        </Button>
                    </div>

                    {rows.map((row, index) => (
                        <motion.div
                            key={row.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                        >
                            <Card className="p-3 space-y-2.5">
                                {/* Header: # + delete */}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">#{index + 1}</span>
                                    {rows.length > 1 && (
                                        <button className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors" onClick={() => removeRow(row.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* SKU + Size Range + Barcode */}
                                <div className="grid gap-2 grid-cols-3">
                                    <div>
                                        <label className="text-[10px] text-muted-foreground block mb-0.5">Артикул *</label>
                                        <div className="relative">
                                            <input value={row.sku} onChange={(e) => updateRow(row.id, 'sku', e.target.value)} placeholder="A/А.../B/В..." className={`w-full px-2.5 py-1.5 rounded-md border bg-background text-xs focus:outline-none focus:ring-1 ${row.sku.trim() && !isSkuValid(row.sku) ? 'border-destructive focus:ring-destructive/30 focus:border-destructive' : 'border-border focus:ring-primary/30 focus:border-primary'}`} />
                                            {row.sku.trim() && (
                                                <span className={`absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold px-1 py-0.5 rounded ${isSkuValid(row.sku) ? (getWarehouseNameBySku(row.sku) === 'Мужской' ? 'bg-blue-500/15 text-blue-600' : 'bg-pink-500/15 text-pink-600') : 'bg-destructive/15 text-destructive'}`}>
                                                    {isSkuValid(row.sku) ? getWarehouseNameBySku(row.sku) === 'Мужской' ? 'М' : 'Ж' : '!'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground block mb-0.5">Разм. ряд</label>
                                        <input value={row.sizeRange} onChange={(e) => updateRow(row.id, 'sizeRange', e.target.value)} placeholder="36-41" className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted-foreground block mb-0.5">Баркод</label>
                                        <input value={row.barcode} onChange={(e) => updateRow(row.id, 'barcode', e.target.value)} placeholder="—" className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary" />
                                    </div>
                                </div>

                                {/* Photos inline */}
                                <div className="flex gap-2">
                                    {row.photoOriginalPreview ? (
                                        <div className="relative w-10 h-10 rounded overflow-hidden border border-border flex-shrink-0">
                                            <img src={row.photoOriginalPreview} alt="" className="w-full h-full object-cover" />
                                            <button onClick={() => { updateRow(row.id, 'photoOriginalFile', null); updateRow(row.id, 'photoOriginalPreview', ''); }} className="absolute top-0 right-0 p-0.5 bg-black/50 text-white rounded-bl">
                                                <X className="h-2.5 w-2.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-1 flex-shrink-0">
                                            <label className="w-10 h-10 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted/50">
                                                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(row.id, 'photoOriginalFile', f); }} />
                                            </label>
                                            <label className="w-10 h-10 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted/50">
                                                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(row.id, 'photoOriginalFile', f); }} />
                                            </label>
                                        </div>
                                    )}
                                    {row.photoPreview ? (
                                        <div className="relative w-10 h-10 rounded overflow-hidden border border-border flex-shrink-0">
                                            <img src={row.photoPreview} alt="" className="w-full h-full object-cover" />
                                            <button onClick={() => { updateRow(row.id, 'photoFile', null); updateRow(row.id, 'photoPreview', ''); }} className="absolute top-0 right-0 p-0.5 bg-black/50 text-white rounded-bl">
                                                <X className="h-2.5 w-2.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-1 flex-shrink-0">
                                            <label className="w-10 h-10 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted/50">
                                                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(row.id, 'photoFile', f); }} />
                                            </label>
                                            <label className="w-10 h-10 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted/50">
                                                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(row.id, 'photoFile', f); }} />
                                            </label>
                                        </div>
                                    )}
                                    <div className="flex-1 grid grid-cols-4 gap-1.5">
                                        <div>
                                            <label className="text-[9px] text-muted-foreground block mb-0.5 text-center">Коробок</label>
                                            <input type="text" inputMode="numeric" value={row.boxCount || ''} onChange={(e) => updateRow(row.id, 'boxCount', parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)} placeholder="0" className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/30" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] text-muted-foreground block mb-0.5 text-center">Пар</label>
                                            <input type="text" inputMode="numeric" value={row.pairCount || ''} onChange={(e) => updateRow(row.id, 'pairCount', parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)} placeholder="0" className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/30" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] text-muted-foreground block mb-0.5 text-center">Цена ¥</label>
                                            <input type="text" inputMode="decimal" value={row.priceYuan || ''} onChange={(e) => updateRow(row.id, 'priceYuan', parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0)} placeholder="0" className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/30" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] text-muted-foreground block mb-0.5 text-center">Цена ₽</label>
                                            <input type="text" inputMode="decimal" value={row.priceRub || ''} onChange={(e) => updateRow(row.id, 'priceRub', parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0)} placeholder="0" className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/30" />
                                        </div>
                                    </div>
                                </div>

                                {/* Totals row + recommended sale */}
                                <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                                    <div className="text-center py-1 rounded bg-blue-500/5">
                                        <span className="text-muted-foreground block leading-none mb-0.5">Сумма ¥</span>
                                        <span className="font-bold text-blue-600 dark:text-blue-400">{row.totalYuan.toLocaleString()}</span>
                                    </div>
                                    <div className="text-center py-1 rounded bg-green-500/5">
                                        <span className="text-muted-foreground block leading-none mb-0.5">Сумма ₽</span>
                                        <span className="font-bold text-green-600 dark:text-green-400">{row.totalRub.toLocaleString()}</span>
                                    </div>
                                    <div className="text-center py-1 rounded bg-orange-500/5">
                                        <span className="text-muted-foreground block leading-none mb-0.5">Рек. прод.</span>
                                        <input type="number" min="0" step="0.01" value={row.recommendedSalePrice || ''} onChange={(e) => updateRow(row.id, 'recommendedSalePrice', parseFloat(e.target.value) || 0)} placeholder="0" className="w-full bg-transparent text-center font-bold text-orange-600 dark:text-orange-400 text-[11px] outline-none" />
                                    </div>
                                    <div className="text-center py-1 rounded bg-orange-500/5">
                                        <span className="text-muted-foreground block leading-none mb-0.5">Итого рек.</span>
                                        <span className="font-bold text-orange-600 dark:text-orange-400">{row.totalRecommendedSale.toLocaleString()}</span>
                                    </div>
                                </div>

                            </Card>
                        </motion.div>
                    ))}

                    {/* Summary */}
                    <Card className="p-4 bg-primary/5 border-primary/20">
                        <h3 className="font-semibold mb-2 text-sm">Итого</h3>
                        <div className="grid gap-2 grid-cols-3 md:grid-cols-6 text-xs">
                            <div className="text-center p-1.5 rounded bg-muted/50">
                                <p className="text-muted-foreground text-[10px]">Коробок</p>
                                <p className="text-base font-bold">{totalBoxes}</p>
                            </div>
                            <div className="text-center p-1.5 rounded bg-muted/50">
                                <p className="text-muted-foreground text-[10px]">Пар</p>
                                <p className="text-base font-bold">{totalPairs}</p>
                            </div>
                            <div className="text-center p-1.5 rounded bg-blue-500/5">
                                <p className="text-muted-foreground text-[10px]">Сумма ¥</p>
                                <p className="text-base font-bold text-blue-600 dark:text-blue-400">{grandTotalYuan.toLocaleString()}</p>
                            </div>
                            <div className="text-center p-1.5 rounded bg-green-500/5">
                                <p className="text-muted-foreground text-[10px]">Сумма ₽</p>
                                <p className="text-base font-bold text-green-600 dark:text-green-400">{grandTotalRub.toLocaleString()}</p>
                            </div>
                            <div className="text-center p-1.5 rounded bg-orange-500/5">
                                <p className="text-muted-foreground text-[10px]">Рек. продажа</p>
                                <p className="text-base font-bold text-orange-600 dark:text-orange-400">{grandTotalRecommended.toLocaleString()}</p>
                            </div>
                        </div>
                    </Card>

                    {/* Submit */}
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={addRow}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Добавить вручную
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handleSubmit}
                            isLoading={isSubmitting}
                            disabled={isSubmitting || !selectedPointId}
                        >
                            <Package className="h-4 w-4 mr-2" />
                            Оформить приход ({rows.filter(r => r.sku.trim()).length})
                        </Button>
                    </div>
                </div>
            )}

            {/* Empty state when no point selected */}
            {!selectedPointId && (
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Package className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Выберите точку</h3>
                    <p className="text-muted-foreground">
                        Для оформления прихода выберите точку
                    </p>
                </Card>
            )}
        </div>
    );
}

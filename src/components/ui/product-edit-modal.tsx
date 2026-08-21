'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload } from 'lucide-react';
import { Button } from './button';
import { productApi, uploadApi, ProductResponse, UpdateProductData } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const PAIRS_PER_BOX = 8;

interface ProductEditModalProps {
    product: ProductResponse | null;
    onClose: () => void;
    onSaved: () => void;
}

/**
 * Модалка редактирования товара.
 * Итоговые суммы считаются автоматически от количества пар.
 */
export function ProductEditModal({ product, onClose, onSaved }: ProductEditModalProps) {
    const [form, setForm] = useState<UpdateProductData>({});
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState('');
    const [photoOriginalFile, setPhotoOriginalFile] = useState<File | null>(null);
    const [photoOriginalPreview, setPhotoOriginalPreview] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!product) return;
        setForm({
            sku: product.sku,
            sizeRange: product.sizeRange || undefined,
            boxCount: product.boxCount,
            pairCount: product.pairCount,
            priceYuan: product.priceYuan,
            priceRub: product.priceRub,
            totalYuan: product.totalYuan,
            totalRub: product.totalRub,
            recommendedSalePrice: product.recommendedSalePrice,
            totalRecommendedSale: product.totalRecommendedSale,
            actualSalePrice: product.actualSalePrice,
            totalActualSale: product.totalActualSale,
            barcode: product.barcode || undefined,
        });
        setPhotoFile(null);
        setPhotoPreview(product.photo ? `${API_URL}${product.photo}` : '');
        setPhotoOriginalFile(null);
        setPhotoOriginalPreview(product.photoOriginal ? `${API_URL}${product.photoOriginal}` : '');
        setError(null);
    }, [product]);

    const handleChange = (field: keyof UpdateProductData, value: any) => {
        setForm((prev) => {
            const updated = { ...prev, [field]: value };

            if (field === 'boxCount') {
                updated.pairCount = (Number(value) || 0) * PAIRS_PER_BOX;
            }

            const pairs = field === 'pairCount' ? Number(value) || 0 : updated.pairCount ?? 0;

            if (['boxCount', 'pairCount', 'priceYuan', 'priceRub'].includes(field)) {
                updated.totalYuan = pairs * (updated.priceYuan ?? 0);
                updated.totalRub = pairs * (updated.priceRub ?? 0);
            }
            if (['boxCount', 'pairCount', 'recommendedSalePrice'].includes(field)) {
                updated.totalRecommendedSale = pairs * (updated.recommendedSalePrice ?? 0);
            }
            if (['boxCount', 'pairCount', 'actualSalePrice'].includes(field)) {
                updated.totalActualSale = pairs * (updated.actualSalePrice ?? 0);
            }
            return updated;
        });
    };

    const handlePhotoPick = (type: 'photo' | 'photoOriginal', file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (type === 'photo') {
                setPhotoFile(file);
                setPhotoPreview(reader.result as string);
            } else {
                setPhotoOriginalFile(file);
                setPhotoOriginalPreview(reader.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!product) return;
        setIsSaving(true);
        setError(null);
        try {
            const data: UpdateProductData = { ...form };

            if (photoFile) {
                data.photo = (await uploadApi.uploadPhoto(photoFile)).url;
            } else if (!photoPreview && product.photo) {
                data.photo = null;
            }

            if (photoOriginalFile) {
                data.photoOriginal = (await uploadApi.uploadPhoto(photoOriginalFile)).url;
            } else if (!photoOriginalPreview && product.photoOriginal) {
                data.photoOriginal = null;
            }

            await productApi.update(product.id, data);
            onSaved();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка обновления товара');
        } finally {
            setIsSaving(false);
        }
    };

    const inputClass =
        'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';
    const readonlyClass = 'w-full px-3 py-2 rounded-lg border border-border bg-muted/50 text-sm';

    return (
        <AnimatePresence>
            {product && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="w-full max-w-lg bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 my-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-border/50 flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Редактировать товар</h2>
                            <button onClick={onClose}>
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            {error && (
                                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
                            )}

                            <div>
                                <label className="block text-xs font-medium mb-1 text-muted-foreground">Артикул</label>
                                <input
                                    value={form.sku || ''}
                                    onChange={(e) => handleChange('sku', e.target.value)}
                                    className={inputClass}
                                />
                            </div>

                            <div className="grid gap-3 grid-cols-2">
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Размерный ряд</label>
                                    <input
                                        value={form.sizeRange || ''}
                                        onChange={(e) => handleChange('sizeRange', e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Баркод</label>
                                    <input
                                        value={form.barcode || ''}
                                        onChange={(e) => handleChange('barcode', e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 grid-cols-2">
                                {([
                                    ['photoOriginal', 'Фото оригинал', photoOriginalPreview, setPhotoOriginalFile, setPhotoOriginalPreview],
                                    ['photo', 'Фото товара', photoPreview, setPhotoFile, setPhotoPreview],
                                ] as const).map(([type, label, preview, setFile, setPreview]) => (
                                    <div key={type}>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">{label}</label>
                                        {preview ? (
                                            <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                                                <img src={preview} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => { setFile(null); setPreview(''); }}
                                                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/50 text-white"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border cursor-pointer hover:bg-muted/50 transition-colors text-xs text-muted-foreground">
                                                <Upload className="h-4 w-4" /> Загрузить
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => e.target.files?.[0] && handlePhotoPick(type, e.target.files[0])}
                                                />
                                            </label>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="grid gap-3 grid-cols-2">
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Коробок</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={form.boxCount ?? ''}
                                        onChange={(e) => handleChange('boxCount', parseInt(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Пар</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={form.pairCount ?? ''}
                                        onChange={(e) => handleChange('pairCount', parseInt(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 grid-cols-2">
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Цена ¥</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={form.priceYuan ?? ''}
                                        onChange={(e) => handleChange('priceYuan', parseFloat(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Цена ₽</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={form.priceRub ?? ''}
                                        onChange={(e) => handleChange('priceRub', parseFloat(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 grid-cols-2">
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Итого ¥</label>
                                    <input value={form.totalYuan ?? ''} readOnly className={readonlyClass} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Итого ₽</label>
                                    <input value={form.totalRub ?? ''} readOnly className={readonlyClass} />
                                </div>
                            </div>

                            <div className="grid gap-3 grid-cols-2">
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Рек. продажа/пар</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={form.recommendedSalePrice ?? ''}
                                        onChange={(e) => handleChange('recommendedSalePrice', parseFloat(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Итого рек.</label>
                                    <input value={form.totalRecommendedSale ?? ''} readOnly className={readonlyClass} />
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-border/50 flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={onClose}>
                                Отмена
                            </Button>
                            <Button className="flex-1" isLoading={isSaving} onClick={handleSave}>
                                Сохранить
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

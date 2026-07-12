'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    MapPin,
    ChevronDown,
    Package,
    Plus,
    Minus,
    Trash2,
    ImageIcon,
    X,
    Check,
    SendHorizontal,
    Camera,
    AlertCircle,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import {
    organizationApi,
    productApi,
    shipmentApi,
    uploadApi,
    PointResponse,
    ProductResponse,
    PaginatedProductsResponse,
} from '@/lib/api';
import { Search } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface SelectedProduct {
    id: string;
    product: ProductResponse;
    boxCount: number;
    pairCount: number;
}

export default function CreateShipmentPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();

    // Points
    const [senderPoints, setSenderPoints] = useState<PointResponse[]>([]);
    const [accountPoints, setAccountPoints] = useState<PointResponse[]>([]);
    const [selectedFromPointId, setSelectedFromPointId] = useState('');
    const [selectedToPointId, setSelectedToPointId] = useState('');

    // Products
    const [availableProducts, setAvailableProducts] = useState<ProductResponse[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [productPage, setProductPage] = useState(1);
    const [productTotalPages, setProductTotalPages] = useState(0);
    const [productTotal, setProductTotal] = useState(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
    const PRODUCTS_PER_PAGE = 20;

    // Photos
    const [waybillPhotoFile, setWaybillPhotoFile] = useState<File | null>(null);
    const [waybillPhotoPreview, setWaybillPhotoPreview] = useState('');
    const [transportPhotoFile, setTransportPhotoFile] = useState<File | null>(null);
    const [transportPhotoPreview, setTransportPhotoPreview] = useState('');

    // Note
    const [note, setNote] = useState('');

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push('/login');
    }, [isAuthenticated, authLoading, router]);

    useEffect(() => {
        if (isAuthenticated) loadInitialData();
    }, [isAuthenticated]);

    const loadInitialData = async () => {
        setIsLoading(true);
        try {
            const pointsData = await organizationApi.getPoints();
            setSenderPoints(pointsData);
            if (pointsData.length === 1) {
                setSelectedFromPointId(pointsData[0].id);
            }
        } catch (err) {
            console.error('Failed to load data', err);
        } finally {
            setIsLoading(false);
        }
    };

    // When from-point changes: load account points and products
    useEffect(() => {
        setSelectedToPointId('');
        setAvailableProducts([]);
        setSelectedProducts([]);
        setAccountPoints([]);
        setProductSearch('');
        setProductPage(1);

        if (selectedFromPointId) {
            const senderPoint = senderPoints.find(p => p.id === selectedFromPointId);
            if (senderPoint) {
                organizationApi.getPointsByAccount(senderPoint.accountId).then(pts => {
                    setAccountPoints(pts);
                    const others = pts.filter(p => p.id !== selectedFromPointId);
                    if (others.length === 1) {
                        setSelectedToPointId(others[0].id);
                    }
                }).catch(err => console.error('Failed to load account points', err));
            }
            loadProducts(1, '');
        }
    }, [selectedFromPointId]);

    const loadProducts = async (page: number, search: string, append = false) => {
        if (!selectedFromPointId) return;
        if (append) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingProducts(true);
        }
        try {
            const res = await productApi.searchByPoint(selectedFromPointId, {
                page,
                limit: PRODUCTS_PER_PAGE,
                search: search || undefined,
            });
            if (append) {
                setAvailableProducts(prev => [...prev, ...res.items]);
            } else {
                setAvailableProducts(res.items);
            }
            setProductPage(res.page);
            setProductTotalPages(res.totalPages);
            setProductTotal(res.total);
        } catch (err) {
            console.error('Failed to load products', err);
        } finally {
            setIsLoadingProducts(false);
            setIsLoadingMore(false);
        }
    };

    const handleProductSearchChange = (value: string) => {
        setProductSearch(value);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setProductPage(1);
            loadProducts(1, value);
        }, 400);
    };

    const handleLoadMore = () => {
        const nextPage = productPage + 1;
        loadProducts(nextPage, productSearch, true);
    };


    const addProduct = (product: ProductResponse) => {
        if (selectedProducts.some(sp => sp.product.id === product.id)) return;
        
        const initialBoxCount = product.boxCount > 0 ? 1 : 0;
        const pairsPerBox = product.boxCount > 0 ? product.pairCount / product.boxCount : 0;
        const initialPairCount = Math.round(initialBoxCount * pairsPerBox);

        setSelectedProducts(prev => [
            ...prev,
            {
                id: crypto.randomUUID(),
                product,
                boxCount: initialBoxCount,
                pairCount: initialPairCount,
            },
        ]);
    };

    const removeProduct = (id: string) => {
        setSelectedProducts(prev => prev.filter(sp => sp.id !== id));
    };

    const updateProductBoxCount = (id: string, value: number) => {
        setSelectedProducts(prev => prev.map(sp => {
            if (sp.id !== id) return sp;
            const maxBox = sp.product.boxCount;
            const newBoxCount = Math.min(Math.max(0, value), maxBox);
            const pairsPerBox = sp.product.boxCount > 0
                ? sp.product.pairCount / sp.product.boxCount
                : 0;
            const newPairCount = Math.round(newBoxCount * pairsPerBox);
            return {
                ...sp,
                boxCount: newBoxCount,
                pairCount: newPairCount,
            };
        }));
    };

    const handlePhotoUpload = (type: 'waybill' | 'transport', file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (type === 'waybill') {
                setWaybillPhotoFile(file);
                setWaybillPhotoPreview(reader.result as string);
            } else {
                setTransportPhotoFile(file);
                setTransportPhotoPreview(reader.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        setError(null);
        setSuccess(null);

        if (!selectedFromPointId) {
            setError('Выберите точку отправителя');
            return;
        }
        if (!selectedToPointId) {
            setError('Выберите точку получателя');
            return;
        }
        if (selectedProducts.length === 0) {
            setError('Добавьте хотя бы один товар для отправки');
            return;
        }
        const invalidItems = selectedProducts.filter(sp => sp.boxCount <= 0);
        if (invalidItems.length > 0) {
            setError('Количество коробок должно быть больше 0 для каждого товара');
            return;
        }

        setIsSubmitting(true);
        try {
            let waybillPhotoUrl: string | undefined;
            let transportPhotoUrl: string | undefined;

            if (waybillPhotoFile) {
                const uploaded = await uploadApi.uploadPhoto(waybillPhotoFile);
                waybillPhotoUrl = uploaded.url;
            }
            if (transportPhotoFile) {
                const uploaded = await uploadApi.uploadPhoto(transportPhotoFile);
                transportPhotoUrl = uploaded.url;
            }

            await shipmentApi.create({
                fromPointId: selectedFromPointId,
                toPointId: selectedToPointId,
                waybillPhoto: waybillPhotoUrl,
                transportPhoto: transportPhotoUrl,
                note: note || undefined,
                items: selectedProducts.map(sp => ({
                    productId: sp.product.id,
                    boxCount: sp.boxCount,
                    pairCount: sp.pairCount,
                })),
            });

            setSuccess('Отправка создана успешно!');
            setTimeout(() => router.push('/dashboard/shipments'), 1500);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Ошибка создания отправки');
        } finally {
            setIsSubmitting(false);
        }
    };

    const receiverPoints = accountPoints.filter(p => p.id !== selectedFromPointId);

    // Grand totals
    const grandTotalBoxes = selectedProducts.reduce((sum, sp) => sum + sp.boxCount, 0);
    const grandTotalPairs = selectedProducts.reduce((sum, sp) => sum + sp.pairCount, 0);

    const canSubmit = !!selectedFromPointId && !!selectedToPointId && selectedProducts.length > 0 && grandTotalBoxes > 0;

    if (authLoading || !isAuthenticated || isLoading) {
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
            <div className="flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-xl hover:bg-muted/60 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold">Новая отправка</h1>
                    <p className="text-muted-foreground">Выберите товары и отправьте в другой аккаунт</p>
                </div>
            </div>

            {/* Banners */}
            <AnimatePresence>
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-4 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 flex items-center gap-2"
                    >
                        <Check className="h-5 w-5" />
                        <span>{success}</span>
                    </motion.div>
                )}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-4 rounded-xl bg-destructive/10 text-destructive flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            <span>{error}</span>
                        </div>
                        <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Layout: форма слева, фиксированный блок действий справа */}
            <div className={`grid gap-6 items-start ${selectedProducts.length > 0 ? 'lg:grid-cols-[1fr_360px]' : 'grid-cols-1'}`}>
                <div className="space-y-6 min-w-0">
            {/* FROM: Sender Point */}
            <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <ArrowLeft className="h-5 w-5 text-blue-500 rotate-180" />
                    Откуда отправляем
                </h2>
                <div>
                    <label className="block text-sm font-medium mb-2">Точка</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <select
                            value={selectedFromPointId}
                            onChange={(e) => setSelectedFromPointId(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                        >
                            <option value="">Выберите точку...</option>
                            {senderPoints.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                </div>
            </Card>

            {/* TO: Receiver Point */}
            <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <ArrowLeft className="h-5 w-5 text-green-500 rotate-180" />
                    Куда отправляем
                </h2>
                <div>
                    <label className="block text-sm font-medium mb-2">Точка получателя</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <select
                            value={selectedToPointId}
                            onChange={(e) => setSelectedToPointId(e.target.value)}
                            disabled={!selectedFromPointId}
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors disabled:opacity-50"
                        >
                            <option value="">{selectedFromPointId ? 'Выберите точку...' : 'Сначала выберите точку отправки'}</option>
                            {receiverPoints.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                    Склад получателя определяется автоматически по артикулу: <strong>A/А</strong> → Мужской, <strong>B/В</strong> → Женский
                </p>
            </Card>

            {/* Products Selection */}
            {selectedFromPointId && (
                <Card className="p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Package className="h-5 w-5 text-orange-500" />
                        Товары для отправки
                    </h2>

                    {/* Search */}
                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                value={productSearch}
                                onChange={(e) => handleProductSearchChange(e.target.value)}
                                placeholder="Поиск по артикулу, размерному ряду, баркоду..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                            />
                        </div>
                        {productTotal > 0 && (
                            <p className="mt-1.5 text-xs text-muted-foreground">Найдено товаров: {productTotal}</p>
                        )}
                    </div>

                    {/* Available products */}
                    {isLoadingProducts ? (
                        <div className="flex justify-center p-6">
                            <motion.div
                                className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            />
                        </div>
                    ) : availableProducts.length === 0 ? (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                            {productSearch ? 'Ничего не найдено' : 'Нет товаров на складе'}
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {availableProducts.map(product => {
                                const isSelected = selectedProducts.some(sp => sp.product.id === product.id);
                                return (
                                    <div
                                        key={product.id}
                                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isSelected
                                                ? 'border-primary/50 bg-primary/5'
                                                : 'border-border hover:border-primary/30 hover:bg-muted/30'
                                            }`}
                                        onClick={() => !isSelected && addProduct(product)}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {product.photo ? (
                                                <img
                                                    src={product.photo.startsWith('http') ? product.photo : `${API_URL}${product.photo}`}
                                                    alt={product.sku}
                                                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
                                                    <Package className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{product.sku}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {product.boxCount} кор · {product.pairCount} пар
                                                    {product.sizeRange && ` · ${product.sizeRange}`}
                                                </p>
                                            </div>
                                        </div>
                                        {isSelected ? (
                                            <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5" onClick={(e) => e.stopPropagation()}>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => {
                                                        const sp = selectedProducts.find(s => s.product.id === product.id);
                                                        if (sp) {
                                                            if (sp.boxCount <= 1) {
                                                                removeProduct(sp.id);
                                                            } else {
                                                                updateProductBoxCount(sp.id, sp.boxCount - 1);
                                                            }
                                                        }
                                                    }}
                                                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </button>
                                                <span className="text-xs font-semibold w-6 text-center">
                                                    {selectedProducts.find(s => s.product.id === product.id)?.boxCount}
                                                </span>
                                                <button 
                                                    type="button"
                                                    disabled={selectedProducts.find(s => s.product.id === product.id)?.boxCount === product.boxCount}
                                                    onClick={(e) => {
                                                        const sp = selectedProducts.find(s => s.product.id === product.id);
                                                        if (sp && sp.boxCount < product.boxCount) {
                                                            updateProductBoxCount(sp.id, sp.boxCount + 1);
                                                        }
                                                    }}
                                                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors disabled:opacity-50"
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors flex-shrink-0">
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                            {/* Load more button */}
                            {productPage < productTotalPages && (
                                <Button
                                    variant="outline"
                                    className="w-full mt-2"
                                    size="sm"
                                    isLoading={isLoadingMore}
                                    onClick={handleLoadMore}
                                >
                                    Загрузить ещё ({productTotal - availableProducts.length} осталось)
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Selected products with quantity editing */}
                    {selectedProducts.length > 0 && (
                        <div className="mt-6 space-y-3">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                Выбрано товаров: {selectedProducts.length}
                            </h3>
                            {selectedProducts.map((sp, index) => (
                                <motion.div
                                    key={sp.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="p-3 rounded-xl border border-primary/20 bg-primary/5"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                                            <span className="text-sm font-semibold truncate">{sp.product.sku}</span>
                                            {sp.product.sizeRange && (
                                                <span className="text-xs text-muted-foreground hidden sm:inline">({sp.product.sizeRange})</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => removeProduct(sp.id)}
                                            className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[11px] text-muted-foreground">Коробок (макс {sp.product.boxCount})</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max={sp.product.boxCount}
                                                value={sp.boxCount || ''}
                                                onChange={(e) => updateProductBoxCount(sp.id, parseInt(e.target.value) || 0)}
                                                className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/30"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] text-muted-foreground">Пар (авто)</label>
                                            <div className="w-full px-2.5 py-1.5 rounded-md border border-border bg-muted/30 text-xs text-center text-muted-foreground">
                                                {sp.pairCount}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* Photos */}
            {selectedProducts.length > 0 && (
                <Card className="p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Camera className="h-5 w-5 text-purple-500" />
                        Фотографии
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Waybill Photo */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Фото накладной</label>
                            {waybillPhotoPreview ? (
                                <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border">
                                    <img src={waybillPhotoPreview} alt="Накладная" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => { setWaybillPhotoFile(null); setWaybillPhotoPreview(''); }}
                                        className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-lg"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <label className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/30 cursor-pointer transition-colors">
                                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Галерея</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) handlePhotoUpload('waybill', f);
                                        }} />
                                    </label>
                                    <label className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/30 cursor-pointer transition-colors">
                                        <Camera className="h-6 w-6 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Камера</span>
                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) handlePhotoUpload('waybill', f);
                                        }} />
                                    </label>
                                </div>
                            )}
                        </div>
                        {/* Transport Photo */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Фото транспорта</label>
                            {transportPhotoPreview ? (
                                <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border">
                                    <img src={transportPhotoPreview} alt="Транспорт" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => { setTransportPhotoFile(null); setTransportPhotoPreview(''); }}
                                        className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-lg"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <label className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/30 cursor-pointer transition-colors">
                                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Галерея</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) handlePhotoUpload('transport', f);
                                        }} />
                                    </label>
                                    <label className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/30 cursor-pointer transition-colors">
                                        <Camera className="h-6 w-6 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Камера</span>
                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) handlePhotoUpload('transport', f);
                                        }} />
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            )}

                </div>

                {/* Правый закреплённый блок: комментарий (тянется) + итоги + отправка, до навигации */}
                {selectedProducts.length > 0 && (
                    <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-6rem)]">
                        <Card className="p-5 flex flex-col gap-4 h-full">
                            {/* Комментарий — занимает всё свободное место по высоте */}
                            <div className="flex-1 flex flex-col min-h-0">
                                <label className="block text-sm font-medium mb-2">Комментарий (необязательно)</label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Примечание к отправке..."
                                    className="flex-1 w-full min-h-[140px] px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
                                />
                            </div>

                            {/* Итоги */}
                            <div className="flex-shrink-0">
                                <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Итого</h2>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="text-center p-3 rounded-xl bg-orange-500/10">
                                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{grandTotalBoxes}</p>
                                        <p className="text-xs text-muted-foreground">Коробок</p>
                                    </div>
                                    <div className="text-center p-3 rounded-xl bg-purple-500/10">
                                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{grandTotalPairs}</p>
                                        <p className="text-xs text-muted-foreground">Пар</p>
                                    </div>
                                </div>
                            </div>

                            {/* Отправить */}
                            <Button
                                className="w-full flex-shrink-0"
                                size="lg"
                                isLoading={isSubmitting}
                                disabled={!canSubmit}
                                onClick={handleSubmit}
                            >
                                <SendHorizontal className="h-5 w-5 mr-2" />
                                Отправить товары
                            </Button>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}

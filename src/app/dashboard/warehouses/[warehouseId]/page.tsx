'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Search,
    Package,
    Pencil,
    Trash2,
    X,
    Check,
    ChevronLeft,
    ChevronRight,
    ImageIcon,
    Upload,
    Warehouse,
    MapPin,
    FileText,
    CheckSquare,
    Square,
    Filter,
    History,
} from 'lucide-react';
import { Button, Card, ImageViewer, AuditHistoryModal } from '@/components/ui';
import {
    warehouseApi,
    organizationApi,
    productApi,
    uploadApi,
    WarehouseResponse,
    PointResponse,
    ProductResponse,
    PaginatedProductsResponse,
    UpdateProductData,
    UpdateWarehouseData,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const ITEMS_PER_PAGE = 20;

export default function WarehouseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const warehouseId = params.warehouseId as string;
    const { user } = useAuthStore();
    const { settings, fetchSettings } = useSettingsStore();

    useEffect(() => {
        if (!settings) fetchSettings();
    }, []);

    const canReceipt = user?.role === 'ORGANIZER' || settings?.canAddProducts;
    const isOrganizer = user?.role === 'ORGANIZER';
    const canEditProducts = isOrganizer || !!user?.canEditProducts;
    const canDeleteProducts = isOrganizer || !!user?.canDeleteProducts;

    const [warehouse, setWarehouse] = useState<WarehouseResponse | null>(null);
    const [point, setPoint] = useState<PointResponse | null>(null);
    const [productsData, setProductsData] = useState<PaginatedProductsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Edit modal
    const [editProduct, setEditProduct] = useState<ProductResponse | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editForm, setEditForm] = useState<UpdateProductData>({});
    const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
    const [editPhotoPreview, setEditPhotoPreview] = useState<string>('');
    const [editPhotoOriginalFile, setEditPhotoOriginalFile] = useState<File | null>(null);
    const [editPhotoOriginalPreview, setEditPhotoOriginalPreview] = useState<string>('');

    // Delete confirmation
    const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Multi-select
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

    // Filter: zero boxes
    const [filterZeroBoxes, setFilterZeroBoxes] = useState(false);

    // Warehouse edit/delete
    const [isEditWarehouseOpen, setIsEditWarehouseOpen] = useState(false);
    const [isDeleteWarehouseOpen, setIsDeleteWarehouseOpen] = useState(false);
    const [warehouseEditForm, setWarehouseEditForm] = useState<UpdateWarehouseData>({});
    const [isSavingWarehouse, setIsSavingWarehouse] = useState(false);
    const [isDeletingWarehouse, setIsDeletingWarehouse] = useState(false);

    // Image viewer
    const [viewerImage, setViewerImage] = useState<string | null>(null);
    const [viewerAlt, setViewerAlt] = useState('');

    // History modal
    const [historyProductId, setHistoryProductId] = useState<string | null>(null);

    // Debounce search
    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

    const loadWarehouse = async () => {
        try {
            const wh = await warehouseApi.getById(warehouseId);
            setWarehouse(wh);
            const points = await organizationApi.getPoints();
            const p = points.find((pt) => pt.id === wh.pointId);
            setPoint(p || null);
            return p;
        } catch {
            setError('Не удалось загрузить данные склада');
            return null;
        }
    };

    const loadProducts = useCallback(
        async (whId: string, page: number, search: string, zeroBoxes?: boolean) => {
            try {
                const data = await productApi.searchByWarehouse(whId, {
                    page,
                    limit: ITEMS_PER_PAGE,
                    search: search || undefined,
                    zeroBoxes: zeroBoxes || undefined,
                });
                setProductsData(data);
            } catch {
                setError('Не удалось загрузить товары');
            }
        },
        [],
    );

    useEffect(() => {
        (async () => {
            setIsLoading(true);
            await loadWarehouse();
            await loadProducts(warehouseId, 1, '');
            setIsLoading(false);
        })();
    }, [warehouseId]);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setCurrentPage(1);
            loadProducts(warehouseId, 1, value, filterZeroBoxes);
        }, 400);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        loadProducts(warehouseId, page, searchQuery, filterZeroBoxes);
    };

    const refreshProducts = () => {
        loadProducts(warehouseId, currentPage, searchQuery, filterZeroBoxes);
    };

    const handleToggleZeroBoxes = () => {
        const next = !filterZeroBoxes;
        setFilterZeroBoxes(next);
        setCurrentPage(1);
        setSelectedIds(new Set());
        loadProducts(warehouseId, 1, searchQuery, next);
    };

    // ---- Edit ----
    const openEditModal = (product: ProductResponse) => {
        setEditProduct(product);
        setEditForm({
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
        setEditPhotoFile(null);
        setEditPhotoPreview(product.photo ? `${API_URL}${product.photo}` : '');
        setEditPhotoOriginalFile(null);
        setEditPhotoOriginalPreview(product.photoOriginal ? `${API_URL}${product.photoOriginal}` : '');
        setIsEditModalOpen(true);
    };

    const handleEditFormChange = (field: keyof UpdateProductData, value: any) => {
        setEditForm((prev) => {
            const updated = { ...prev, [field]: value };

            // Auto-calculate pairs if boxCount changes (1 box = 8 pairs)
            if (field === 'boxCount') {
                updated.pairCount = (Number(value) || 0) * 8;
            }

            const activePairCount = field === 'pairCount' ? Number(value) : (updated.pairCount ?? 0);

            if (field === 'boxCount' || field === 'pairCount' || field === 'priceYuan' || field === 'priceRub') {
                const py = field === 'priceYuan' ? Number(value) : (updated.priceYuan ?? 0);
                const pr = field === 'priceRub' ? Number(value) : (updated.priceRub ?? 0);
                updated.totalYuan = activePairCount * py;
                updated.totalRub = activePairCount * pr;
            }
            if (field === 'boxCount' || field === 'pairCount' || field === 'recommendedSalePrice') {
                updated.totalRecommendedSale = activePairCount * (field === 'recommendedSalePrice' ? Number(value) : (updated.recommendedSalePrice ?? 0));
            }
            if (field === 'boxCount' || field === 'pairCount' || field === 'actualSalePrice') {
                updated.totalActualSale = activePairCount * (field === 'actualSalePrice' ? Number(value) : (updated.actualSalePrice ?? 0));
            }
            return updated;
        });
    };

    const handlePhotoUpload = (type: 'photo' | 'photoOriginal', file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (type === 'photo') {
                setEditPhotoFile(file);
                setEditPhotoPreview(reader.result as string);
            } else {
                setEditPhotoOriginalFile(file);
                setEditPhotoOriginalPreview(reader.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleUpdate = async () => {
        if (!editProduct) return;
        setIsUpdating(true);
        setError(null);
        try {
            const updateData: UpdateProductData = { ...editForm };
            if (editPhotoFile) {
                const uploaded = await uploadApi.uploadPhoto(editPhotoFile);
                updateData.photo = uploaded.url;
            } else if (!editPhotoPreview && editProduct.photo) {
                updateData.photo = null;
            }

            if (editPhotoOriginalFile) {
                const uploaded = await uploadApi.uploadPhoto(editPhotoOriginalFile);
                updateData.photoOriginal = uploaded.url;
            } else if (!editPhotoOriginalPreview && editProduct.photoOriginal) {
                updateData.photoOriginal = null;
            }

            await productApi.update(editProduct.id, updateData);
            setSuccess('Товар обновлён');
            setIsEditModalOpen(false);
            refreshProducts();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка обновления товара');
        } finally {
            setIsUpdating(false);
        }
    };

    // ---- Delete ----
    const handleDelete = async () => {
        if (!deleteProductId) return;
        setIsDeleting(true);
        setError(null);
        try {
            await productApi.delete(deleteProductId);
            setSuccess('Товар удалён');
            setDeleteProductId(null);
            refreshProducts();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка удаления товара');
        } finally {
            setIsDeleting(false);
        }
    };

    // ---- Bulk Delete ----
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        const visible = displayProducts;
        if (selectedIds.size === visible.length && visible.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(visible.map(p => p.id)));
        }
    };

    const exitSelectMode = () => {
        setIsSelectMode(false);
        setSelectedIds(new Set());
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        setIsBulkDeleting(true);
        setError(null);
        try {
            const result = await productApi.deleteMany(Array.from(selectedIds));
            setSuccess(`Удалено товаров: ${result.deleted}`);
            setShowBulkDeleteConfirm(false);
            exitSelectMode();
            refreshProducts();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка удаления товаров');
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // ---- Loading / Not found ----
    const openEditWarehouse = () => {
        if (!warehouse) return;
        setWarehouseEditForm({
            name: warehouse.name,
            address: warehouse.address || '',
            description: warehouse.description || '',
        });
        setIsEditWarehouseOpen(true);
    };

    const handleSaveWarehouse = async () => {
        setIsSavingWarehouse(true);
        try {
            const updated = await warehouseApi.update(warehouseId, warehouseEditForm);
            setWarehouse(updated);
            setIsEditWarehouseOpen(false);
            setSuccess('Склад обновлён');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка обновления склада');
        } finally {
            setIsSavingWarehouse(false);
        }
    };

    const handleDeleteWarehouse = async () => {
        setIsDeletingWarehouse(true);
        try {
            await warehouseApi.delete(warehouseId);
            router.back();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка удаления склада');
            setIsDeletingWarehouse(false);
            setIsDeleteWarehouseOpen(false);
        }
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

    if (!warehouse) {
        return (
            <div className="text-center p-12">
                <h2 className="text-xl font-semibold">Склад не найден</h2>
                <Button variant="outline" className="mt-4" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Назад
                </Button>
            </div>
        );
    }

    const products = productsData?.items ?? [];
    const totalPages = productsData?.totalPages ?? 0;
    const total = productsData?.total ?? 0;

    const displayProducts = products;

    // Build all page numbers (no ellipsis)
    const allPageNumbers: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
        allPageNumbers.push(i);
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <Warehouse className="h-5 w-5 text-green-500" />
                        <h1 className="text-2xl font-bold">{warehouse.name}</h1>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        {warehouse.address && (
                            <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {warehouse.address}
                            </span>
                        )}
                        {warehouse.description && (
                            <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" /> {warehouse.description}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canReceipt && (
                        <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/receipt?pointId=${warehouse.pointId}&warehouseId=${warehouseId}`)}>
                            <Package className="h-4 w-4 mr-1.5" />
                            Приход
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={openEditWarehouse}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setIsDeleteWarehouseOpen(true)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Banners */}
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
                        <button onClick={() => setSuccess(null)}><X className="h-4 w-4" /></button>
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
                        <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search + Stats + Filters */}
            <Card className="p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder="Поиск по артикулу, размерному ряду, баркоду..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                        />
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                            onClick={handleToggleZeroBoxes}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${filterZeroBoxes
                                ? 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400'
                                : 'border-border text-muted-foreground hover:bg-muted/50'
                                }`}
                        >
                            <Filter className="h-3.5 w-3.5" />
                            0 коробок
                        </button>
                        {canDeleteProducts && (
                        <button
                            onClick={() => isSelectMode ? exitSelectMode() : setIsSelectMode(true)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${isSelectMode
                                ? 'bg-primary/10 border-primary/30 text-primary'
                                : 'border-border text-muted-foreground hover:bg-muted/50'
                                }`}
                        >
                            <CheckSquare className="h-3.5 w-3.5" />
                            {isSelectMode ? 'Отмена' : 'Выбрать'}
                        </button>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                            <Package className="h-4 w-4" />
                            <span>Всего: <strong className="text-foreground">{total}</strong>{filterZeroBoxes ? ' (0 коробок)' : ''}</span>
                            <span className="text-border">|</span>
                            <span><strong className="text-foreground">{productsData?.totalPairs ?? 0}</strong> пар</span>
                            <span className="text-border">|</span>
                            <span><strong className="text-foreground">{productsData?.totalBoxes ?? 0}</strong> кор</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Bulk actions bar */}
            <AnimatePresence>
                {isSelectMode && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <Card className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={toggleSelectAll}
                                    className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                                >
                                    {selectedIds.size === displayProducts.length && displayProducts.length > 0 ? (
                                        <CheckSquare className="h-4 w-4 text-primary" />
                                    ) : (
                                        <Square className="h-4 w-4" />
                                    )}
                                    {selectedIds.size > 0 ? `Выбрано: ${selectedIds.size}` : 'Выбрать все'}
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={selectedIds.size === 0}
                                    onClick={() => setShowBulkDeleteConfirm(true)}
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                    Удалить ({selectedIds.size})
                                </Button>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Product List */}
            {displayProducts.length === 0 ? (
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Package className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                        {searchQuery || filterZeroBoxes ? 'Ничего не найдено' : 'Нет товаров'}
                    </h3>
                    <p className="text-muted-foreground">
                        {filterZeroBoxes ? 'Нет товаров с 0 коробок' : searchQuery ? 'Попробуйте изменить поисковый запрос' : 'Добавьте товары через раздел "Приход"'}
                    </p>
                </Card>
            ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {displayProducts.map((product, index) => (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                        >
                            <Card
                                className={`p-3 transition-shadow cursor-pointer ${isSelectMode && selectedIds.has(product.id)
                                    ? 'ring-2 ring-primary shadow-md bg-primary/5'
                                    : 'hover:shadow-md'
                                    }`}
                                onClick={() => isSelectMode && toggleSelect(product.id)}
                            >
                                <div className="flex gap-3">
                                    {isSelectMode && (
                                        <div className="flex items-start pt-0.5 flex-shrink-0">
                                            {selectedIds.has(product.id) ? (
                                                <CheckSquare className="h-5 w-5 text-primary" />
                                            ) : (
                                                <Square className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </div>
                                    )}
                                    <div className="flex-shrink-0">
                                        {product.photo ? (
                                            <div
                                                className="relative w-12 h-12 rounded-lg overflow-hidden border border-border cursor-pointer group"
                                                onClick={(e) => { e.stopPropagation(); setViewerImage(`${API_URL}${product.photo}`); setViewerAlt(product.sku); }}
                                            >
                                                <img
                                                    src={`${API_URL}${product.photo}`}
                                                    alt={product.sku}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer" onClick={() => setViewerImage(`${API_URL}${product.photo}`)}>
                                                    <Search className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <h4 className="font-semibold text-sm truncate">{product.sku}</h4>
                                            {!isSelectMode && (
                                                <div className="flex gap-0.5 flex-shrink-0">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setHistoryProductId(product.id)}>
                                                        <History className="h-3 w-3" />
                                                    </Button>
                                                    {canEditProducts && (
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditModal(product)}>
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                    {canDeleteProducts && (
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteProductId(product.id)}>
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {product.sizeRange && (
                                            <p className="text-[11px] text-muted-foreground truncate">{product.sizeRange}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-2 grid grid-cols-4 gap-1 text-[11px]">
                                    <div className="text-center px-1 py-0.5 rounded bg-muted/50">
                                        <span className="text-muted-foreground block leading-tight">Кор</span>
                                        <span className="font-semibold">{product.boxCount}</span>
                                    </div>
                                    <div className="text-center px-1 py-0.5 rounded bg-muted/50">
                                        <span className="text-muted-foreground block leading-tight">Пар</span>
                                        <span className="font-semibold">{product.pairCount}</span>
                                    </div>
                                    <div className="text-center px-1 py-0.5 rounded bg-blue-500/5">
                                        <span className="text-muted-foreground block leading-tight">¥</span>
                                        <span className="font-semibold">{Number(product.priceYuan).toLocaleString()}</span>
                                    </div>
                                    <div className="text-center px-1 py-0.5 rounded bg-green-500/5">
                                        <span className="text-muted-foreground block leading-tight">₽</span>
                                        <span className="font-semibold">{Number(product.priceRub).toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                                    <div className="flex gap-2">
                                        <span className="text-blue-600 dark:text-blue-400 font-medium">¥{Number(product.totalYuan).toLocaleString()}</span>
                                        <span className="text-green-600 dark:text-green-400 font-medium">₽{Number(product.totalRub).toLocaleString()}</span>
                                    </div>
                                    {product.barcode && <span className="text-muted-foreground truncate ml-1">{product.barcode}</span>}
                                </div>
                                {(Number(product.recommendedSalePrice) > 0 || Number(product.actualSalePrice) > 0) && (
                                    <div className="mt-1 grid grid-cols-2 gap-1 text-[10px]">
                                        <div className="text-center px-1 py-0.5 rounded bg-orange-500/5">
                                            <span className="text-muted-foreground">Рек: </span>
                                            <span className="font-semibold text-orange-600 dark:text-orange-400">{Number(product.recommendedSalePrice).toLocaleString()}/пар</span>
                                            <span className="text-muted-foreground"> = </span>
                                            <span className="font-bold text-orange-600 dark:text-orange-400">{Number(product.totalRecommendedSale).toLocaleString()}</span>
                                        </div>
                                        <div className="text-center px-1 py-0.5 rounded bg-muted/40">
                                            <span className="text-muted-foreground">Факт: </span>
                                            <span className="font-semibold">{Number(product.actualSalePrice).toLocaleString()}/пар</span>
                                            <span className="text-muted-foreground"> = </span>
                                            <span className="font-bold">{Number(product.totalActualSale).toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="overflow-x-auto">
                    <div className="flex items-center gap-1 min-w-max py-1 px-1">
                        <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => handlePageChange(currentPage - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {allPageNumbers.map((p) => (
                            <Button key={p} variant={p === currentPage ? 'default' : 'outline'} size="sm" className="min-w-[36px]" onClick={() => handlePageChange(p)}>
                                {p}
                            </Button>
                        ))}
                        <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => handlePageChange(currentPage + 1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteProductId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setDeleteProductId(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-sm bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 p-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-full bg-destructive/10">
                                    <Trash2 className="h-5 w-5 text-destructive" />
                                </div>
                                <h3 className="text-lg font-semibold">Удалить товар?</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                Товар будет помечен как удалённый. Его можно будет восстановить через историю.
                            </p>
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setDeleteProductId(null)}>
                                    Отмена
                                </Button>
                                <Button variant="destructive" className="flex-1" isLoading={isDeleting} onClick={handleDelete}>
                                    Удалить
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bulk Delete Confirmation Modal */}
            <AnimatePresence>
                {showBulkDeleteConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setShowBulkDeleteConfirm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-sm bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 p-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-full bg-destructive/10">
                                    <Trash2 className="h-5 w-5 text-destructive" />
                                </div>
                                <h3 className="text-lg font-semibold">Удалить {selectedIds.size} товаров?</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                Выбранные товары будут помечены как удалённые. Их можно будет восстановить через историю.
                            </p>
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setShowBulkDeleteConfirm(false)}>
                                    Отмена
                                </Button>
                                <Button variant="destructive" className="flex-1" isLoading={isBulkDeleting} onClick={handleBulkDelete}>
                                    Удалить ({selectedIds.size})
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Product Modal */}
            <AnimatePresence>
                {isEditModalOpen && editProduct && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
                        onClick={() => setIsEditModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-lg lg:max-w-[90%] bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 my-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-border/50 flex items-center justify-between">
                                <h2 className="text-lg font-semibold">Редактировать товар</h2>
                                <button onClick={() => setIsEditModalOpen(false)}>
                                    <X className="h-5 w-5 text-muted-foreground" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                {/* SKU */}
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Артикул</label>
                                    <input
                                        value={editForm.sku || ''}
                                        onChange={(e) => handleEditFormChange('sku', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    />
                                </div>

                                {/* Size Range + Barcode */}
                                <div className="grid gap-3 grid-cols-2">
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Размерный ряд</label>
                                        <input
                                            value={editForm.sizeRange || ''}
                                            onChange={(e) => handleEditFormChange('sizeRange', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Баркод</label>
                                        <input
                                            value={editForm.barcode || ''}
                                            onChange={(e) => handleEditFormChange('barcode', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                    </div>
                                </div>

                                {/* Photos */}
                                <div className="grid gap-3 grid-cols-2">
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Фото оригинал</label>
                                        {editPhotoOriginalPreview ? (
                                            <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                                                <img src={editPhotoOriginalPreview} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => { setEditPhotoOriginalFile(null); setEditPhotoOriginalPreview(''); }}
                                                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/50 text-white"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border cursor-pointer hover:bg-muted/50 transition-colors text-xs text-muted-foreground">
                                                <Upload className="h-4 w-4" /> Загрузить
                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePhotoUpload('photoOriginal', e.target.files[0])} />
                                            </label>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Фото товара</label>
                                        {editPhotoPreview ? (
                                            <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                                                <img src={editPhotoPreview} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => { setEditPhotoFile(null); setEditPhotoPreview(''); }}
                                                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/50 text-white"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border cursor-pointer hover:bg-muted/50 transition-colors text-xs text-muted-foreground">
                                                <Upload className="h-4 w-4" /> Загрузить
                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePhotoUpload('photo', e.target.files[0])} />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                {/* Box + Pair counts */}
                                <div className="grid gap-3 grid-cols-2">
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Коробок</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={editForm.boxCount || ''}
                                            onChange={(e) => handleEditFormChange('boxCount', parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Пар</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={editForm.pairCount || ''}
                                            onChange={(e) => handleEditFormChange('pairCount', parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                    </div>
                                </div>

                                {/* Prices */}
                                <div className="grid gap-3 grid-cols-2">
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Цена ¥</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={editForm.priceYuan || ''}
                                            onChange={(e) => handleEditFormChange('priceYuan', parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Цена ₽</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={editForm.priceRub || ''}
                                            onChange={(e) => handleEditFormChange('priceRub', parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                    </div>
                                </div>

                                {/* Totals (auto-calculated) */}
                                <div className="grid gap-3 grid-cols-2">
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Итого ¥</label>
                                        <input
                                            type="number"
                                            value={editForm.totalYuan || ''}
                                            readOnly
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-muted/50 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Итого ₽</label>
                                        <input
                                            type="number"
                                            value={editForm.totalRub || ''}
                                            readOnly
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-muted/50 text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Sale prices */}
                                <div className="grid gap-3 grid-cols-2">
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Рек. продажа/пар</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={editForm.recommendedSalePrice || ''}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                const total = (editForm.pairCount ?? 0) * val;
                                                handleEditFormChange('recommendedSalePrice', val);
                                                handleEditFormChange('totalRecommendedSale', total);
                                            }}
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Итого рек.</label>
                                        <input
                                            type="number"
                                            value={editForm.totalRecommendedSale || ''}
                                            readOnly
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-muted/50 text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-3 grid-cols-2">
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Факт. продажа/пар</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={editForm.actualSalePrice || ''}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                const total = (editForm.pairCount ?? 0) * val;
                                                handleEditFormChange('actualSalePrice', val);
                                                handleEditFormChange('totalActualSale', total);
                                            }}
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Итого факт.</label>
                                        <input
                                            type="number"
                                            value={editForm.totalActualSale || ''}
                                            readOnly
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-muted/50 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-border/50 flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setIsEditModalOpen(false)}>
                                    Отмена
                                </Button>
                                <Button className="flex-1" isLoading={isUpdating} onClick={handleUpdate}>
                                    Сохранить
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Warehouse Modal */}
            <AnimatePresence>
                {isEditWarehouseOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setIsEditWarehouseOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-md bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-border/50 flex items-center justify-between">
                                <h2 className="text-lg font-semibold">Редактировать склад</h2>
                                <button onClick={() => setIsEditWarehouseOpen(false)}>
                                    <X className="h-5 w-5 text-muted-foreground" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Название</label>
                                    <input
                                        value={warehouseEditForm.name || ''}
                                        onChange={(e) => setWarehouseEditForm({ ...warehouseEditForm, name: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Адрес</label>
                                    <input
                                        value={warehouseEditForm.address || ''}
                                        onChange={(e) => setWarehouseEditForm({ ...warehouseEditForm, address: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-muted-foreground">Описание</label>
                                    <input
                                        value={warehouseEditForm.description || ''}
                                        onChange={(e) => setWarehouseEditForm({ ...warehouseEditForm, description: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-border/50 flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setIsEditWarehouseOpen(false)}>
                                    Отмена
                                </Button>
                                <Button className="flex-1" isLoading={isSavingWarehouse} onClick={handleSaveWarehouse}>
                                    Сохранить
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Warehouse Confirmation Modal */}
            <AnimatePresence>
                {isDeleteWarehouseOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setIsDeleteWarehouseOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-sm bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 p-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-full bg-destructive/10">
                                    <Trash2 className="h-5 w-5 text-destructive" />
                                </div>
                                <h3 className="text-lg font-semibold">Удалить склад?</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                Это действие нельзя отменить. Склад и все его данные будут удалены.
                            </p>
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setIsDeleteWarehouseOpen(false)}>
                                    Отмена
                                </Button>
                                <Button variant="destructive" className="flex-1" isLoading={isDeletingWarehouse} onClick={handleDeleteWarehouse}>
                                    Удалить
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Image Viewer */}
            <AnimatePresence>
                {viewerImage && (
                    <ImageViewer src={viewerImage} alt={viewerAlt} onClose={() => setViewerImage(null)} />
                )}
            </AnimatePresence>

            {/* Audit History Modal */}
            <AuditHistoryModal
                isOpen={!!historyProductId}
                onClose={() => setHistoryProductId(null)}
                entityType="PRODUCT"
                entityId={historyProductId || ''}
                title="История товара"
            />
        </div>
    );
}

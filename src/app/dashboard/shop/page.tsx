'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Store,
    ShoppingCart,
    Package,
    Search,
    Trash2,
    Plus,
    CheckCircle2,
    Clock,
    Banknote,
    CreditCard,
} from 'lucide-react';
import { Button, Card, Input, CounterpartySelect } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import {
    warehouseApi,
    organizationApi,
    productApi,
    saleApi,
    WarehouseResponse,
    PointResponse,
    ProductResponse,
    PaymentMethod,
} from '@/lib/api';

interface CartItem {
    product: ProductResponse;
    boxCount: number;
    pairCount: number;
    actualSalePrice: number;
}

export default function ShopPage() {
    const router = useRouter();
    const { user } = useAuthStore();

    const [shops, setShops] = useState<WarehouseResponse[]>([]);
    const [points, setPoints] = useState<PointResponse[]>([]);
    const [selectedShop, setSelectedShop] = useState<WarehouseResponse | null>(null);
    const [products, setProducts] = useState<ProductResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Cart
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [note, setNote] = useState('');
    const [saleCreated, setSaleCreated] = useState<string | null>(null);

    // Client & payment
    const [clientId, setClientId] = useState<string | null>(null);
    const [cashAmount, setCashAmount] = useState<number>(0);
    const [cardAmount, setCardAmount] = useState<number>(0);

    const isOrganizer = user?.role === 'ORGANIZER';
    const totalPaid = cashAmount + cardAmount;

    useEffect(() => {
        loadShops();
    }, []);

    const loadShops = async () => {
        setIsLoading(true);
        try {
            const [warehousesData, pointsData] = await Promise.all([
                warehouseApi.getAll(),
                organizationApi.getPoints(),
            ]);
            setPoints(pointsData);
            const shopsList = warehousesData.filter(w => w.type === 'SHOP');
            setShops(shopsList);

            if (shopsList.length > 0) {
                selectShop(shopsList[0]);
            }
        } catch (err) {
            console.error('Failed to load shops', err);
        } finally {
            setIsLoading(false);
        }
    };

    const selectShop = async (shop: WarehouseResponse) => {
        setSelectedShop(shop);
        setCart([]);
        setSaleCreated(null);
        setSearchQuery('');
        setCashAmount(0);
        setCardAmount(0);
        setIsLoadingProducts(true);
        try {
            const prods = await productApi.searchByWarehouse(shop.id, { page: 1, limit: 500 });
            setProducts(prods.items.filter(p => p.pairCount > 0 || p.boxCount > 0));
        } catch (err) {
            console.error('Failed to load products', err);
        } finally {
            setIsLoadingProducts(false);
        }
    };

    const getPointName = (pointId: string) => points.find(p => p.id === pointId)?.name || '';

    // Cart logic
    const availableProducts = useMemo(() => {
        const usedIds = cart.map(c => c.product.id);
        return products.filter(p => {
            if (usedIds.includes(p.id)) return false;
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                p.sku.toLowerCase().includes(q) ||
                (p.sizeRange || '').toLowerCase().includes(q) ||
                (p.barcode || '').toLowerCase().includes(q)
            );
        });
    }, [products, cart, searchQuery]);

    const PAIRS_PER_BOX = 8;

    const addToCart = (product: ProductResponse) => {
        setCart(prev => [...prev, {
            product,
            boxCount: product.boxCount,
            pairCount: product.boxCount * PAIRS_PER_BOX,
            actualSalePrice: product.recommendedSalePrice || 0,
        }]);
        setSearchQuery('');
    };

    const removeFromCart = (index: number) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    const updateCartItem = (index: number, field: keyof CartItem, value: number) => {
        setCart(prev => prev.map((item, i) => {
            if (i !== index) return item;
            if (field === 'boxCount') {
                return { ...item, boxCount: value, pairCount: value * PAIRS_PER_BOX };
            }
            return { ...item, [field]: value };
        }));
    };

    const totals = useMemo(() => {
        let totalYuan = 0, totalRub = 0, totalRecommended = 0, totalActual = 0;
        for (const item of cart) {
            totalYuan += item.product.priceYuan * item.pairCount;
            totalRub += item.product.priceRub * item.pairCount;
            totalRecommended += (item.product.recommendedSalePrice || 0) * item.pairCount;
            totalActual += item.actualSalePrice * item.pairCount;
        }
        return {
            totalYuan: Math.round(totalYuan * 100) / 100,
            totalRub: Math.round(totalRub * 100) / 100,
            totalRecommended: Math.round(totalRecommended * 100) / 100,
            totalActual: Math.round(totalActual * 100) / 100,
            profit: Math.round((totalActual - totalRub) * 100) / 100,
        };
    }, [cart]);

    const hasDebtWithoutClient = totalPaid < totals.totalActual && totals.totalActual > 0 && !clientId;

    const onSubmitSale = async () => {
        if (cart.length === 0 || !selectedShop) return;
        if (hasDebtWithoutClient) {
            setError('Выберите клиента для оформления долга');
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            const sale = await saleApi.create({
                shopId: selectedShop.id,
                note: note || undefined,
                clientId: clientId || undefined,
                cashAmount,
                cardAmount,
                items: cart.map(item => ({
                    productId: item.product.id,
                    boxCount: item.boxCount,
                    pairCount: item.pairCount,
                    actualSalePrice: item.actualSalePrice,
                })),
            });
            setSaleCreated(sale.number);
            setCart([]);
            setNote('');
            setClientId(null);
            setCashAmount(0);
            setCardAmount(0);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Ошибка создания продажи');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onNewSale = () => {
        setSaleCreated(null);
        if (selectedShop) selectShop(selectedShop);
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

    if (shops.length === 0) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Магазин</h1>
                    <p className="text-muted-foreground">Продажа товаров</p>
                </div>
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                        <Store className="h-8 w-8 text-purple-500" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Нет магазинов</h3>
                    <p className="text-muted-foreground mb-4">
                        {isOrganizer
                            ? 'Создайте магазин в разделе «Склады» с типом «Магазин»'
                            : 'Организатор ещё не создал магазин для вашей точки'}
                    </p>
                    {isOrganizer && (
                        <Button onClick={() => router.push('/dashboard/warehouses')}>
                            <Store className="h-4 w-4 mr-2" />
                            Перейти к складам
                        </Button>
                    )}
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header + top actions */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Магазин</h1>
                    {selectedShop && (
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/shop/sales?shopId=${selectedShop.id}`)}>
                                <Clock className="h-3.5 w-3.5 mr-1.5" />
                                История
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/warehouses/${selectedShop.id}`)}>
                                <Package className="h-3.5 w-3.5 mr-1.5" />
                                Товары
                            </Button>
                        </div>
                    )}
                </div>

                {/* Shop tabs (if multiple) */}
                {shops.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {shops.map(shop => (
                            <button
                                key={shop.id}
                                onClick={() => selectShop(shop)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${selectedShop?.id === shop.id
                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent'
                                    }`}
                            >
                                <Store className="h-3.5 w-3.5" />
                                {shop.name}
                                <span className="text-[10px] opacity-60">{getPointName(shop.pointId)}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Notifications */}
            <AnimatePresence>
                {success && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="p-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
                        {success}
                    </motion.div>
                )}
                {error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex justify-between items-center">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="hover:opacity-70">✕</button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sale created success */}
            {saleCreated && (
                <Card className="p-8 text-center">
                    <div className="mx-auto w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                        <CheckCircle2 className="h-7 w-7 text-green-500" />
                    </div>
                    <h2 className="text-xl font-bold mb-1">Продажа оформлена!</h2>
                    <p className="text-muted-foreground mb-5">Номер: <strong>{saleCreated}</strong></p>
                    <div className="flex gap-3 justify-center">
                        <Button onClick={onNewSale}>
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Новая продажа
                        </Button>
                    </div>
                </Card>
            )}

            {/* Main content: product search + cart */}
            {selectedShop && !saleCreated && (
                <>
                    {isLoadingProducts ? (
                        <div className="flex justify-center p-8">
                            <motion.div
                                className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            />
                        </div>
                    ) : (
                        <>
                            {/* Search & add products */}
                            <Card className="p-4">
                                <div className="relative mb-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Поиск товара по артикулу, размеру, штрихкоду..."
                                        className="pl-10"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                {(searchQuery || cart.length === 0) && availableProducts.length > 0 && (
                                    <div className="max-h-[70vh] overflow-y-auto space-y-1">
                                        {availableProducts.slice(0, 100).map(product => (
                                            <button
                                                key={product.id}
                                                onClick={() => addToCart(product)}
                                                className="w-full p-2.5 text-left rounded-xl border border-border/50 hover:bg-accent/50 transition-colors flex items-center gap-3"
                                            >
                                                {product.photo ? (
                                                    <img src={`${process.env.NEXT_PUBLIC_API_URL}${product.photo}`} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                                        <Package className="h-5 w-5 text-muted-foreground" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{product.sku}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {product.sizeRange && `${product.sizeRange} · `}
                                                        {product.boxCount} кор. / {product.pairCount} пар
                                                    </p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-xs font-medium">Рек: {product.recommendedSalePrice}₽</p>
                                                    {isOrganizer && (
                                                        <p className="text-[10px] text-muted-foreground">{product.priceRub}₽ себ.</p>
                                                    )}
                                                </div>
                                                <Plus className="h-4 w-4 text-primary flex-shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {searchQuery && availableProducts.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-3">Ничего не найдено</p>
                                )}
                            </Card>

                            {/* Cart */}
                            {cart.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                        <ShoppingCart className="h-4 w-4" />
                                        Корзина ({cart.length})
                                    </h3>
                                    {cart.map((item, index) => (
                                        <Card key={item.product.id} className="p-3">
                                            <div className="flex items-start gap-3">
                                                {item.product.photo ? (
                                                    <img src={`${process.env.NEXT_PUBLIC_API_URL}${item.product.photo}`} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                                                ) : (
                                                    <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                                        <Package className="h-5 w-5 text-muted-foreground" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between mb-1.5">
                                                        <div>
                                                            <p className="font-medium text-sm">{item.product.sku}</p>
                                                            <p className="text-[11px] text-muted-foreground">
                                                                {item.product.sizeRange && `${item.product.sizeRange} · `}
                                                                В наличии: {item.product.boxCount} кор. / {item.product.pairCount} пар
                                                            </p>
                                                        </div>
                                                        <button onClick={() => removeFromCart(index)} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="text-[10px] text-muted-foreground block mb-0.5">Коробок</label>
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                value={item.boxCount}
                                                                onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); updateCartItem(index, 'boxCount', Math.min(Number(v) || 0, item.product.boxCount)); }}
                                                                className="w-full rounded-lg border border-border/50 bg-card/80 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-muted-foreground block mb-0.5">Пар (авто)</label>
                                                            <div className="w-full rounded-lg border border-border/30 bg-muted/30 px-2 py-1.5 text-sm text-muted-foreground">
                                                                {item.pairCount}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="mt-2">
                                                        <div className="flex items-center justify-between mb-0.5">
                                                            <label className="text-[10px] font-semibold text-primary block">Факт. цена за пару ₽</label>
                                                            <span className="text-[10px] text-muted-foreground">Рек: {item.product.recommendedSalePrice?.toLocaleString('ru-RU')}₽</span>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={item.actualSalePrice}
                                                            onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); updateCartItem(index, 'actualSalePrice', Number(v) || 0); }}
                                                            className="w-full rounded-lg border-2 border-primary/30 bg-primary/5 px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-end mt-1 text-xs">
                                                        <span className="font-semibold text-foreground">
                                                            Итого: {(item.actualSalePrice * item.pairCount).toLocaleString('ru-RU')}₽
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}

                                    {/* Payment — split (cash + card) */}
                                    <Card className="p-3 space-y-3">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block">Оплата</label>

                                        {/* Quick fill buttons */}
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { setCashAmount(totals.totalActual); setCardAmount(0); }}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${cashAmount === totals.totalActual && cardAmount === 0
                                                    ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30'
                                                    : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                                                    }`}
                                            >
                                                <Banknote className="h-3.5 w-3.5" />
                                                Всё наличными
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setCardAmount(totals.totalActual); setCashAmount(0); }}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${cardAmount === totals.totalActual && cashAmount === 0
                                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                                                    : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                                                    }`}
                                            >
                                                <CreditCard className="h-3.5 w-3.5" />
                                                Всё картой
                                            </button>
                                        </div>

                                        {/* Cash + Card inputs */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] text-muted-foreground block mb-0.5 flex items-center gap-1">
                                                    <Banknote className="h-3 w-3" /> Наличными ₽
                                                </label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={cashAmount || ''}
                                                    onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); setCashAmount(Number(v) || 0); }}
                                                    className="w-full rounded-lg border border-border/50 bg-card/80 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-muted-foreground block mb-0.5 flex items-center gap-1">
                                                    <CreditCard className="h-3 w-3" /> Картой ₽
                                                </label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={cardAmount || ''}
                                                    onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); setCardAmount(Number(v) || 0); }}
                                                    className="w-full rounded-lg border border-border/50 bg-card/80 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>

                                        {/* Payment summary */}
                                        <div className="flex justify-between text-sm pt-1 border-t border-border/30">
                                            <span className="text-muted-foreground">Оплачено</span>
                                            <span className={`font-medium ${totalPaid >= totals.totalActual ? 'text-green-600 dark:text-green-400' : 'text-orange-500'}`}>
                                                {totalPaid.toLocaleString('ru-RU')} ₽
                                            </span>
                                        </div>

                                        {/* Debt indicator */}
                                        {totalPaid < totals.totalActual && totals.totalActual > 0 && (
                                            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-medium">
                                                Долг: {(totals.totalActual - totalPaid).toLocaleString('ru-RU')} ₽
                                                {!clientId && (
                                                    <span className="block mt-0.5 text-[10px] opacity-70">
                                                        Выберите клиента ниже для оформления долга
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </Card>

                                    {/* Client selection */}
                                    {user?.accountId && (user?.role === 'ORGANIZER' || user?.canManageCounterparties) && (
                                        <Card className="p-3 space-y-2">
                                            <label className="text-xs font-medium block">Клиент (необязательно)</label>
                                            <CounterpartySelect
                                                accountId={user.accountId}
                                                type="CLIENT"
                                                value={clientId}
                                                onChange={(id) => setClientId(id)}
                                                showBalance
                                                allowCreate
                                            />
                                        </Card>
                                    )}

                                    {/* Note */}
                                    <Card className="p-3">
                                        <label className="text-xs font-medium block mb-1">Примечание</label>
                                        <input
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            placeholder="Необязательно..."
                                            className="w-full rounded-xl border border-border/50 bg-card/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </Card>

                                    {/* Totals & submit */}
                                    <Card className="p-4">
                                        <div className="space-y-1.5 mb-4">
                                            {isOrganizer && (
                                                <>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Себестоимость (¥)</span>
                                                        <span>{totals.totalYuan.toLocaleString('ru-RU')} ¥</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Себестоимость (₽)</span>
                                                        <span>{totals.totalRub.toLocaleString('ru-RU')} ₽</span>
                                                    </div>
                                                </>
                                            )}
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Рекомендованная</span>
                                                <span>{totals.totalRecommended.toLocaleString('ru-RU')} ₽</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-semibold border-t border-border/50 pt-2">
                                                <span>Итого к оплате</span>
                                                <span className="text-primary">{totals.totalActual.toLocaleString('ru-RU')} ₽</span>
                                            </div>
                                            {totalPaid > 0 && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">Оплачено ({cashAmount > 0 ? `${cashAmount.toLocaleString('ru-RU')}₽ нал` : ''}{cashAmount > 0 && cardAmount > 0 ? ' + ' : ''}{cardAmount > 0 ? `${cardAmount.toLocaleString('ru-RU')}₽ карта` : ''})</span>
                                                    <span className="font-medium">{totalPaid.toLocaleString('ru-RU')} ₽</span>
                                                </div>
                                            )}
                                            {totalPaid < totals.totalActual && totals.totalActual > 0 && (
                                                <div className="flex justify-between text-sm font-semibold text-orange-500">
                                                    <span>Долг</span>
                                                    <span>{(totals.totalActual - totalPaid).toLocaleString('ru-RU')} ₽</span>
                                                </div>
                                            )}
                                            {isOrganizer && (
                                                <div className="flex justify-between text-sm font-semibold">
                                                    <span>Прибыль</span>
                                                    <span className={totals.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}>
                                                        {totals.profit >= 0 ? '+' : ''}{totals.profit.toLocaleString('ru-RU')} ₽
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {hasDebtWithoutClient && (
                                            <div className="p-2 rounded-lg bg-destructive/10 text-destructive text-xs font-medium text-center">
                                                Выберите клиента — без клиента долг оформить нельзя
                                            </div>
                                        )}
                                        <Button className="w-full" onClick={onSubmitSale} isLoading={isSubmitting} disabled={cart.length === 0 || hasDebtWithoutClient}>
                                            <ShoppingCart className="h-4 w-4 mr-2" />
                                            Оформить продажу
                                        </Button>
                                    </Card>
                                </div>
                            )}

                            {/* Empty state */}
                            {cart.length === 0 && products.length === 0 && (
                                <Card className="p-8 text-center">
                                    <div className="mx-auto w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
                                        <Package className="h-7 w-7 text-purple-500" />
                                    </div>
                                    <h3 className="font-semibold mb-1">Нет товаров</h3>
                                    <p className="text-sm text-muted-foreground">В магазине пока нет товаров для продажи</p>
                                </Card>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}

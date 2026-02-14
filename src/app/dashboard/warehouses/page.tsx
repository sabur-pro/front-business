'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Warehouse,
    MapPin,
    Search,
    FileText,
    Plus,
    Package,
    Store,
} from 'lucide-react';
import { Card, Input, Button } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { warehouseApi, organizationApi, WarehouseResponse, PointResponse } from '@/lib/api';

const warehouseSchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    type: z.enum(['WAREHOUSE', 'SHOP']).optional(),
    address: z.string().optional(),
    description: z.string().optional(),
    pointId: z.string().min(1, 'Выберите точку'),
});

type WarehouseFormData = z.infer<typeof warehouseSchema>;

export default function WarehousesPage() {
    const tWarehouses = useTranslations('warehouses');
    const router = useRouter();
    const { user } = useAuthStore();
    const { settings, fetchSettings } = useSettingsStore();

    const [warehouses, setWarehouses] = useState<WarehouseResponse[]>([]);
    const [points, setPoints] = useState<PointResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<WarehouseFormData>({
        resolver: zodResolver(warehouseSchema),
    });

    useEffect(() => {
        loadData();
        fetchSettings();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [warehousesData, pointsData] = await Promise.all([
                warehouseApi.getAll(),
                organizationApi.getPoints(),
            ]);
            setWarehouses(warehousesData);
            setPoints(pointsData);
        } catch (err) {
            console.error('Failed to load warehouses', err);
        } finally {
            setIsLoading(false);
        }
    };

    const getPointName = (pointId: string) => {
        return points.find(p => p.id === pointId)?.name || '';
    };

    const onCreateWarehouse = async (data: WarehouseFormData) => {
        setIsCreating(true);
        setError(null);
        try {
            const newWarehouse = await warehouseApi.create(data);
            setWarehouses([newWarehouse, ...warehouses]);
            setIsCreateModalOpen(false);
            reset();
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Ошибка создания склада');
        } finally {
            setIsCreating(false);
        }
    };

    const filteredWarehouses = warehouses.filter(wh =>
        wh.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (wh.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        getPointName(wh.pointId).toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">{tWarehouses('title')}</h1>
                    <p className="text-muted-foreground">
                        {user?.role === 'ORGANIZER' ? 'Все склады и магазины организации' : 'Склады и магазины ваших точек'}
                    </p>
                </div>
                {user?.role === 'ORGANIZER' && (settings?.canAddWarehouses !== false) && (
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Добавить
                    </Button>
                )}
            </div>

            {/* Search */}
            <Card className="p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Поиск по названию, адресу или точке..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </Card>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <motion.div
                        className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                </div>
            ) : filteredWarehouses.length === 0 ? (
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Warehouse className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{tWarehouses('empty.title')}</h3>
                    <p className="text-muted-foreground">{tWarehouses('empty.description')}</p>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredWarehouses.map((warehouse, index) => (
                        <motion.div
                            key={warehouse.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push(`/dashboard/warehouses/${warehouse.id}`)}>
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-2 rounded-xl ${warehouse.type === 'SHOP' ? 'bg-purple-500/10' : 'bg-green-500/10'}`}>
                                        {warehouse.type === 'SHOP' ? (
                                            <Store className="h-5 w-5 text-purple-500" />
                                        ) : (
                                            <Warehouse className="h-5 w-5 text-green-500" />
                                        )}
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${warehouse.isActive ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                                        {warehouse.isActive ? tWarehouses('active') : tWarehouses('inactive')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold">{warehouse.name}</h3>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${warehouse.type === 'SHOP' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                                        {warehouse.type === 'SHOP' ? 'Магазин' : 'Склад'}
                                    </span>
                                </div>
                                {warehouse.address && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                                        <MapPin className="h-3 w-3" /> {warehouse.address}
                                    </p>
                                )}
                                {warehouse.description && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                                        <FileText className="h-3 w-3" /> {warehouse.description}
                                    </p>
                                )}
                                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        Точка: {getPointName(warehouse.pointId) || 'Неизвестная'}
                                    </p>
                                    {(user?.role === 'ORGANIZER' || settings?.canAddProducts) && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/receipt?pointId=${warehouse.pointId}&warehouseId=${warehouse.id}`); }}
                                        >
                                            <Package className="h-3.5 w-3.5 mr-1.5" />
                                            Приход
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}
            {/* Create Warehouse Modal */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setIsCreateModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-md bg-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-border/50">
                                <h2 className="text-xl font-semibold">Новый склад / магазин</h2>
                            </div>
                            <form onSubmit={handleSubmit(onCreateWarehouse)} className="p-6 space-y-4">
                                {/* Type selector */}
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Тип</label>
                                    <select
                                        {...register('type')}
                                        className="w-full rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="WAREHOUSE">Склад</option>
                                        <option value="SHOP">Магазин</option>
                                    </select>
                                </div>
                                <Input
                                    {...register('name')}
                                    label="Название"
                                    placeholder="Основной склад"
                                    icon={<Warehouse className="h-5 w-5" />}
                                    error={errors.name?.message}
                                />
                                <Input
                                    {...register('address')}
                                    label="Адрес"
                                    placeholder="ул. Складская, 1"
                                    icon={<MapPin className="h-5 w-5" />}
                                />
                                <Input
                                    {...register('description')}
                                    label="Описание"
                                    placeholder="Описание склада"
                                    icon={<FileText className="h-5 w-5" />}
                                />
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Точка</label>
                                    <select
                                        {...register('pointId')}
                                        className="w-full rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="">Выберите точку</option>
                                        {points.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    {errors.pointId && (
                                        <p className="text-xs text-destructive mt-1">{errors.pointId.message}</p>
                                    )}
                                </div>

                                {error && (
                                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsCreateModalOpen(false)}>
                                        Отмена
                                    </Button>
                                    <Button type="submit" className="flex-1" isLoading={isCreating}>
                                        Создать
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

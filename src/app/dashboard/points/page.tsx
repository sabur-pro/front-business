'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    MapPin,
    Plus,
    Warehouse,
    Users,
    ChevronRight,
} from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import {
    organizationApi,
    warehouseApi,
    employeeApi,
    PointResponse,
    AccountResponse,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';

const createPointSchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    address: z.string().optional(),
});

type CreatePointFormData = z.infer<typeof createPointSchema>;

interface PointWithCounts extends PointResponse {
    warehouseCount: number;
    employeeCount: number;
}

export default function PointsPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { settings, fetchSettings } = useSettingsStore();

    const [points, setPoints] = useState<PointWithCounts[]>([]);
    const [accounts, setAccounts] = useState<AccountResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<CreatePointFormData>({
        resolver: zodResolver(createPointSchema),
    });

    useEffect(() => {
        loadData();
        fetchSettings();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [pointsData, accountsData, warehousesData, employeesData] = await Promise.all([
                organizationApi.getPoints(),
                organizationApi.getAccounts(),
                warehouseApi.getAll(),
                employeeApi.getAll(),
            ]);

            const enriched: PointWithCounts[] = pointsData.map(p => ({
                ...p,
                warehouseCount: warehousesData.filter(w => w.pointId === p.id).length,
                employeeCount: 0,
            }));

            // Load employee counts per point
            for (const point of enriched) {
                try {
                    const pointEmployees = await employeeApi.getByPoint(point.id);
                    point.employeeCount = pointEmployees.length;
                } catch {
                    // ignore
                }
            }

            setPoints(enriched);
            setAccounts(accountsData);
        } catch (err) {
            console.error('Failed to load points', err);
        } finally {
            setIsLoading(false);
        }
    };

    const onCreatePoint = async (data: CreatePointFormData) => {
        setIsCreating(true);
        setError(null);
        try {
            if (accounts.length === 0) {
                throw new Error('Нет организации');
            }
            const newPoint = await organizationApi.createPoint(accounts[0].id, data);
            setPoints([{ ...newPoint, warehouseCount: 0, employeeCount: 0 }, ...points]);
            setIsModalOpen(false);
            reset();
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Ошибка создания точки');
        } finally {
            setIsCreating(false);
        }
    };

    if (user?.role !== 'ORGANIZER') {
        return (
            <div className="p-8 text-center text-muted-foreground">
                Доступ запрещен.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Точки</h1>
                    <p className="text-muted-foreground">Управление торговыми точками и филиалами</p>
                </div>
                {(settings?.canAddPoints !== false) && (
                    <Button onClick={() => setIsModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Создать точку
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <motion.div
                        className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                </div>
            ) : points.length === 0 ? (
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <MapPin className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Нет точек</h3>
                    <p className="text-muted-foreground mb-6">
                        Создайте первую точку, чтобы добавлять склады и назначать сотрудников.
                    </p>
                    <Button onClick={() => setIsModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Создать точку
                    </Button>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {points.map((point, index) => (
                        <motion.div
                            key={point.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Card
                                className="p-6 hover:shadow-lg transition-shadow cursor-pointer group"
                                onClick={() => router.push(`/dashboard/points/${point.id}`)}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-2 rounded-xl bg-primary/10">
                                        <MapPin className="h-5 w-5 text-primary" />
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <h3 className="font-semibold text-lg mb-1">{point.name}</h3>
                                {point.address && (
                                    <p className="text-sm text-muted-foreground mb-4">{point.address}</p>
                                )}
                                <div className="flex gap-4 pt-4 border-t text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1.5">
                                        <Warehouse className="h-4 w-4" />
                                        <span>{point.warehouseCount} складов</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Users className="h-4 w-4" />
                                        <span>{point.employeeCount} сотр.</span>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Create Point Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setIsModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-md bg-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-border/50">
                                <h2 className="text-xl font-semibold">Новая точка</h2>
                            </div>
                            <form onSubmit={handleSubmit(onCreatePoint)} className="p-6 space-y-4">
                                <Input
                                    {...register('name')}
                                    label="Название"
                                    placeholder="Главный офис"
                                    icon={<MapPin className="h-5 w-5" />}
                                    error={errors.name?.message}
                                />
                                <Input
                                    {...register('address')}
                                    label="Адрес"
                                    placeholder="ул. Ленина, 1"
                                />

                                {error && (
                                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
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

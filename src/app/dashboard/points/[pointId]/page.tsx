'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    MapPin,
    Warehouse,
    Users,
    Plus,
    ArrowLeft,
    Trash2,
    UserPlus,
    UserMinus,
    FileText,
    Pencil,
    Check,
    X,
} from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import {
    organizationApi,
    warehouseApi,
    employeeApi,
    PointResponse,
    WarehouseResponse,
    EmployeeResponse,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';

const warehouseSchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    address: z.string().optional(),
    description: z.string().optional(),
});

type WarehouseFormData = z.infer<typeof warehouseSchema>;

const editPointSchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    address: z.string().optional(),
});

type EditPointFormData = z.infer<typeof editPointSchema>;

const createEmployeeSchema = z.object({
    email: z.string().email('Некорректный email'),
    password: z.string().min(6, 'Минимум 6 символов'),
    firstName: z.string().min(1, 'Имя обязательно'),
    lastName: z.string().min(1, 'Фамилия обязательна'),
    phone: z.string().optional(),
});

type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>;

type Tab = 'warehouses' | 'employees';

export default function PointDetailPage() {
    const params = useParams();
    const router = useRouter();
    const pointId = params.pointId as string;
    const { user } = useAuthStore();

    const [point, setPoint] = useState<PointResponse | null>(null);
    const [warehouses, setWarehouses] = useState<WarehouseResponse[]>([]);
    const [pointEmployees, setPointEmployees] = useState<EmployeeResponse[]>([]);
    const [allEmployees, setAllEmployees] = useState<EmployeeResponse[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>('warehouses');
    const [isLoading, setIsLoading] = useState(true);
    const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isCreateEmployeeModalOpen, setIsCreateEmployeeModalOpen] = useState(false);
    const [isEditingPoint, setIsEditingPoint] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { settings, fetchSettings } = useSettingsStore();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<WarehouseFormData>({
        resolver: zodResolver(warehouseSchema),
    });

    const {
        register: registerEdit,
        handleSubmit: handleEditSubmit,
        reset: resetEdit,
        formState: { errors: editErrors },
    } = useForm<EditPointFormData>({
        resolver: zodResolver(editPointSchema),
    });

    const {
        register: registerEmployee,
        handleSubmit: handleEmployeeSubmit,
        reset: resetEmployee,
        formState: { errors: employeeErrors },
    } = useForm<CreateEmployeeFormData>({
        resolver: zodResolver(createEmployeeSchema),
    });

    useEffect(() => {
        loadData();
        fetchSettings();
    }, [pointId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [pointsData, warehousesData, pointEmps, allEmps] = await Promise.all([
                organizationApi.getPoints(),
                warehouseApi.getByPoint(pointId),
                employeeApi.getByPoint(pointId),
                employeeApi.getAll(),
            ]);

            const foundPoint = pointsData.find(p => p.id === pointId);
            setPoint(foundPoint || null);
            setWarehouses(warehousesData);
            setPointEmployees(pointEmps);
            setAllEmployees(allEmps);
        } catch (err) {
            console.error('Failed to load point data', err);
        } finally {
            setIsLoading(false);
        }
    };

    const onCreateWarehouse = async (data: WarehouseFormData) => {
        setIsCreating(true);
        setError(null);
        try {
            const newWarehouse = await warehouseApi.create({ ...data, pointId });
            setWarehouses([newWarehouse, ...warehouses]);
            setIsWarehouseModalOpen(false);
            reset();
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Ошибка создания склада');
        } finally {
            setIsCreating(false);
        }
    };

    const onDeleteWarehouse = async (warehouseId: string) => {
        if (!confirm('Удалить склад?')) return;
        try {
            await warehouseApi.delete(warehouseId);
            setWarehouses(warehouses.filter(w => w.id !== warehouseId));
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка удаления склада');
        }
    };

    const onAssignEmployee = async (employeeId: string) => {
        setIsCreating(true);
        try {
            await employeeApi.assignPoint(employeeId, pointId);
            const emp = allEmployees.find(e => e.id === employeeId);
            if (emp) setPointEmployees([...pointEmployees, emp]);
            setIsAssignModalOpen(false);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка назначения');
        } finally {
            setIsCreating(false);
        }
    };

    const onUnassignEmployee = async (employeeId: string) => {
        if (!confirm('Снять сотрудника с этой точки?')) return;
        try {
            await employeeApi.unassignPoint(employeeId, pointId);
            setPointEmployees(pointEmployees.filter(e => e.id !== employeeId));
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка снятия назначения');
        }
    };

    const onEditPoint = async (data: EditPointFormData) => {
        setIsCreating(true);
        setError(null);
        try {
            const updated = await organizationApi.updatePoint(pointId, data);
            setPoint(updated);
            setIsEditingPoint(false);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка обновления точки');
        } finally {
            setIsCreating(false);
        }
    };

    const onCreateEmployeeInPoint = async (data: CreateEmployeeFormData) => {
        setIsCreating(true);
        setError(null);
        try {
            const newEmp = await employeeApi.create(data);
            await employeeApi.assignPoint(newEmp.id, pointId);
            setPointEmployees([...pointEmployees, newEmp]);
            setAllEmployees([...allEmployees, newEmp]);
            setIsCreateEmployeeModalOpen(false);
            resetEmployee();
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Ошибка создания сотрудника');
        } finally {
            setIsCreating(false);
        }
    };

    const unassignedEmployees = allEmployees.filter(
        e => !pointEmployees.some(pe => pe.id === e.id)
    );

    if (user?.role !== 'ORGANIZER') {
        return <div className="p-8 text-center text-muted-foreground">Доступ запрещен.</div>;
    }

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

    if (!point) {
        return <div className="p-8 text-center text-muted-foreground">Точка не найдена.</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/points')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                {isEditingPoint ? (
                    <form onSubmit={handleEditSubmit(onEditPoint)} className="flex-1 space-y-2">
                        <Input
                            {...registerEdit('name')}
                            placeholder="Название точки"
                            defaultValue={point.name}
                            error={editErrors.name?.message}
                        />
                        <Input
                            {...registerEdit('address')}
                            placeholder="Адрес"
                            defaultValue={point.address || ''}
                        />
                        <div className="flex gap-2">
                            <Button type="submit" size="sm" isLoading={isCreating}>
                                <Check className="h-4 w-4 mr-1" /> Сохранить
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditingPoint(false)}>
                                <X className="h-4 w-4 mr-1" /> Отмена
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="flex-1 flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">{point.name}</h1>
                            {point.address && (
                                <p className="text-muted-foreground flex items-center gap-1 mt-1">
                                    <MapPin className="h-4 w-4" />
                                    {point.address}
                                </p>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                resetEdit({ name: point.name, address: point.address || '' });
                                setIsEditingPoint(true);
                            }}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Error Banner */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex justify-between items-center"
                >
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="hover:opacity-70">✕</button>
                </motion.div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-green-500/10">
                        <Warehouse className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{warehouses.length}</p>
                        <p className="text-sm text-muted-foreground">Складов</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/10">
                        <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{pointEmployees.length}</p>
                        <p className="text-sm text-muted-foreground">Сотрудников</p>
                    </div>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('warehouses')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'warehouses'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <Warehouse className="h-4 w-4 inline mr-2" />
                    Склады
                </button>
                <button
                    onClick={() => setActiveTab('employees')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'employees'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <Users className="h-4 w-4 inline mr-2" />
                    Сотрудники
                </button>
            </div>

            {/* Warehouses Tab */}
            {activeTab === 'warehouses' && (
                <div className="space-y-4">
                    {(settings?.canAddWarehouses !== false) && (
                        <div className="flex justify-end">
                            <Button onClick={() => setIsWarehouseModalOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Добавить склад
                            </Button>
                        </div>
                    )}
                    {warehouses.length === 0 ? (
                        <Card className="p-8 text-center">
                            <Warehouse className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">Нет складов в этой точке</p>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {warehouses.map((wh, i) => (
                                <motion.div
                                    key={wh.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <Card className="p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="p-2 rounded-xl bg-green-500/10">
                                                <Warehouse className="h-5 w-5 text-green-500" />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:bg-destructive/10"
                                                onClick={() => onDeleteWarehouse(wh.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <h4 className="font-semibold mb-1">{wh.name}</h4>
                                        {wh.address && (
                                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                <MapPin className="h-3 w-3" /> {wh.address}
                                            </p>
                                        )}
                                        {wh.description && (
                                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                                <FileText className="h-3 w-3" /> {wh.description}
                                            </p>
                                        )}
                                        <div className="mt-3">
                                            <span className={`text-xs px-2 py-1 rounded-full ${wh.isActive ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                                                {wh.isActive ? 'Активен' : 'Неактивен'}
                                            </span>
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Employees Tab */}
            {activeTab === 'employees' && (
                <div className="space-y-4">
                    <div className="flex justify-end gap-2">
                        {(settings?.canAddEmployees !== false) && (
                            <Button variant="outline" onClick={() => setIsCreateEmployeeModalOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Создать сотрудника
                            </Button>
                        )}
                        <Button onClick={() => setIsAssignModalOpen(true)}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Назначить сотрудника
                        </Button>
                    </div>
                    {pointEmployees.length === 0 ? (
                        <Card className="p-8 text-center">
                            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">Нет сотрудников в этой точке</p>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {pointEmployees.map((emp, i) => (
                                <motion.div
                                    key={emp.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <Card className="p-5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                                    {emp.firstName[0]}{emp.lastName[0]}
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold">{emp.fullName}</h4>
                                                    <p className="text-xs text-muted-foreground">{emp.email}</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:bg-destructive/10"
                                                onClick={() => onUnassignEmployee(emp.id)}
                                                title="Снять с точки"
                                            >
                                                <UserMinus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Create Warehouse Modal */}
            <AnimatePresence>
                {isWarehouseModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setIsWarehouseModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-md bg-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-border/50">
                                <h2 className="text-xl font-semibold">Новый склад</h2>
                            </div>
                            <form onSubmit={handleSubmit(onCreateWarehouse)} className="p-6 space-y-4">
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

                                {error && (
                                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsWarehouseModalOpen(false)}>
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

            {/* Assign Employee Modal */}
            <AnimatePresence>
                {isAssignModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setIsAssignModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-sm bg-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-border/50">
                                <h2 className="text-xl font-semibold">Назначить сотрудника</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    Выберите сотрудника для назначения на эту точку.
                                </p>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {unassignedEmployees.map(emp => (
                                        <button
                                            key={emp.id}
                                            onClick={() => onAssignEmployee(emp.id)}
                                            className="w-full p-3 text-left rounded-xl border border-border/50 hover:bg-accent/50 transition-colors flex items-center gap-3"
                                            disabled={isCreating}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                {emp.firstName[0]}{emp.lastName[0]}
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">{emp.fullName}</div>
                                                <div className="text-xs text-muted-foreground">{emp.email}</div>
                                            </div>
                                        </button>
                                    ))}
                                    {unassignedEmployees.length === 0 && (
                                        <div className="text-center py-4 text-muted-foreground text-sm">
                                            Все сотрудники уже назначены на эту точку
                                        </div>
                                    )}
                                </div>
                                <Button variant="outline" className="w-full" onClick={() => setIsAssignModalOpen(false)}>
                                    Закрыть
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create Employee Modal */}
            <AnimatePresence>
                {isCreateEmployeeModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setIsCreateEmployeeModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-md bg-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-border/50">
                                <h2 className="text-xl font-semibold">Новый сотрудник</h2>
                                <p className="text-sm text-muted-foreground mt-1">Будет создан и назначен на эту точку</p>
                            </div>
                            <form onSubmit={handleEmployeeSubmit(onCreateEmployeeInPoint)} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        {...registerEmployee('firstName')}
                                        label="Имя"
                                        placeholder="Иван"
                                        error={employeeErrors.firstName?.message}
                                    />
                                    <Input
                                        {...registerEmployee('lastName')}
                                        label="Фамилия"
                                        placeholder="Иванов"
                                        error={employeeErrors.lastName?.message}
                                    />
                                </div>
                                <Input
                                    {...registerEmployee('phone')}
                                    label="Телефон"
                                    placeholder="+7..."
                                />
                                <Input
                                    {...registerEmployee('email')}
                                    label="Email"
                                    type="email"
                                    placeholder="ivan@example.com"
                                    error={employeeErrors.email?.message}
                                />
                                <Input
                                    {...registerEmployee('password')}
                                    label="Пароль"
                                    type="password"
                                    placeholder="******"
                                    error={employeeErrors.password?.message}
                                />

                                {error && (
                                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsCreateEmployeeModalOpen(false)}>
                                        Отмена
                                    </Button>
                                    <Button type="submit" className="flex-1" isLoading={isCreating}>
                                        Создать и назначить
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

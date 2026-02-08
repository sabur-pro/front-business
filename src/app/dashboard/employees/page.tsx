'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Users,
    UserPlus,
    MapPin,
    Search,
    MoreVertical,
    Shield,
    Phone,
    Mail,
    Trash2,
    Check,
    UserMinus,
    X,
} from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { employeeApi, organizationApi, EmployeeResponse, PointResponse } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';

const createEmployeeSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
});

type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>;

export default function EmployeesPage() {
    const t = useTranslations('employees');
    const tCommon = useTranslations('common');
    const { user } = useAuthStore();
    const { settings, fetchSettings } = useSettingsStore();

    // State
    const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
    const [points, setPoints] = useState<PointResponse[]>([]);
    const [employeePointMap, setEmployeePointMap] = useState<Record<string, { pointId: string; pointName: string }[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

    // Forms
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<CreateEmployeeFormData>({
        resolver: zodResolver(createEmployeeSchema),
    });

    useEffect(() => {
        loadData();
        fetchSettings();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [employeesData, pointsData] = await Promise.all([
                employeeApi.getAll(),
                organizationApi.getPoints(),
            ]);
            setEmployees(employeesData);
            setPoints(pointsData);

            // Build employee -> points map
            const map: Record<string, { pointId: string; pointName: string }[]> = {};
            const pointEmpPromises = pointsData.map(async (pt) => {
                try {
                    const emps = await employeeApi.getByPoint(pt.id);
                    emps.forEach((emp) => {
                        if (!map[emp.id]) map[emp.id] = [];
                        map[emp.id].push({ pointId: pt.id, pointName: pt.name });
                    });
                } catch { }
            });
            await Promise.all(pointEmpPromises);
            setEmployeePointMap(map);
        } catch (error) {
            console.error('Failed to load employees', error);
        } finally {
            setIsLoading(false);
        }
    };

    const onCreateEmployee = async (data: CreateEmployeeFormData) => {
        setIsSubmitting(true);
        setError(null);
        try {
            const newEmployee = await employeeApi.create(data);
            setEmployees([newEmployee, ...employees]);
            setIsCreateModalOpen(false);
            reset();
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Ошибка создания сотрудника');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onAssignPoint = async (pointId: string) => {
        if (!selectedEmployeeId) return;

        setIsSubmitting(true);
        setError(null);
        try {
            await employeeApi.assignPoint(selectedEmployeeId, pointId);
            const emp = employees.find(e => e.id === selectedEmployeeId);
            const pt = points.find(p => p.id === pointId);
            setAssignSuccess(`${emp?.fullName || 'Сотрудник'} назначен на ${pt?.name || 'точку'}`);

            // Update local map
            setEmployeePointMap(prev => ({
                ...prev,
                [selectedEmployeeId!]: [
                    ...(prev[selectedEmployeeId!] || []),
                    { pointId, pointName: pt?.name || '' },
                ],
            }));

            setIsAssignModalOpen(false);
            setSelectedEmployeeId(null);
            setTimeout(() => setAssignSuccess(null), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Ошибка назначения точки');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onDeleteEmployee = async (employeeId: string) => {
        if (!confirm('Вы уверены, что хотите удалить сотрудника?')) return;
        try {
            await employeeApi.delete(employeeId);
            setEmployees(employees.filter(e => e.id !== employeeId));
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Ошибка удаления сотрудника');
        }
    };

    const onUnassignPoint = async (employeeId: string, pointId: string) => {
        try {
            await employeeApi.unassignPoint(employeeId, pointId);
            setEmployeePointMap(prev => ({
                ...prev,
                [employeeId]: (prev[employeeId] || []).filter(p => p.pointId !== pointId),
            }));
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Ошибка снятия назначения');
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getEmployeePoints = (empId: string) => employeePointMap[empId] || [];

    // For the assign modal, filter out points that the selected employee is already assigned to
    const getUnassignedPoints = () => {
        if (!selectedEmployeeId) return points;
        const assigned = getEmployeePoints(selectedEmployeeId).map(p => p.pointId);
        return points.filter(p => !assigned.includes(p.id));
    };

    if (user?.role !== 'ORGANIZER') {
        return (
            <div className="p-8 text-center text-muted-foreground">
                Доступ запрещен. Только организаторы могут управлять сотрудниками.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Сотрудники</h1>
                    <p className="text-muted-foreground">Управление персоналом и доступами</p>
                </div>
                {(settings?.canAddEmployees !== false) && (
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Добавить сотрудника
                    </Button>
                )}
            </div>

            {/* Success Banner */}
            {assignSuccess && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-sm"
                >
                    {assignSuccess}
                </motion.div>
            )}

            {/* Error Banner */}
            {error && !isCreateModalOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex justify-between items-center"
                >
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-destructive hover:opacity-70">✕</button>
                </motion.div>
            )}

            {/* Search and Filter */}
            <Card className="p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Поиск по имени или email..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </Card>

            {/* Content */}
            {isLoading ? (
                <div className="flex justify-center p-12">
                    <motion.div
                        className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                </div>
            ) : filteredEmployees.length === 0 ? (
                <Card className="p-12 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Users className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Нет сотрудников</h3>
                    <p className="text-muted-foreground mb-6">
                        Добавьте сотрудников, чтобы назначить их ответственными за точки.
                    </p>
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Добавить сотрудника
                    </Button>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredEmployees.map((employee, index) => {
                        const assignedPoints = getEmployeePoints(employee.id);
                        return (
                            <motion.div
                                key={employee.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {employee.firstName[0]}{employee.lastName[0]}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold">{employee.fullName}</h3>
                                                <div className="flex items-center text-xs text-muted-foreground gap-1">
                                                    <Shield className="h-3 w-3" />
                                                    {employee.role}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4" />
                                            {employee.email}
                                        </div>
                                        {employee.phone && (
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4" />
                                                {employee.phone}
                                            </div>
                                        )}
                                    </div>

                                    {/* Assigned points */}
                                    {assignedPoints.length > 0 && (
                                        <div className="mb-4 space-y-1.5">
                                            {assignedPoints.map(ap => (
                                                <div key={ap.pointId} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-primary/5 text-primary">
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="h-3 w-3" />
                                                        <span className="font-medium">{ap.pointName}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => onUnassignPoint(employee.id, ap.pointId)}
                                                        className="p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                        title="Снять с точки"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="border-t border-border/50 pt-4 mt-4 flex gap-2">
                                        {assignedPoints.length < points.length && (
                                            <Button
                                                variant="outline"
                                                className="flex-1"
                                                onClick={() => {
                                                    setSelectedEmployeeId(employee.id);
                                                    setIsAssignModalOpen(true);
                                                }}
                                            >
                                                <MapPin className="h-4 w-4 mr-2" />
                                                {assignedPoints.length > 0 ? 'Добавить точку' : 'Назначить точку'}
                                            </Button>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => onDeleteEmployee(employee.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Create Modal */}
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
                                <h2 className="text-xl font-semibold">Новый сотрудник</h2>
                            </div>
                            <form onSubmit={handleSubmit(onCreateEmployee)} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        {...register('firstName')}
                                        label="Имя"
                                        placeholder="Иван"
                                        error={errors.firstName?.message}
                                    />
                                    <Input
                                        {...register('lastName')}
                                        label="Фамилия"
                                        placeholder="Иванов"
                                        error={errors.lastName?.message}
                                    />
                                </div>
                                <Input
                                    {...register('phone')}
                                    label="Телефон"
                                    placeholder="+7..."
                                />
                                <Input
                                    {...register('email')}
                                    label="Email"
                                    type="email"
                                    placeholder="ivan@example.com"
                                    error={errors.email?.message}
                                />
                                <Input
                                    {...register('password')}
                                    label="Пароль"
                                    type="password"
                                    placeholder="******"
                                    error={errors.password?.message}
                                />

                                {error && (
                                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsCreateModalOpen(false)}>
                                        Отмена
                                    </Button>
                                    <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                                        Создать
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Assign Point Modal */}
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
                                <h2 className="text-xl font-semibold">Назначить на точку</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    Выберите точку для назначения сотрудника.
                                </p>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {getUnassignedPoints().map(point => (
                                        <button
                                            key={point.id}
                                            onClick={() => onAssignPoint(point.id)}
                                            className="w-full p-3 text-left rounded-xl border border-border/50 hover:bg-accent/50 transition-colors flex items-center gap-3"
                                            disabled={isSubmitting}
                                        >
                                            <div className="p-2 rounded-lg bg-primary/10">
                                                <MapPin className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">{point.name}</div>
                                                <div className="text-xs text-muted-foreground">{point.address || 'Нет адреса'}</div>
                                            </div>
                                        </button>
                                    ))}
                                    {getUnassignedPoints().length === 0 && (
                                        <div className="text-center py-4 text-muted-foreground text-sm flex flex-col items-center gap-2">
                                            <Check className="h-5 w-5 text-green-500" />
                                            Сотрудник назначен на все точки
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
        </div>
    );
}

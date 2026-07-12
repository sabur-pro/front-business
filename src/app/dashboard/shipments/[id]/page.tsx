'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    SendHorizontal,
    Clock,
    CheckCircle2,
    XCircle,
    Package,
    ImageIcon,
    X,
    Check,
    Camera,
    AlertCircle,
    ArrowUpRight,
    ArrowDownLeft,
    FileText,
    Truck,
    Search,
    History,
    Trash2,
} from 'lucide-react';
import { Button, Card, ImageViewer, AuditHistoryModal } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import {
    shipmentApi,
    uploadApi,
    organizationApi,
    ShipmentResponse,
    ShipmentStatus,
    AccountResponse,
    PointResponse,
} from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
    PENDING: { label: 'Ожидает', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-500/10', icon: Clock },
    SENT: { label: 'Отправлен', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/10', icon: SendHorizontal },
    CONFIRMED: { label: 'Принят', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-500/10', icon: CheckCircle2 },
    CANCELLED: { label: 'Отменён', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10', icon: XCircle },
};

export default function ShipmentDetailPage() {
    const router = useRouter();
    const params = useParams();
    const shipmentId = params.id as string;
    const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();

    const [shipment, setShipment] = useState<ShipmentResponse | null>(null);
    const [accounts, setAccounts] = useState<AccountResponse[]>([]);
    const [userPoints, setUserPoints] = useState<PointResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Accept form
    const [receiverPhotoFile, setReceiverPhotoFile] = useState<File | null>(null);
    const [receiverPhotoPreview, setReceiverPhotoPreview] = useState('');
    const [isAccepting, setIsAccepting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [viewerImage, setViewerImage] = useState<string | null>(null);
    const [viewerAlt, setViewerAlt] = useState('');
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push('/login');
    }, [isAuthenticated, authLoading, router]);

    useEffect(() => {
        if (isAuthenticated && shipmentId) {
            loadData();
        }
    }, [isAuthenticated, shipmentId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [shipmentData, accountsData, pointsData] = await Promise.all([
                shipmentApi.getById(shipmentId),
                organizationApi.getAccounts(),
                organizationApi.getPoints(),
            ]);
            setShipment(shipmentData);
            setAccounts(accountsData);
            setUserPoints(pointsData);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Не удалось загрузить данные отправки');
        } finally {
            setIsLoading(false);
        }
    };

    const getAccountName = (accountId: string) => {
        const acc = accounts.find(a => a.id === accountId);
        return acc?.name || accountId.slice(0, 8) + '...';
    };

    const isMyAccount = (accountId: string) => {
        return accounts.some(a => a.id === accountId);
    };

    const isMyPoint = (pointId: string) => {
        return userPoints.some(p => p.id === pointId);
    };

    const isSenderPoint = shipment ? isMyPoint(shipment.fromPointId) : false;
    const isReceiverPoint = shipment ? isMyPoint(shipment.toPointId) : false;
    const isSender = shipment ? isMyAccount(shipment.fromAccountId) : false;
    const isReceiver = shipment ? isMyAccount(shipment.toAccountId) : false;

    // Only the receiver point user can accept/cancel, not the sender point user
    const canAccept = isReceiverPoint && !isSenderPoint && shipment?.status === 'SENT';
    const canCancel = isReceiverPoint && !isSenderPoint && (shipment?.status === 'SENT' || shipment?.status === 'PENDING');

    const handlePhotoUpload = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            setReceiverPhotoFile(file);
            setReceiverPhotoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleAccept = async () => {
        if (!shipment) return;
        setError(null);
        setIsAccepting(true);
        try {
            let receiverWaybillPhotoUrl: string | undefined;
            if (receiverPhotoFile) {
                const uploaded = await uploadApi.uploadPhoto(receiverPhotoFile);
                receiverWaybillPhotoUrl = uploaded.url;
            }

            const updated = await shipmentApi.accept(shipment.id, {
                receiverWaybillPhoto: receiverWaybillPhotoUrl,
            });
            setShipment(updated);
            setSuccess('Отправка принята! Товары добавлены на ваш склад.');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка при приёмке');
        } finally {
            setIsAccepting(false);
        }
    };

    const handleCancel = async () => {
        if (!shipment) return;
        setError(null);
        setIsCancelling(true);
        try {
            const updated = await shipmentApi.cancel(shipment.id);
            setShipment(updated);
            setSuccess('Отправка отменена. Товары возвращены на склад.');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка при отмене');
        } finally {
            setIsCancelling(false);
        }
    };

    const handleDelete = async () => {
        if (!shipment) return;
        const ok = window.confirm(
            `Удалить заявку #${shipment.number}? Движение товара будет откачено, запись удалена безвозвратно.`,
        );
        if (!ok) return;
        setError(null);
        setIsDeleting(true);
        try {
            await shipmentApi.delete(shipment.id);
            router.push('/dashboard/shipments');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Не удалось удалить заявку');
            setIsDeleting(false);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getPhotoUrl = (url: string | null) => {
        if (!url) return null;
        return url.startsWith('http') ? url : `${API_URL}${url}`;
    };

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

    if (!shipment) {
        return (
            <div className="space-y-6 pb-24">
                <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-muted/60 transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <Card className="p-12 text-center">
                    <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Отправка не найдена</h3>
                    <p className="text-muted-foreground">{error || 'Проверьте ссылку и попробуйте снова'}</p>
                </Card>
            </div>
        );
    }

    const statusCfg = STATUS_CONFIG[shipment.status];
    const StatusIcon = statusCfg.icon;

    const totalBoxes = shipment.items.reduce((s, i) => s + i.boxCount, 0);
    const totalPairs = shipment.items.reduce((s, i) => s + i.pairCount, 0);

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
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-bold">Заявка #{shipment.number}</h1>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${statusCfg.bgColor} ${statusCfg.color}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusCfg.label}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Создано: {formatDate(shipment.createdAt)}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}>
                        <History className="h-4 w-4 mr-1.5" />
                        История
                    </Button>
                    {user?.isDeveloper && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDelete}
                            isLoading={isDeleting}
                            className="text-red-500 border-red-500/40 hover:bg-red-500/10"
                        >
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Удалить
                        </Button>
                    )}
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
                        <Check className="h-5 w-5 flex-shrink-0" />
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
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                        <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Direction Info */}
            <Card className="p-5">
                <div className="flex items-center gap-4">
                    <div className="flex-1 text-center">
                        <div className="inline-flex p-2 rounded-xl bg-blue-500/10 mb-2">
                            <ArrowUpRight className="h-5 w-5 text-blue-500" />
                        </div>
                        <p className="text-sm font-semibold">Отправитель</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{shipment.fromPointName || getAccountName(shipment.fromAccountId)}</p>
                    </div>
                    <div className="flex-shrink-0">
                        <SendHorizontal className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 text-center">
                        <div className="inline-flex p-2 rounded-xl bg-green-500/10 mb-2">
                            <ArrowDownLeft className="h-5 w-5 text-green-500" />
                        </div>
                        <p className="text-sm font-semibold">Получатель</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{shipment.toPointName || getAccountName(shipment.toAccountId)}</p>
                    </div>
                </div>

                {/* Timeline */}
                <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-3 gap-2 text-[11px] text-center">
                    <div>
                        <p className="text-muted-foreground">Отправлено</p>
                        <p className="font-medium">{formatDate(shipment.sentAt)}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Получено</p>
                        <p className="font-medium">{formatDate(shipment.receivedAt)}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Подтверждено</p>
                        <p className="font-medium">{formatDate(shipment.confirmedAt)}</p>
                    </div>
                </div>
            </Card>

            {/* Summary Stats */}
            <div className={`grid gap-3 ${user?.role === 'POINT_ADMIN' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                <div className="text-center p-3 rounded-xl bg-orange-500/10">
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{shipment.items.length}</p>
                    <p className="text-[11px] text-muted-foreground">Позиций</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-purple-500/10">
                    <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{totalBoxes}</p>
                    <p className="text-[11px] text-muted-foreground">Коробок</p>
                </div>
                {user?.role !== 'POINT_ADMIN' && (
                    <>
                        <div className="text-center p-3 rounded-xl bg-blue-500/10">
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">¥{Number(shipment.totalYuan).toLocaleString()}</p>
                            <p className="text-[11px] text-muted-foreground">Юань</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-green-500/10">
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">₽{Number(shipment.totalRub).toLocaleString()}</p>
                            <p className="text-[11px] text-muted-foreground">Рубли</p>
                        </div>
                    </>
                )}
            </div>

            {/* Items List */}
            <Card className="p-5">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-orange-500" />
                    Товары ({shipment.items.length})
                </h2>
                <div className="space-y-3">
                    {shipment.items.map((item, index) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="p-3 rounded-xl border border-border"
                        >
                            <div className="flex items-center gap-3">
                                {item.photo ? (
                                    <div
                                        className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer group"
                                        onClick={(e) => { e.stopPropagation(); setViewerImage(getPhotoUrl(item.photo) || ''); setViewerAlt(item.sku); }}
                                    >
                                        <img
                                            src={getPhotoUrl(item.photo) || ''}
                                            alt={item.sku}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                                            <Search className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
                                        <Package className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{item.sku}</p>
                                    {item.sizeRange && (
                                        <p className="text-xs text-muted-foreground">{item.sizeRange}</p>
                                    )}
                                    <div className="flex gap-3 mt-1 text-xs">
                                        <span>{item.boxCount} кор</span>
                                        <span>{item.pairCount} пар</span>
                                    </div>
                                </div>
                                {user?.role !== 'POINT_ADMIN' && (
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400">¥{Number(item.totalYuan).toLocaleString()}</p>
                                        <p className="text-xs font-medium text-green-600 dark:text-green-400">₽{Number(item.totalRub).toLocaleString()}</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </Card>

            {/* Photos */}
            {(shipment.waybillPhoto || shipment.transportPhoto || shipment.receiverWaybillPhoto) && (
                <Card className="p-5">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Camera className="h-5 w-5 text-purple-500" />
                        Фотографии
                    </h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        {shipment.waybillPhoto && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                    <FileText className="h-3.5 w-3.5" /> Накладная
                                </p>
                                <div
                                    className="relative rounded-xl overflow-hidden border border-border cursor-pointer group"
                                    onClick={() => { setViewerImage(getPhotoUrl(shipment.waybillPhoto) || ''); setViewerAlt('Накладная'); }}
                                >
                                    <img
                                        src={getPhotoUrl(shipment.waybillPhoto) || ''}
                                        alt="Накладная"
                                        className="w-full h-40 object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                                        <Search className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            </div>
                        )}
                        {shipment.transportPhoto && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                    <Truck className="h-3.5 w-3.5" /> Транспорт
                                </p>
                                <div
                                    className="relative rounded-xl overflow-hidden border border-border cursor-pointer group"
                                    onClick={() => { setViewerImage(getPhotoUrl(shipment.transportPhoto) || ''); setViewerAlt('Транспорт'); }}
                                >
                                    <img
                                        src={getPhotoUrl(shipment.transportPhoto) || ''}
                                        alt="Транспорт"
                                        className="w-full h-40 object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                                        <Search className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            </div>
                        )}
                        {shipment.receiverWaybillPhoto && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Подписанная накладная
                                </p>
                                <div
                                    className="relative rounded-xl overflow-hidden border border-border cursor-pointer group"
                                    onClick={() => { setViewerImage(getPhotoUrl(shipment.receiverWaybillPhoto) || ''); setViewerAlt('Подписанная накладная'); }}
                                >
                                    <img
                                        src={getPhotoUrl(shipment.receiverWaybillPhoto) || ''}
                                        alt="Подписанная накладная"
                                        className="w-full h-40 object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                                        <Search className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Note */}
            {shipment.note && (
                <Card className="p-5">
                    <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Комментарий</h2>
                    <p className="text-sm">{shipment.note}</p>
                </Card>
            )}

            {/* Accept Section (for receiver) */}
            {canAccept && (
                <Card className="p-6 border-2 border-green-500/30">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        Принять отправку
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                        Сфотографируйте подписанную накладную и подтвердите приёмку товаров.
                        После подтверждения товары будут добавлены на ваш склад.
                    </p>

                    {/* Receiver Waybill Photo */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Фото подписанной накладной</label>
                        {receiverPhotoPreview ? (
                            <div className="relative w-full h-40 rounded-xl overflow-hidden border border-border">
                                <img src={receiverPhotoPreview} alt="Подписанная накладная" className="w-full h-full object-cover" />
                                <button
                                    onClick={() => { setReceiverPhotoFile(null); setReceiverPhotoPreview(''); }}
                                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-lg"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <label className="flex-1 flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-green-500/30 hover:border-green-500/50 cursor-pointer transition-colors bg-green-500/5">
                                    <ImageIcon className="h-8 w-8 text-green-500" />
                                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">Галерея</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handlePhotoUpload(f);
                                    }} />
                                </label>
                                <label className="flex-1 flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-green-500/30 hover:border-green-500/50 cursor-pointer transition-colors bg-green-500/5">
                                    <Camera className="h-8 w-8 text-green-500" />
                                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">Камера</span>
                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handlePhotoUpload(f);
                                    }} />
                                </label>
                            </div>
                        )}
                    </div>

                    <Button
                        className="w-full"
                        size="lg"
                        isLoading={isAccepting}
                        onClick={handleAccept}
                    >
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        Принять товары на склад
                    </Button>
                </Card>
            )}

            {/* Cancel/Reject button (for sender or receiver) */}
            {canCancel && (
                <Card className="p-6 border border-destructive/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-destructive">
                                {isReceiverPoint && !isSenderPoint ? 'Отклонить отправку' : 'Отменить отправку'}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Товары будут возвращены на склад отправителя
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            isLoading={isCancelling}
                            onClick={handleCancel}
                        >
                            <XCircle className="h-4 w-4 mr-1.5" />
                            {isReceiverPoint && !isSenderPoint ? 'Отклонить' : 'Отменить'}
                        </Button>
                    </div>
                </Card>
            )}
            {/* Image Viewer */}
            <AnimatePresence>
                {viewerImage && (
                    <ImageViewer src={viewerImage} alt={viewerAlt} onClose={() => setViewerImage(null)} />
                )}
            </AnimatePresence>

            {/* Audit History Modal */}
            <AuditHistoryModal
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
                entityType="SHIPMENT"
                entityId={shipmentId}
                title={`История отправки #${shipment.number}`}
            />
        </div>
    );
}

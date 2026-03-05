'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
    LogOut,
    Sun,
    Globe,
    Shield,
    Mail,
    User,
    Users,
    MapPin,
    Warehouse,
    History,
    ChevronRight,
} from 'lucide-react';
import { Card, Button, ThemeToggle, LanguageToggle } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { authApi } from '@/lib/api';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${checked ? 'bg-primary' : 'bg-muted-foreground/30'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
            />
        </button>
    );
}

export default function SettingsPage() {
    const t = useTranslations('settings');
    const router = useRouter();
    const { user, refreshToken: storedRefreshToken, logout } = useAuthStore();
    const { settings, fetchSettings, updateSettings } = useSettingsStore();
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleLogout = async () => {
        try {
            await authApi.logout(storedRefreshToken || '');
            logout();
            router.push('/login');
        } catch (error) {
            console.error('Logout failed:', error);
            logout();
            router.push('/login');
        }
    };

    const handleToggle = async (key: 'canAddEmployees' | 'canAddPoints' | 'canAddWarehouses', value: boolean) => {
        setIsUpdating(key);
        try {
            await updateSettings({ [key]: value });
        } catch (err) {
            console.error('Failed to update setting', err);
        } finally {
            setIsUpdating(null);
        }
    };

    const isOrganizer = user?.role === 'ORGANIZER';

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-2xl font-bold mb-1">{t('title')}</h1>
                <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
            </motion.div>

            {/* Profile Info */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
            >
                <Card className="p-5">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('profile')}</h3>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{user?.fullName}</p>
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span className="truncate">{user?.email}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{t('role')}:</span>
                            <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                {user?.role === 'ORGANIZER' ? t('organizer') : t('pointAdmin')}
                            </span>
                        </div>
                        <div className="pt-2 border-t">
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
                            >
                                <LogOut className="h-3.5 w-3.5" />
                                {t('logoutButton')}
                            </button>
                        </div>
                    </div>
                </Card>
            </motion.div>

            {/* Feature Toggles - only for organizer */}
            {isOrganizer && settings && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 }}
                >
                    <Card className="p-5">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Функции</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-purple-500/10">
                                        <Users className="h-4 w-4 text-purple-500" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium">Добавление сотрудников</span>
                                        <p className="text-xs text-muted-foreground">Разрешить создание новых сотрудников</p>
                                    </div>
                                </div>
                                <Toggle
                                    checked={settings.canAddEmployees}
                                    onChange={(v) => handleToggle('canAddEmployees', v)}
                                    disabled={isUpdating === 'canAddEmployees'}
                                />
                            </div>
                            <div className="border-t" />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-blue-500/10">
                                        <MapPin className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium">Добавление точек</span>
                                        <p className="text-xs text-muted-foreground">Разрешить создание новых точек</p>
                                    </div>
                                </div>
                                <Toggle
                                    checked={settings.canAddPoints}
                                    onChange={(v) => handleToggle('canAddPoints', v)}
                                    disabled={isUpdating === 'canAddPoints'}
                                />
                            </div>
                            <div className="border-t" />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-green-500/10">
                                        <Warehouse className="h-4 w-4 text-green-500" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium">Добавление складов</span>
                                        <p className="text-xs text-muted-foreground">Разрешить создание новых складов</p>
                                    </div>
                                </div>
                                <Toggle
                                    checked={settings.canAddWarehouses}
                                    onChange={(v) => handleToggle('canAddWarehouses', v)}
                                    disabled={isUpdating === 'canAddWarehouses'}
                                />
                            </div>
                        </div>
                    </Card>
                </motion.div>
            )}

            {/* Appearance */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <Card className="p-5">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('appearance')}</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-orange-500/10">
                                    <Sun className="h-4 w-4 text-orange-500" />
                                </div>
                                <span className="text-sm font-medium">{t('theme')}</span>
                            </div>
                            <ThemeToggle />
                        </div>
                        <div className="border-t" />
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-500/10">
                                    <Globe className="h-4 w-4 text-blue-500" />
                                </div>
                                <span className="text-sm font-medium">{t('language')}</span>
                            </div>
                            <LanguageToggle />
                        </div>
                    </div>
                </Card>
            </motion.div>

            {/* History */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
            >
                <Card className="p-5">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">История</h3>
                    <button
                        onClick={() => router.push('/dashboard/settings/history')}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-500/10">
                                <History className="h-4 w-4 text-amber-500" />
                            </div>
                            <div className="text-left">
                                <span className="text-sm font-medium block">История изменений товаров</span>
                                <p className="text-xs text-muted-foreground">Приходы, изменения, удаления товаров</p>
                            </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                </Card>
            </motion.div>

        </div>
    );
}

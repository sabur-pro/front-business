'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, Search, LogOut, ChevronRight, ShieldAlert, Loader2 } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { ThemeToggle } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { authApi, OrganizerListItem } from '@/lib/api';

export default function DeveloperPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading, login, logout } = useAuthStore();

    const [organizers, setOrganizers] = useState<OrganizerListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [selectingId, setSelectingId] = useState<string | null>(null);

    // Только девелопер имеет доступ к этому экрану
    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) {
            router.replace('/login');
            return;
        }
        // Разрешаем как «сырую» роль DEVELOPER, так и dev-сессию (смена организатора)
        if (user && user.role !== 'DEVELOPER' && !user.isDeveloper) {
            router.replace('/dashboard');
        }
    }, [authLoading, isAuthenticated, user, router]);

    useEffect(() => {
        if (!isAuthenticated) return;
        authApi
            .listOrganizers()
            .then(setOrganizers)
            .catch((e) => setError(e.response?.data?.message || 'Не удалось загрузить организаторов'))
            .finally(() => setIsLoading(false));
    }, [isAuthenticated]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return organizers;
        return organizers.filter(
            (o) =>
                o.fullName.toLowerCase().includes(q) ||
                o.email.toLowerCase().includes(q) ||
                (o.phone || '').toLowerCase().includes(q),
        );
    }, [organizers, search]);

    const handleSelect = async (org: OrganizerListItem) => {
        if (!org.isActive) return;
        setSelectingId(org.id);
        setError(null);
        try {
            const res = await authApi.actAs(org.id);
            login(res.user, res.accessToken, res.refreshToken);
            router.push('/dashboard');
        } catch (e: any) {
            setError(e.response?.data?.message || 'Не удалось войти под организатора');
            setSelectingId(null);
        }
    };

    const handleLogout = async () => {
        try {
            const rt = useAuthStore.getState().refreshToken;
            if (rt) await authApi.logout(rt);
        } catch {
            // ignore
        }
        logout();
        router.replace('/login');
    };

    if (authLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <motion.div
                    className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="glass sticky top-0 z-40">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-primary/10">
                            <ShieldAlert className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg leading-tight">Режим девелопера</h1>
                            <p className="text-xs text-muted-foreground">Выберите организатора для входа</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Button variant="outline" size="sm" onClick={handleLogout}>
                            <LogOut className="h-4 w-4 mr-1.5" />
                            Выйти
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
                <Input
                    placeholder="Поиск по имени, email или телефону…"
                    icon={<Search className="h-5 w-5" />}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                {error && (
                    <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center py-16 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <Card className="p-10 text-center text-muted-foreground">
                        {organizers.length === 0 ? 'Организаторов пока нет' : 'Ничего не найдено'}
                    </Card>
                ) : (
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Найдено: {filtered.length}</p>
                        {filtered.map((org, index) => (
                            <motion.div
                                key={org.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                            >
                                <Card
                                    className={`p-4 flex items-center justify-between transition-shadow ${
                                        org.isActive
                                            ? 'hover:shadow-lg cursor-pointer group'
                                            : 'opacity-50 cursor-not-allowed'
                                    }`}
                                    onClick={() => handleSelect(org)}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                                            <Building2 className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold truncate">{org.fullName}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {org.email}
                                                {org.phone ? ` · ${org.phone}` : ''}
                                                {!org.isActive ? ' · деактивирован' : ''}
                                            </p>
                                        </div>
                                    </div>
                                    {selectingId === org.id ? (
                                        <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                                    ) : (
                                        <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                    )}
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

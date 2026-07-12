'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { BottomNav } from './sidebar';
import { useAuthStore } from '@/stores/auth-store';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuthStore();

    // «Сырой» девелопер (ещё не выбрал организатора) не должен попадать в дашборд
    useEffect(() => {
        if (isLoading) return;
        if (isAuthenticated && user?.role === 'DEVELOPER') {
            router.replace('/developer');
        }
    }, [isLoading, isAuthenticated, user?.role, router]);

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Баннер режима девелопера */}
            {user?.isDeveloper && (
                <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-400">
                    <div className="max-w-5xl mx-auto w-full px-4 py-2 flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                            <ShieldAlert className="h-4 w-4 shrink-0" />
                            <span className="truncate">
                                Режим девелопера · вы работаете под{' '}
                                <span className="font-semibold">{user.fullName}</span>
                            </span>
                        </div>
                        <button
                            onClick={() => router.push('/developer')}
                            className="inline-flex items-center gap-1.5 font-medium hover:underline shrink-0"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Сменить
                        </button>
                    </div>
                </div>
            )}

            {/* Page Content — with bottom padding for floating nav */}
            <main className="flex-1 px-4 pt-4 pb-24 sm:px-6 overflow-x-hidden">
                <div className="max-w-5xl mx-auto w-full">
                    {children}
                </div>
            </main>

            {/* Floating Bottom Navigation */}
            <BottomNav />
        </div>
    );
}

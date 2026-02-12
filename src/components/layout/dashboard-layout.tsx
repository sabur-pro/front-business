'use client';

import { BottomNav } from './sidebar';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background flex flex-col">
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

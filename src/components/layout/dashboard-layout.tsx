'use client';

import { BottomNav } from './sidebar';
import { TopHeader } from './top-header';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Top Header */}
            <TopHeader />

            {/* Page Content — with bottom padding for floating nav */}
            <main className="flex-1 px-4 pb-24 sm:px-6 overflow-x-hidden">
                <div className="max-w-5xl mx-auto w-full">
                    {children}
                </div>
            </main>

            {/* Floating Bottom Navigation */}
            <BottomNav />
        </div>
    );
}

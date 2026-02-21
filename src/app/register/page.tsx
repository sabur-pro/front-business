'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Warehouse, ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';
import { ThemeToggle, LanguageToggle, Button } from '@/components/ui';
import { RegisterForm } from '@/components/auth';

export default function RegisterPage() {
    const t = useTranslations('auth');

    return (
        <div className="min-h-screen gradient-bg flex flex-col">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 glass">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/">
                        <motion.div
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                            whileHover={{ x: -5 }}
                        >
                            <ArrowLeft className="h-5 w-5" />
                            <div className="p-2 rounded-xl bg-primary/10">
                                <Warehouse className="h-5 w-5 text-primary" />
                            </div>
                            <span className="font-bold text-lg hidden sm:block">4-Бародарон</span>
                        </motion.div>
                    </Link>

                    <div className="flex items-center gap-3">
                        <LanguageToggle />
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-4 pt-24 pb-8">
                <motion.div
                    className="w-full max-w-md"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Card className="border-0 shadow-2xl">
                        <CardHeader className="text-center pb-2">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                                className="mx-auto mb-4 p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20"
                            >
                                <Warehouse className="h-10 w-10 text-primary" />
                            </motion.div>
                            <CardTitle className="text-2xl">{t('registerTitle')}</CardTitle>
                            <CardDescription>{t('registerSubtitle')}</CardDescription>
                        </CardHeader>

                        <CardContent className="pt-4">
                            <RegisterForm />
                        </CardContent>

                        <CardFooter className="flex-col gap-4 pt-2">
                            <div className="relative w-full">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground">
                                        {t('hasAccount')}
                                    </span>
                                </div>
                            </div>

                            <Link href="/login" className="w-full">
                                <Button variant="outline" className="w-full">
                                    {t('loginButton')}
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>
                </motion.div>
            </main>

            {/* Background Decorations */}
            <div className="fixed top-1/4 left-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="fixed bottom-1/4 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        </div>
    );
}

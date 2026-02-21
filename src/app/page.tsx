'use client';

import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Warehouse,
  ArrowRight,
  Package,
  TrendingUp,
  CreditCard,
  BarChart3
} from 'lucide-react';
import { Button, ThemeToggle, LanguageToggle } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { useEffect, useState } from 'react';

export default function WelcomePage() {
  const t = useTranslations('welcome');
  const { isAuthenticated, isLoading } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const features = [
    { icon: Package, text: t('features.warehouses'), delay: 0.2 },
    { icon: TrendingUp, text: t('features.transfers'), delay: 0.3 },
    { icon: CreditCard, text: t('features.debts'), delay: 0.4 },
    { icon: BarChart3, text: t('features.reports'), delay: 0.5 },
  ];

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.3 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="p-2 rounded-xl bg-primary/10">
              <Warehouse className="h-6 w-6 text-primary" />
            </div>
            <span className="font-bold text-xl hidden sm:block">4-Бародарон</span>
          </motion.div>

          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <LanguageToggle />
            <ThemeToggle />
            {!isLoading && (
              <Link href={isAuthenticated ? '/dashboard' : '/login'}>
                <Button size="sm">{isAuthenticated ? t('getStarted') : t('loginStart')}</Button>
              </Link>
            )}
          </motion.div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 pt-32 pb-20">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >


          {/* Title */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6"
          >
            <span className="gradient-text">{t('title')}</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-lg sm:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto"
          >
            {t('subtitle')}
          </motion.p>

          {/* CTA Button */}
          <motion.div
            variants={itemVariants}
            className="flex items-center justify-center mb-20"
          >
            <Link href={isAuthenticated ? '/dashboard' : '/login'}>
              <Button size="lg" className="group">
                {isAuthenticated ? t('getStarted') : t('loginStart')}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
            variants={containerVariants}
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ scale: 1.05, y: -5 }}
                className="p-6 rounded-2xl bg-card border shadow-sm hover:shadow-lg transition-shadow cursor-default"
              >
                <div className="inline-flex p-3 rounded-xl bg-primary/10 mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium text-sm sm:text-base">{feature.text}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Floating Elements (decoration) */}
        <div className="fixed top-1/4 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed bottom-1/4 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      </main>
    </div>
  );
}

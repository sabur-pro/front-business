'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@/components/ui';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
    const t = useTranslations('auth');
    const router = useRouter();
    const { login } = useAuthStore();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
    });

    const onSubmit = async (data: RegisterFormData) => {
        setError(null);
        setIsLoading(true);

        try {
            const response = await authApi.register({
                email: data.email,
                password: data.password,
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
            });
            login(response.user, response.accessToken, response.refreshToken);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || t('errors.invalidCredentials'));
        } finally {
            setIsLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.08,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
    };

    return (
        <motion.form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <div className="grid grid-cols-2 gap-4">
                <motion.div variants={itemVariants}>
                    <Input
                        {...register('firstName')}
                        type="text"
                        label={t('firstName')}
                        placeholder="Иван"
                        icon={<User className="h-5 w-5" />}
                        error={errors.firstName?.message && t('errors.required')}
                        autoComplete="given-name"
                    />
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Input
                        {...register('lastName')}
                        type="text"
                        label={t('lastName')}
                        placeholder="Иванов"
                        error={errors.lastName?.message && t('errors.required')}
                        autoComplete="family-name"
                    />
                </motion.div>
            </div>

            <motion.div variants={itemVariants}>
                <Input
                    {...register('email')}
                    type="email"
                    label={t('email')}
                    placeholder="email@example.com"
                    icon={<Mail className="h-5 w-5" />}
                    error={errors.email?.message && t('errors.invalidEmail')}
                    autoComplete="email"
                />
            </motion.div>

            <motion.div variants={itemVariants}>
                <Input
                    {...register('phone')}
                    type="tel"
                    label={t('phone')}
                    placeholder="+7 (999) 123-45-67"
                    icon={<Phone className="h-5 w-5" />}
                    autoComplete="tel"
                />
            </motion.div>

            <motion.div variants={itemVariants}>
                <Input
                    {...register('password')}
                    type="password"
                    label={t('password')}
                    placeholder="••••••••"
                    icon={<Lock className="h-5 w-5" />}
                    error={errors.password?.message && t('errors.passwordMin')}
                    autoComplete="new-password"
                />
            </motion.div>

            <motion.div variants={itemVariants}>
                <Input
                    {...register('confirmPassword')}
                    type="password"
                    label={t('confirmPassword')}
                    placeholder="••••••••"
                    icon={<Lock className="h-5 w-5" />}
                    error={errors.confirmPassword?.message && t('errors.passwordMatch')}
                    autoComplete="new-password"
                />
            </motion.div>

            {error && (
                <motion.div
                    className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    {error}
                </motion.div>
            )}

            <motion.div variants={itemVariants}>
                <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    isLoading={isLoading}
                >
                    {t('registerButton')}
                </Button>
            </motion.div>
        </motion.form>
    );
}

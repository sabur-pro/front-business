'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@/components/ui';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
    const t = useTranslations('auth');
    const router = useRouter();
    const { login } = useAuthStore();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        setError(null);
        setIsLoading(true);

        try {
            const response = await authApi.login(data);
            login(response.user, response.accessToken, response.refreshToken);
            // Девелопер сначала выбирает организатора, под которым будет работать
            if (response.user.role === 'DEVELOPER') {
                router.push('/developer');
            } else {
                router.push('/dashboard');
            }
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
                staggerChildren: 0.1,
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
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
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
                    {...register('password')}
                    type="password"
                    label={t('password')}
                    placeholder="••••••••"
                    icon={<Lock className="h-5 w-5" />}
                    error={errors.password?.message && t('errors.passwordMin')}
                    autoComplete="current-password"
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
                    {t('loginButton')}
                </Button>
            </motion.div>
        </motion.form>
    );
}

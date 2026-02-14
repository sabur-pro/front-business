'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SellPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const shopId = searchParams.get('shopId');

    useEffect(() => {
        router.replace('/dashboard/shop');
    }, [router]);

    return null;
}

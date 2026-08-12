'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/superadmin/dashboard?tab=USERS');
  }, [router]);
  return null;
}

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { companyUserService } from '@/services/company-user.service';

export function usePermission(key: string): boolean {
  return useAuthStore((s) => s.permissions.includes(key));
}

export function useClaimsSync(): void {
  const companyId = useAuthStore((s) => s.companyId);
  const personId = useAuthStore((s) => s.personId);
  const setPermissions = useAuthStore((s) => s.setPermissions);

  const { data } = useQuery({
    queryKey: ['claims', companyId],
    queryFn: () => companyUserService.getMyClaims(companyId),
    enabled: !!personId && !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (data) setPermissions(data.permissions);
  }, [data, setPermissions]);
}

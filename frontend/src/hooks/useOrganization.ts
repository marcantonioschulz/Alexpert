import { useOrganization as useClerkOrganization } from '@clerk/clerk-react';
import { useState, useEffect } from 'react';
import { useAuthenticatedAPI } from './useAuthenticatedAPI';

export interface QuotaStatus {
  current: number;
  limit: number;
  remaining: number;
  resetDate: string;
  isUnlimited: boolean;
  canProceed: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE';
  monthlyQuota: number;
  currentUsage: number;
  logo?: string;
}

/**
 * Hook to manage organization context and quota
 * Provides organization info and quota status
 */
export function useOrganizationContext() {
  const { organization: clerkOrg, isLoaded } = useClerkOrganization();
  const api = useAuthenticatedAPI();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch organization details and quota status
   */
  useEffect(() => {
    if (!isLoaded || !clerkOrg) {
      setLoading(false);
      return;
    }

    const fetchOrganizationData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch organization details
        const orgData = await api.get<Organization>(`/api/organizations/${clerkOrg.id}`, {
          organizationId: clerkOrg.id
        });

        setOrganization(orgData);

        // Fetch quota status
        const quota = await api.get<QuotaStatus>(`/api/organizations/${clerkOrg.id}/quota`, {
          organizationId: clerkOrg.id
        });

        setQuotaStatus(quota);
      } catch (err) {
        console.error('Failed to fetch organization data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizationData();
  }, [clerkOrg, isLoaded, api]);

  /**
   * Refresh quota status
   */
  const refreshQuota = async () => {
    if (!clerkOrg) return;

    try {
      const quota = await api.get<QuotaStatus>(`/api/organizations/${clerkOrg.id}/quota`, {
        organizationId: clerkOrg.id
      });
      setQuotaStatus(quota);
    } catch (err) {
      console.error('Failed to refresh quota:', err);
    }
  };

  return {
    organization,
    quotaStatus,
    loading,
    error,
    refreshQuota,
    isLoaded: isLoaded && !loading
  };
}

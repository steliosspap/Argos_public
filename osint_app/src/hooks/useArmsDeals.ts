import { useFetchResource } from './useFetchResource';

interface ArmsDeal {
  id: string;
  title: string;
  description: string;
  supplier_country: string;
  recipient_country: string;
  weapon_type: string;
  deal_value: number;
  currency: string;
  status: 'pending' | 'completed' | 'cancelled';
  announced_date: string;
  delivery_date?: string;
  source_url: string;
  verification_status: string;
}

interface ArmsDealsFilters {
  supplierCountry?: string[];
  recipientCountry?: string[];
  weaponType?: string[];
  status?: string[];
  minValue?: number;
  maxValue?: number;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

/**
 * Hook for fetching arms deals with filtering and pagination
 * Another example of using the generic useFetchResource hook
 */
export function useArmsDeals(filters: ArmsDealsFilters = {}) {
  const buildArmsDealsQuery = (query: any, filters: ArmsDealsFilters) => {
    // Supplier country filter
    if (filters.supplierCountry && filters.supplierCountry.length > 0) {
      query = query.in('supplier_country', filters.supplierCountry);
    }

    // Recipient country filter
    if (filters.recipientCountry && filters.recipientCountry.length > 0) {
      query = query.in('recipient_country', filters.recipientCountry);
    }

    // Weapon type filter
    if (filters.weaponType && filters.weaponType.length > 0) {
      query = query.in('weapon_type', filters.weaponType);
    }

    // Status filter
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    // Value range filter
    if (filters.minValue !== undefined) {
      query = query.gte('deal_value', filters.minValue);
    }
    if (filters.maxValue !== undefined) {
      query = query.lte('deal_value', filters.maxValue);
    }

    // Date range filter
    if (filters.dateRange?.start) {
      query = query.gte('announced_date', filters.dateRange.start.toISOString());
    }
    if (filters.dateRange?.end) {
      query = query.lte('announced_date', filters.dateRange.end.toISOString());
    }

    return query;
  };

  const transformArmsDeal = (item: any): ArmsDeal => {
    return {
      id: item.id,
      title: item.title || '',
      description: item.description || '',
      supplier_country: item.supplier_country || '',
      recipient_country: item.recipient_country || '',
      weapon_type: item.weapon_type || '',
      deal_value: item.deal_value || 0,
      currency: item.currency || 'USD',
      status: item.status || 'pending',
      announced_date: item.announced_date,
      delivery_date: item.delivery_date,
      source_url: item.source_url || '',
      verification_status: item.verification_status || 'unverified'
    };
  };

  const result = useFetchResource<ArmsDeal>({
    resource: 'arms_deals',
    filters,
    orderBy: { column: 'announced_date', ascending: false },
    pageSize: 25,
    refreshInterval: 300000, // 5 minutes
    transform: (data) => data.map(transformArmsDeal),
    buildQuery: buildArmsDealsQuery,
    cacheTime: 'slow',
    enableRealtime: false // Arms deals don't update as frequently
  });

  return {
    armsDeals: result.data,
    loading: result.loading,
    error: result.error,
    hasNextPage: result.hasNextPage,
    fetchNextPage: result.fetchNextPage,
    refetch: result.refetch,
    isStale: result.isStale,
    lastUpdated: result.lastUpdated
  };
}
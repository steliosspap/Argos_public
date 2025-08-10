'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
// Removed heroicons import - using inline SVG instead
import { formatCurrency, formatQuantity, parseUnit, ArmsDeal } from '@/utils/currencyUtils';
import { formatDateTime } from '@/utils/dateUtils';
import { createClient } from '@supabase/supabase-js';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorState from '@/components/ErrorState';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ArmsDealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [deal, setDeal] = useState<ArmsDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDeal() {
      try {
        const { data, error } = await supabase
          .from('arms_deals')
          .select('*')
          .eq('id', params.id)
          .single();

        if (error) throw error;
        setDeal(data);
      } catch (err) {
        console.error('Error fetching arms deal:', err);
        setError('Failed to load arms deal details');
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchDeal();
    }
  }, [params.id]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error || !deal) {
    return (
      <ErrorState
        title="Arms Deal Not Found"
        message="The arms deal you're looking for could not be found."
        onRetry={() => router.push('/arms-deals')}
        retryLabel="Back to Arms Deals"
      />
    );
  }

  const quantity = deal.quantity 
    ? formatQuantity(deal.quantity, parseUnit(deal.weapon_type || '') || 'units')
    : 'Unknown quantity';
  const value = deal.value 
    ? formatCurrency(deal.value)
    : 'Undisclosed value';

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back button */}
        <Link
          href="/arms-deals"
          className="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Arms Deals
        </Link>

        {/* Deal details */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center space-x-3 text-2xl font-bold text-white mb-2">
              <span>{deal.supplier}</span>
              <span className="text-gray-400">→</span>
              <span>{deal.recipient}</span>
            </div>
            
            <h2 className="text-xl text-gray-300 mb-4">{deal.weapon_type}</h2>
            
            <div className="flex flex-wrap items-center gap-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-md font-medium ${getStatusColor(deal.status)}`}>
                {deal.status}
              </span>
              
              <div className="text-gray-400">
                <span className="font-medium text-gray-300">{quantity}</span>
                <span className="mx-2">•</span>
                <span className="font-medium text-green-400">{value}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {deal.description && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
              <p className="text-gray-300 leading-relaxed">{deal.description}</p>
            </div>
          )}

          {/* Deal Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Deal Information</h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-400">Order Date</dt>
                <dd className="text-gray-300">{formatDateTime(new Date(deal.order_date))}</dd>
              </div>
              
              {deal.delivery_date && (
                <div>
                  <dt className="text-sm text-gray-400">Delivery Date</dt>
                  <dd className="text-gray-300">{formatDateTime(new Date(deal.delivery_date))}</dd>
                </div>
              )}
              
              <div>
                <dt className="text-sm text-gray-400">Supplier Country</dt>
                <dd className="text-gray-300">{deal.supplier}</dd>
              </div>
              
              <div>
                <dt className="text-sm text-gray-400">Recipient Country</dt>
                <dd className="text-gray-300">{deal.recipient}</dd>
              </div>
              
              {deal.quantity && (
                <div>
                  <dt className="text-sm text-gray-400">Quantity</dt>
                  <dd className="text-gray-300">{quantity}</dd>
                </div>
              )}
              
              {deal.value && (
                <div>
                  <dt className="text-sm text-gray-400">Total Value</dt>
                  <dd className="text-green-400 font-medium">{value}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Metadata */}
          <div className="border-t border-gray-700 pt-4">
            <dl className="text-sm">
              <div>
                <dt className="text-gray-400">Deal ID</dt>
                <dd className="text-gray-300 font-mono">{deal.id}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
// Removed heroicons import - using inline SVG instead
import { formatCurrency, formatQuantity, parseUnit, ArmsDeal } from '@/utils/currencyUtils';
import { formatDateCompact } from '@/utils/dateUtils';
import { analytics } from '@/utils/analytics';
import ArmsDealModal from './ArmsDealModal';

interface ArmsDealsCardProps {
  deals: ArmsDeal[];
  conflictZone?: {
    countries: string[];
    lastYearDate: Date;
  };
  className?: string;
}

export default function ArmsDealsCard({ deals, conflictZone, className = '' }: ArmsDealsCardProps) {
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<ArmsDeal | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Filter deals by conflict zone relevance if provided
  const relevantDeals = conflictZone
    ? deals.filter(deal => {
        const dealDate = new Date(deal.order_date);
        const isRecent = dealDate >= conflictZone.lastYearDate;
        const involvesCountry = conflictZone.countries.includes(deal.supplier) ||
                               conflictZone.countries.includes(deal.recipient);
        return isRecent && involvesCountry;
      })
    : deals;

  const toggleDeal = (dealId: string) => {
    const isExpanding = expandedDealId !== dealId;
    setExpandedDealId(expandedDealId === dealId ? null : dealId);
    if (isExpanding) {
      analytics.trackArmsDealInteraction(dealId, 'expand');
    }
  };

  const openDealModal = (deal: ArmsDeal) => {
    setSelectedDeal(deal);
    setModalOpen(true);
    analytics.trackArmsDealInteraction(deal.id, 'modal');
  };

  const closeDealModal = () => {
    setSelectedDeal(null);
    setModalOpen(false);
  };

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
    <div className={`bg-gray-800 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Arms Deals</h3>
          <Link
            href="/arms-deals"
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center transition-colors"
          >
            View all
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        {conflictZone && (
          <p className="mt-1 text-sm text-gray-400">
            Showing deals involving conflict zone countries (last 12 months)
          </p>
        )}
      </div>

      {/* Deals list */}
      <div className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
        {relevantDeals.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>No relevant arms deals found</p>
          </div>
        ) : (
          relevantDeals.slice(0, 10).map((deal) => {
            const isExpanded = expandedDealId === deal.id;
            const quantity = deal.quantity 
              ? formatQuantity(deal.quantity, parseUnit(deal.weapon_type || '') || 'units')
              : 'Unknown quantity';
            const value = deal.value 
              ? formatCurrency(deal.value)
              : 'Undisclosed';

            return (
              <div key={deal.id} className="hover:bg-gray-700 transition-colors">
                {/* Deal summary */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDeal(deal.id);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Route */}
                      <div 
                        className="flex items-center space-x-2 text-white font-medium hover:text-blue-400 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDealModal(deal);
                        }}
                      >
                        <span>{deal.supplier}</span>
                        <span className="text-gray-400">→</span>
                        <span>{deal.recipient}</span>
                      </div>

                      {/* Weapon type */}
                      <p className="mt-1 text-sm text-gray-300">{deal.weapon_type}</p>

                      {/* Quantity and value */}
                      <div className="mt-2 flex items-center space-x-3 text-sm">
                        <span className="text-gray-400">{quantity}</span>
                        <span className="text-gray-500">•</span>
                        <span className="text-green-400 font-medium">{value}</span>
                      </div>

                      {/* Status and date */}
                      <div className="mt-2 flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(deal.status)}`}>
                          {deal.status}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDateCompact(new Date(deal.order_date))}
                        </span>
                      </div>
                    </div>

                    {/* Expand/collapse icon */}
                    <div className="ml-3">
                      {isExpanded ? (
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 bg-gray-750">
                    {deal.description && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium text-gray-300 mb-1">Description</h4>
                        <p className="text-sm text-gray-400">{deal.description}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Order Date:</span>
                        <span className="ml-2 text-gray-300">
                          {new Date(deal.order_date).toLocaleDateString()}
                        </span>
                      </div>
                      {deal.delivery_date && (
                        <div>
                          <span className="text-gray-400">Delivery Date:</span>
                          <span className="ml-2 text-gray-300">
                            {new Date(deal.delivery_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      <Link
                        href={`/arms-deals/${deal.id}`}
                        className="text-sm text-blue-400 hover:text-blue-300 flex items-center transition-colors"
                      >
                        View full details
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {relevantDeals.length > 10 && (
        <div className="p-4 border-t border-gray-700">
          <p className="text-sm text-gray-400 text-center">
            Showing {Math.min(10, relevantDeals.length)} of {relevantDeals.length} deals
          </p>
        </div>
      )}
      
      {/* Modal */}
      <ArmsDealModal
        deal={selectedDeal}
        isOpen={modalOpen}
        onClose={closeDealModal}
      />
    </div>
  );
}
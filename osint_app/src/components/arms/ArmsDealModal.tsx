'use client';

import React from 'react';
import { ArmsDeal, formatCurrency, formatQuantity, parseUnit, parseMonetaryValue } from '@/utils/currencyUtils';
import { formatDateCompact } from '@/utils/dateUtils';

interface ArmsDealModalProps {
  deal: ArmsDeal | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ArmsDealModal({ deal, isOpen, onClose }: ArmsDealModalProps) {
  if (!isOpen || !deal) return null;

  const quantity = deal.quantity 
    ? formatQuantity(deal.quantity, parseUnit(deal.weapon_type || '') || 'units')
    : 'Unknown quantity';
  const value = deal.value 
    ? formatCurrency(deal.value)
    : 'Undisclosed';

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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-gray-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  Arms Deal Details
                </h3>
                <div className="mt-2 flex items-center space-x-2 text-white">
                  <span className="font-medium">{deal.supplier}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium">{deal.recipient}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="ml-4 p-1 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Weapon System */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-1">Weapon System</h4>
              <p className="text-lg text-white">{deal.weapon_type}</p>
            </div>
            
            {/* Key Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">Quantity</h4>
                <p className="text-white">{quantity}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">Deal Value</h4>
                <p className="text-green-400 font-medium text-lg">{value}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">Order Date</h4>
                <p className="text-white">{new Date(deal.order_date).toLocaleDateString()}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">Status</h4>
                <span className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium ${getStatusColor(deal.status)}`}>
                  {deal.status}
                </span>
              </div>
            </div>
            
            {/* Delivery Date */}
            {deal.delivery_date && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">Expected Delivery</h4>
                <p className="text-white">{new Date(deal.delivery_date).toLocaleDateString()}</p>
              </div>
            )}
            
            {/* Description */}
            {deal.description && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Description</h4>
                <p className="text-gray-300">{deal.description}</p>
              </div>
            )}
            
            {/* Strategic Impact */}
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-400 mb-2">Strategic Impact</h4>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>• Regional military balance may be affected</li>
                <li>• Potential escalation of {deal.recipient}'s capabilities</li>
                {value && parseMonetaryValue(value) > 1000000000 && (
                  <li>• Significant investment indicating long-term strategic planning</li>
                )}
              </ul>
            </div>
          </div>
          
          {/* Footer */}
          <div className="p-6 border-t border-gray-700 flex justify-between items-center">
            <a
              href={`/arms-deals/${deal.id}`}
              className="text-blue-400 hover:text-blue-300 flex items-center transition-colors"
            >
              View full analysis
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TableColumn {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  className?: string;
  mobileHidden?: boolean;
}

interface ResponsiveTableProps {
  columns: TableColumn[];
  data: any[];
  onRowClick?: (row: any) => void;
  selectedRowId?: string;
  className?: string;
  mobileView?: 'card' | 'table';
}

export default function ResponsiveTable({
  columns,
  data,
  onRowClick,
  selectedRowId,
  className = '',
  mobileView = 'card'
}: ResponsiveTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRowExpansion = (rowId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };

  // Desktop table view
  const DesktopTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider ${column.className || ''}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {data.map((row, index) => (
            <motion.tr
              key={row.id || index}
              onClick={() => onRowClick?.(row)}
              className={`
                hover:bg-gray-800 transition-colors
                ${onRowClick ? 'cursor-pointer' : ''}
                ${selectedRowId === row.id ? 'bg-gray-800' : ''}
              `}
              whileHover={{ backgroundColor: 'rgba(55, 65, 81, 0.5)' }}
              whileTap={{ scale: 0.99 }}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-4 py-3 text-sm text-gray-300 ${column.className || ''}`}
                >
                  {column.render 
                    ? column.render(row[column.key], row)
                    : row[column.key]
                  }
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Mobile card view
  const MobileCards = () => (
    <div className="space-y-3">
      {data.map((row, index) => {
        const isExpanded = expandedRows.has(row.id || index);
        const visibleColumns = columns.filter(col => !col.mobileHidden);
        const hiddenColumns = columns.filter(col => col.mobileHidden);

        return (
          <motion.div
            key={row.id || index}
            className={`
              bg-gray-800 rounded-lg border border-gray-700 overflow-hidden
              ${onRowClick ? 'cursor-pointer' : ''}
              ${selectedRowId === row.id ? 'ring-2 ring-blue-500' : ''}
            `}
            whileTap={{ scale: 0.98 }}
          >
            <div
              onClick={() => onRowClick?.(row)}
              className="p-4"
            >
              {/* Main content */}
              <div className="space-y-2">
                {visibleColumns.map((column) => (
                  <div key={column.key} className="flex justify-between items-start">
                    <span className="text-xs text-gray-400 min-w-[100px]">
                      {column.label}:
                    </span>
                    <span className="text-sm text-gray-200 text-right flex-1 ml-2">
                      {column.render 
                        ? column.render(row[column.key], row)
                        : row[column.key]
                      }
                    </span>
                  </div>
                ))}
              </div>

              {/* Expand button if there are hidden columns */}
              {hiddenColumns.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleRowExpansion(row.id || index);
                  }}
                  className="mt-3 w-full text-center text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                  <svg
                    className={`inline-block ml-1 w-3 h-3 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Expanded content */}
            <AnimatePresence>
              {isExpanded && hiddenColumns.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-2 border-t border-gray-700 pt-3">
                    {hiddenColumns.map((column) => (
                      <div key={column.key} className="flex justify-between items-start">
                        <span className="text-xs text-gray-400 min-w-[100px]">
                          {column.label}:
                        </span>
                        <span className="text-sm text-gray-200 text-right flex-1 ml-2">
                          {column.render 
                            ? column.render(row[column.key], row)
                            : row[column.key]
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );

  return (
    <div className={className}>
      {/* Desktop view */}
      <div className="hidden md:block">
        <DesktopTable />
      </div>

      {/* Mobile view */}
      <div className="md:hidden">
        {mobileView === 'card' ? <MobileCards /> : <DesktopTable />}
      </div>
    </div>
  );
}
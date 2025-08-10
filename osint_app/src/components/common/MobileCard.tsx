'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface MobileCardProps {
  children: ReactNode;
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
  noPadding?: boolean;
  animate?: boolean;
}

export default function MobileCard({
  children,
  onClick,
  isSelected = false,
  className = '',
  noPadding = false,
  animate = true
}: MobileCardProps) {
  const cardContent = (
    <div
      className={`
        bg-gray-800 rounded-lg border border-gray-700 transition-all
        ${onClick ? 'cursor-pointer hover:bg-gray-700 active:bg-gray-600' : ''}
        ${isSelected ? 'ring-2 ring-blue-500 bg-gray-700' : ''}
        ${noPadding ? '' : 'p-3 md:p-4'}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );

  if (animate && onClick) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        {cardContent}
      </motion.div>
    );
  }

  return cardContent;
}
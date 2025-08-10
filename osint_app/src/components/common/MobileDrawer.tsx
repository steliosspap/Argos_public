'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { createPortal } from 'react-dom';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  position?: 'bottom' | 'right' | 'left';
  showHandle?: boolean;
  className?: string;
}

export default function MobileDrawer({
  isOpen,
  onClose,
  title,
  children,
  position = 'bottom',
  showHandle = true,
  className = ''
}: MobileDrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const getDrawerVariants = () => {
    switch (position) {
      case 'bottom':
        return {
          hidden: { y: '100%' },
          visible: { y: 0 }
        };
      case 'right':
        return {
          hidden: { x: '100%' },
          visible: { x: 0 }
        };
      case 'left':
        return {
          hidden: { x: '-100%' },
          visible: { x: 0 }
        };
    }
  };

  const getDrawerStyles = () => {
    switch (position) {
      case 'bottom':
        return 'bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl';
      case 'right':
        return 'top-0 right-0 bottom-0 w-full max-w-sm';
      case 'left':
        return 'top-0 left-0 bottom-0 w-full max-w-sm';
    }
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    const threshold = 100;
    const velocity = position === 'bottom' ? info.velocity.y : info.velocity.x;
    const offset = position === 'bottom' ? info.offset.y : info.offset.x;
    
    if ((position === 'bottom' && offset > threshold) ||
        (position === 'right' && offset > threshold) ||
        (position === 'left' && offset < -threshold) ||
        (position === 'bottom' && velocity > 500) ||
        (position === 'right' && velocity > 500) ||
        (position === 'left' && velocity < -500)) {
      onClose();
    }
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            ref={containerRef}
            variants={getDrawerVariants()}
            initial="hidden"
            animate="visible"
            exit="hidden"
            drag={position === 'bottom' ? 'y' : 'x'}
            dragConstraints={{ 
              top: 0, 
              bottom: 0,
              left: 0,
              right: 0
            }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed bg-gray-900 shadow-xl z-50 ${getDrawerStyles()} ${className}`}
          >
            {/* Handle for bottom drawer */}
            {showHandle && position === 'bottom' && (
              <div className="flex justify-center py-2 cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1 bg-gray-600 rounded-full" />
              </div>
            )}

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors touch-manipulation"
                  aria-label="Close drawer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain smooth-scroll">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Use portal to render at document root
  if (typeof window !== 'undefined') {
    return createPortal(content, document.body);
  }

  return null;
}
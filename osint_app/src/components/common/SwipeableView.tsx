'use client';

import { useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

interface SwipeableViewProps {
  children: React.ReactNode[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  className?: string;
  showIndicators?: boolean;
}

export default function SwipeableView({
  children,
  initialIndex = 0,
  onIndexChange,
  className = '',
  showIndicators = true
}: SwipeableViewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handleDragEnd = (event: any, info: PanInfo) => {
    const threshold = 50;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    let newIndex = currentIndex;

    if (offset < -threshold || velocity < -500) {
      // Swipe left - next item
      newIndex = Math.min(currentIndex + 1, children.length - 1);
    } else if (offset > threshold || velocity > 500) {
      // Swipe right - previous item
      newIndex = Math.max(currentIndex - 1, 0);
    }

    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      onIndexChange?.(newIndex);
    }
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="touch-manipulation"
        >
          {children[currentIndex]}
        </motion.div>
      </AnimatePresence>

      {/* Indicators */}
      {showIndicators && children.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2">
          {children.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index);
                onIndexChange?.(index);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex 
                  ? 'bg-white w-6' 
                  : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
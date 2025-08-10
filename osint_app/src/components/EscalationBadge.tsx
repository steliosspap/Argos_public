'use client';

import React from 'react';
import Tooltip from '@/components/Tooltip';
import { formatEscalationScore, getEscalationColor, getEscalationLevel } from '@/utils/escalationUtils';

interface EscalationBadgeProps {
  score: number;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function EscalationBadge({ 
  score, 
  showTooltip = true,
  size = 'md',
  className = ''
}: EscalationBadgeProps) {
  const level = getEscalationLevel(score);
  const color = getEscalationColor(score);
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };
  
  const getTooltipContent = () => {
    let description = '';
    if (score >= 9) {
      description = 'Critical risk - Immediate threat requiring urgent attention';
    } else if (score >= 7) {
      description = 'High risk - Significant escalation detected';
    } else if (score >= 4) {
      description = 'Moderate risk - Situation requires monitoring';
    } else {
      description = 'Low risk - Routine activity detected';
    }
    
    return (
      <div>
        <div className="font-semibold">Escalation Score: {formatEscalationScore(score)}</div>
        <div className="text-sm mt-1">{description}</div>
      </div>
    );
  };
  
  const badge = (
    <span 
      className={`
        inline-flex items-center font-medium rounded-md
        ${color} ${sizeClasses[size]} ${className}
        transition-all duration-200 hover:shadow-md
      `}
    >
      {level} ({formatEscalationScore(score)})
    </span>
  );
  
  if (showTooltip) {
    return (
      <Tooltip content={getTooltipContent()}>
        {badge}
      </Tooltip>
    );
  }
  
  return badge;
}
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { formatEventType } from '@/utils/formatUtils';
// Removed heroicons import - using inline SVG instead

interface ExpandableTagsProps {
  tags: string[];
  maxVisible?: number;
  linkBase?: string; // Base URL for tag links (e.g., "/intelligence-center?tag=")
  className?: string;
  tagClassName?: string;
}

export default function ExpandableTags({
  tags,
  maxVisible = 4,
  linkBase,
  className = '',
  tagClassName = ''
}: ExpandableTagsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!tags || tags.length === 0) {
    return null;
  }
  
  const visibleTags = isExpanded ? tags : tags.slice(0, maxVisible);
  const hiddenCount = tags.length - maxVisible;
  const hasMore = hiddenCount > 0;
  
  const defaultTagClass = `inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium 
    bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors cursor-pointer`;
  
  const renderTag = (tag: string, index: number) => {
    const tagElement = (
      <span className={tagClassName || defaultTagClass}>
        {formatEventType(tag)}
      </span>
    );
    
    if (linkBase) {
      return (
        <Link
          key={index}
          href={`${linkBase}${encodeURIComponent(tag)}`}
          className="tag-hover"
        >
          {tagElement}
        </Link>
      );
    }
    
    return (
      <span key={index} className="tag-hover">
        {tagElement}
      </span>
    );
  };
  
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {visibleTags.map((tag, index) => renderTag(tag, index))}
      
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium 
            bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all duration-200
            border border-gray-600 hover:border-gray-500"
        >
          {isExpanded ? (
            <>
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Show less
            </>
          ) : (
            <>
              +{hiddenCount} more
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  );
}
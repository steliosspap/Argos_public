'use client';

import * as React from "react";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

export function Progress({
  className = "",
  value = 0,
  max = 100,
  ...props
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      className={`relative h-4 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 ${className}`}
      {...props}
    >
      <div
        className="h-full bg-gray-900 transition-all dark:bg-gray-50"
        style={{
          width: `${percentage}%`,
        }}
      />
    </div>
  );
}
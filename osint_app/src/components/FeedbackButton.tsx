'use client';

import Link from 'next/link';

interface FeedbackButtonProps {
  variant?: 'subtle' | 'floating';
  className?: string;
}

export default function FeedbackButton({ variant = 'subtle', className = '' }: FeedbackButtonProps) {
  if (variant === 'floating') {
    return (
      <Link
        href="/feedback"
        className={`fixed bottom-6 right-6 bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 z-40 ${className}`}
        title="Send Feedback"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </Link>
    );
  }

  return (
    <Link
      href="/feedback"
      className={`text-gray-500 hover:text-gray-400 transition-colors text-sm ${className}`}
    >
      Feedback
    </Link>
  );
}
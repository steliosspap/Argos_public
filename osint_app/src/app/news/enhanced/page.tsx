'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import EnhancedNewsFeed from '@/components/news/EnhancedNewsFeed';
import EnhancedIngestionMonitor from '@/components/monitoring/EnhancedIngestionMonitor';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function EnhancedNewsPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Enhanced Intelligence News
            </h1>
            <button
              onClick={() => router.push('/intelligence-center')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Back to Intelligence Center
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="feed" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="feed">News Feed</TabsTrigger>
            <TabsTrigger value="monitor">Ingestion Monitor</TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="space-y-6">
            <EnhancedNewsFeed />
          </TabsContent>

          <TabsContent value="monitor" className="space-y-6">
            <EnhancedIngestionMonitor />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
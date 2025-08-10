'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface InviteCode {
  id: string;
  code: string;
  created_at: string;
  expires_at: string | null;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  assigned_user: { username: string; email: string } | null;
  stats: {
    totalSessions: number;
    activeSessions: number;
    usageRate: number;
    isExpired: boolean;
  };
}

export default function AdminInviteCodesPage() {
  const { isAdmin, user } = useAuth();
  const router = useRouter();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(1);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/unauthorized');
      return;
    }
    fetchInviteCodes();
  }, [isAdmin, router]);

  const fetchInviteCodes = async () => {
    try {
      setError(null);
      const response = await fetch('/api/admin/invite-codes', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Failed to fetch invite codes:', response.status, errorData);
        setError(`Failed to fetch invite codes: ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      setInviteCodes(data);
    } catch (error) {
      console.error('Failed to fetch invite codes:', error);
      setError('Failed to fetch invite codes. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateCodes = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          count: generateCount,
          maxUses,
          expiresInDays
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Failed to generate codes:', response.status, errorData);
        setError(`Failed to generate codes: ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      
      if (data.success && data.codes && data.codes.length > 0) {
        // Add new codes to the newCodes array
        setNewCodes(data.codes);
        
        // Also refresh the full list
        await fetchInviteCodes();
        
        // Reset form
        setGenerateCount(1);
        setMaxUses(1);
        setExpiresInDays(30);
      } else {
        setError('No codes were generated. Please try again.');
      }
    } catch (error) {
      console.error('Failed to generate codes:', error);
      setError('Failed to generate codes. Please check your connection.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleCodeStatus = async (codeId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/invite-codes/${codeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ isActive: !isActive })
      });
      
      if (response.ok) {
        await fetchInviteCodes();
      }
    } catch (error) {
      console.error('Failed to update code:', error);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    // You could add a toast notification here
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading invite codes...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Invite Code Management</h1>
        
        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 text-red-400 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}
        
        {/* Generate New Codes */}
        <div className="bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-white">Generate New Invite Codes</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Number of Codes
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={generateCount}
                onChange={(e) => setGenerateCount(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Max Uses per Code
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={maxUses}
                onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Expires in (days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={generateCodes}
                disabled={isGenerating}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>

        {/* Newly Generated Codes */}
        {newCodes.length > 0 && (
          <div className="bg-green-900/20 border border-green-500 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-green-400">Newly Generated Codes</h2>
            <p className="text-sm text-gray-300 mb-4">
              These codes were just generated. Click on a code to copy it to clipboard.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {newCodes.map((code, index) => (
                <div
                  key={index}
                  onClick={() => copyToClipboard(code)}
                  className="bg-gray-800 p-4 rounded-lg border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors"
                >
                  <code className="text-lg font-mono text-yellow-400">{code}</code>
                  <p className="text-xs text-gray-400 mt-2">Click to copy</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Invite Codes Table */}
        <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">All Invite Codes</h2>
          </div>
          
          {inviteCodes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No invite codes found. Generate some to get started!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Sessions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {inviteCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-gray-750">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <code 
                          className="text-sm font-mono bg-gray-700 text-yellow-400 px-2 py-1 rounded cursor-pointer hover:bg-gray-600"
                          onClick={() => copyToClipboard(code.code)}
                          title="Click to copy"
                        >
                          {code.code}
                        </code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                        {code.current_uses} / {code.max_uses || '∞'}
                        <div className="w-full bg-gray-600 rounded-full h-2 mt-1">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${code.stats?.usageRate || 0}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                        {code.stats?.activeSessions || 0} / {code.stats?.totalSessions || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                        {code.assigned_user ? (
                          <div>
                            <div>{code.assigned_user.username}</div>
                            <div className="text-xs text-gray-400">{code.assigned_user.email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-500">Not assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          code.is_active && !code.stats?.isExpired
                            ? 'bg-green-900 text-green-200'
                            : 'bg-red-900 text-red-200'
                        }`}>
                          {code.is_active && !code.stats?.isExpired ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                        {code.expires_at
                          ? new Date(code.expires_at).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => toggleCodeStatus(code.id, code.is_active)}
                          className="text-indigo-400 hover:text-indigo-300"
                        >
                          {code.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
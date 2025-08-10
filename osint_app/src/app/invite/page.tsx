'use client';

import { useState } from 'react';

export default function InvitePage() {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteCode.trim() || inviteCode.length < 6) {
      setError('Please enter a valid invite code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/verify-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.toUpperCase() }),
      });

      const data = await response.json();

      if (response.ok) {
        // Use router.push for better handling in production
        // Small delay to ensure cookies are set
        setTimeout(() => {
          window.location.replace('/');
        }, 100);
      } else {
        setError(data.message || 'Invalid invite code');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{ 
        width: '100%',
        maxWidth: '28rem'
      }}>
        {/* Logo and Title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            backdropFilter: 'blur(8px)'
          }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>A</span>
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
            Welcome to Argos
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Enter your invite code to access the platform
          </p>
        </div>

        {/* Form Card */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(16px)',
          borderRadius: '1rem',
          padding: '2rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label 
                htmlFor="inviteCode" 
                style={{ 
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'white',
                  marginBottom: '0.5rem'
                }}
              >
                Invite Code
              </label>
              <input
                type="text"
                id="inviteCode"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase());
                  setError('');
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '0.5rem',
                  color: 'white',
                  fontSize: '1.25rem',
                  textAlign: 'center',
                  letterSpacing: '0.1em',
                  fontFamily: 'monospace',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                placeholder="XXXXXXXX"
                maxLength={8}
                autoComplete="off"
                autoFocus
              />
              {error && (
                <p style={{ 
                  marginTop: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#f87171'
                }}>
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || inviteCode.length < 6}
              style={{
                width: '100%',
                background: isLoading || inviteCode.length < 6 
                  ? 'rgba(59, 130, 246, 0.5)' 
                  : 'linear-gradient(to right, #2563eb, #1d4ed8)',
                color: 'white',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontWeight: '600',
                border: 'none',
                cursor: isLoading || inviteCode.length < 6 ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                transition: 'all 0.2s',
                opacity: isLoading || inviteCode.length < 6 ? '0.5' : '1'
              }}
            >
              {isLoading ? 'Verifying...' : 'Verify Invite Code'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>
              Don't have an invite code?
            </p>
            <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem' }}>
              Argos is currently in private beta.
            </p>
            {/* Add note about existing users */}
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                Already have an account? You'll be redirected to signup/login after verification.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
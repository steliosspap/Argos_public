import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import AuthGuard from '@/components/AuthGuard'
import ErrorBoundary from '@/components/ErrorBoundary'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

import PerformanceToggle from '@/components/PerformanceToggle'

const inter = Inter({ subsets: ['latin'] })

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
}

export const metadata: Metadata = {
  title: 'Argos - Global Military Conflicts & Arms Trade',
  description: 'Live data on global military conflicts and arms trades',
  keywords: ['OSINT', 'intelligence', 'military', 'conflicts', 'geopolitical', 'real-time', 'analysis'],
  authors: [{ name: 'Argos Intelligence' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://argosintel.org'),
  manifest: '/manifest.json',
  icons: {
    icon: '/argos-logo.png',
    apple: '/argos-logo.png'
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Argos OSINT'
  },
  openGraph: {
    title: 'Argos - Global Military Conflicts & Arms Trade',
    description: 'Real-time intelligence on global military conflicts, arms trades, and geopolitical events',
    url: 'https://argosintel.org',
    siteName: 'Argos Intelligence',
    images: [
      {
        url: '/argos-logo.png',
        width: 1200,
        height: 630,
        alt: 'Argos Intelligence'
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Argos - Global Military Conflicts & Arms Trade',
    description: 'Real-time intelligence on global military conflicts and arms trades',
    images: ['/argos-logo.png'],
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="description" content="Argos Intelligence Center - Real-time tracking of global military conflicts and geopolitical events with interactive maps and detailed analysis" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme') || 'dark';
                  document.documentElement.classList.remove('light', 'dark');
                  document.documentElement.classList.add(theme);
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-white dark:bg-gray-950 text-gray-900 dark:text-white`}>
        {/* Skip links for screen reader users */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <a href="#navigation" className="skip-link">
          Skip to navigation
        </a>
        
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <AuthGuard>
              <div className="min-h-screen">
                {/* ARIA live region for announcements */}
                <div aria-live="polite" aria-atomic="true" className="sr-only" id="live-region"></div>
                <div aria-live="assertive" aria-atomic="true" className="sr-only" id="alert-region"></div>
                
                {children}
              </div>
              </AuthGuard>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
        <PerformanceToggle />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
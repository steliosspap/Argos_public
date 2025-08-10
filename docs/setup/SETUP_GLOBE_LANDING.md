# 🌍 Mercenary Globe Landing Page Setup Guide

A comprehensive guide to setting up the new 3D globe landing page with animated beta signup form for your Mercenary war intelligence application.

## 📋 Overview

This setup guide covers the new landing page featuring:
- **3D Spinning Globe**: Interactive Earth background using `react-globe.gl`
- **Animated Landing Page**: Framer Motion-powered fade-in animations
- **Dropdown Beta Signup**: Smooth form animations that slide down from CTA button
- **Supabase Integration**: Form submission to `beta_signups` table
- **Mobile Optimized**: Responsive design with performance optimizations

## 🚀 Installation Steps

### 1. Install Required Packages

```bash
npm install react-globe.gl framer-motion three
```

**Package purposes:**
- `react-globe.gl`: 3D interactive globe component
- `framer-motion`: Smooth animations and transitions
- `three`: 3D graphics library (peer dependency)

### 2. Environment Variables

Ensure your `.env.local` file contains:

```env
# Supabase Configuration (required for form submission)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Setup

Run the beta signups table SQL in your Supabase SQL Editor:

```sql
-- Copy and paste contents of database/beta-signups-table.sql
CREATE TABLE IF NOT EXISTS beta_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  organization TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Create indexes and RLS policies
CREATE INDEX IF NOT EXISTS idx_beta_signups_email ON beta_signups(email);
ALTER TABLE beta_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for all users" ON beta_signups FOR INSERT WITH CHECK (true);
```

## 🎯 Testing the New Landing Page

### 1. Start Development Server

```bash
npm run dev
```

Navigate to `http://localhost:3000` to see the new landing page.

### 2. Test Globe Performance

**Desktop Experience:**
- ✅ Smooth 3D globe rotation
- ✅ Night lights texture with conflict markers
- ✅ Interactive navigation controls

**Mobile Experience:**
- ✅ Optimized rendering for performance
- ✅ Fallback grid pattern for low-end devices
- ✅ Touch-friendly interface

**Performance Checks:**
- Globe should load within 3-5 seconds
- Rotation should be smooth (30+ FPS)
- No memory leaks during extended use

### 3. Test Beta Signup Form

**Form Animation Test:**
1. Click "Sign Up for Beta" button
2. ✅ Form should slide down smoothly (300ms duration)
3. ✅ Semi-transparent white background with backdrop blur
4. ✅ Close button should work and hide form

**Form Submission Test:**
1. Fill out the form with test data:
   - **Name**: John Smith
   - **Email**: test@example.com  
   - **Organization**: Test Organization (optional)

2. Click "Request Beta Access"
3. ✅ Loading spinner should appear
4. ✅ Success message should show
5. ✅ Form should auto-close after 3 seconds

**Error Handling Test:**
1. Try submitting with invalid email format
2. ✅ Should show inline error message
3. Try submitting the same email twice
4. ✅ Should show "email already registered" error

### 4. Verify Database Integration

Check your Supabase dashboard:
1. Go to Table Editor → `beta_signups`
2. ✅ New entries should appear with correct data
3. ✅ Email should be stored in lowercase
4. ✅ Organization should be NULL if not provided

## 🔧 Configuration Options

### Globe Performance Settings

In `components/GlobeBackground.tsx`, you can adjust:

```typescript
// Auto-rotation speed (0.5 = slow, 2.0 = fast)
globe.controls().autoRotateSpeed = 0.5;

// Mobile optimization settings
rendererConfig={{
  antialias: !isMobile,  // Disable on mobile for better performance
  powerPreference: isMobile ? 'low-power' : 'high-performance'
}}

// Point resolution (lower = better performance)
pointResolution={isMobile ? 6 : 12}
```

### Animation Timing

In `app/page.tsx`, adjust fade-in delays:

```typescript
// Title animation delay
transition={{ duration: 0.8, delay: 0.2 }}

// Subtitle delay  
transition={{ duration: 0.8, delay: 0.5 }}

// Button delay
transition={{ duration: 0.8, delay: 0.8 }}
```

### Form Behavior

In `components/BetaSignupForm.tsx`:

```typescript
// Auto-close timeout after success
setTimeout(() => {
  onClose();
  resetForm();
}, 3000); // 3 seconds

// Animation duration
transition={{ duration: 0.3, ease: 'easeInOut' }}
```

## 📱 Mobile Optimization

### Performance Optimizations Applied

1. **Device Detection**: Automatically detects mobile devices
2. **Reduced Quality**: Lower antialiasing and point resolution on mobile
3. **Fallback UI**: Grid pattern background for very low-end devices
4. **Power Preference**: Uses 'low-power' GPU preference on mobile

### Manual Mobile Optimization

If users report performance issues:

```typescript
// In GlobeBackground.tsx, force fallback for specific devices
if (isMobile && window.navigator.hardwareConcurrency < 4) {
  // Show fallback background instead of globe
}

// Reduce globe complexity
pointsData={isMobile ? [] : conflictPoints} // Remove points on mobile
atmosphereAltitude={isMobile ? 0.05 : 0.15} // Reduce atmosphere
```

## 🔄 Replacing Old Beta Flow

### What Was Changed

1. **Homepage**: Completely replaced with 3D globe landing page
2. **Beta Form**: Updated to use dropdown animation instead of separate page
3. **Navigation**: Still links to `/signup` for users who prefer dedicated page
4. **Database**: Uses same `beta_signups` table structure

### Legacy Support

The old `/signup` page still works for users who:
- Have bookmarked the old signup URL
- Prefer a dedicated form page
- Are coming from external links

Both forms submit to the same database table.

## 🚀 Deployment

### Vercel Deployment

```bash
# Build and deploy
npm run build
vercel

# Add environment variables in Vercel dashboard:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Performance Considerations

**CDN Configuration:**
- Globe textures are loaded from unpkg.com CDN
- Images are automatically optimized by Next.js
- Static assets are cached by Vercel Edge Network

**Bundle Size:**
- react-globe.gl adds ~400KB to bundle
- Dynamic imports reduce initial load time
- Three.js is tree-shaken to include only used components

## 🐛 Troubleshooting

### Common Issues

**1. Globe not loading:**
```bash
# Check console for errors
# Common causes:
# - Missing Three.js dependency
# - WebGL not supported in browser
# - Network issues loading textures
```

**2. Form submission failing:**
```bash
# Check network tab for API errors
# Verify Supabase environment variables
# Check RLS policies in Supabase dashboard
```

**3. Animations not working:**
```bash
# Verify Framer Motion installation
# Check for CSS conflicts
# Ensure JavaScript is enabled
```

**4. Performance issues on mobile:**
```bash
# Enable performance fallbacks
# Reduce globe complexity
# Test on actual devices, not desktop DevTools
```

### Debug Mode

Enable debug logging:

```typescript
// In GlobeBackground.tsx
console.log('Globe loading...', { isMobile, deviceInfo });

// In BetaSignupForm.tsx  
console.log('Form submission:', { formData, response });
```

## ✅ Launch Checklist

Before going live:

- [ ] Test globe performance on various devices
- [ ] Verify form submission to database
- [ ] Check email validation and error handling
- [ ] Test responsive design breakpoints
- [ ] Verify all animations work smoothly
- [ ] Confirm Supabase RLS policies are correct
- [ ] Test with real email addresses
- [ ] Check console for any errors
- [ ] Verify environment variables in production
- [ ] Test fallback experience for older browsers

## 🔗 Key Files Created/Modified

- `components/GlobeBackground.tsx` - 3D globe component
- `components/BetaSignupForm.tsx` - Animated form (updated)
- `components/LegacyBetaSignupForm.tsx` - Wrapper for old signup page
- `app/page.tsx` - New landing page (completely replaced)
- `database/beta-signups-table.sql` - Database schema
- `package.json` - Added new dependencies

## 📞 Support

If you encounter issues:

1. Check browser console for JavaScript errors
2. Verify Supabase connection using dashboard
3. Test form submission manually in Supabase
4. Check WebGL support: `https://get.webgl.org/`
5. Review this guide's troubleshooting section

---

**🎉 Congratulations!** Your Mercenary application now has a stunning 3D globe landing page with smooth beta signup integration. The combination of visual impact and functional design creates a professional first impression for your war intelligence platform.
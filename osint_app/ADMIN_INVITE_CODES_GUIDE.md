# Admin Invite Codes Guide

## Authentication Fixed ✅

The authentication issue has been resolved. The API now properly validates JWT tokens from either cookies or Authorization headers.

## How to Access Admin Invite Codes

1. **First, log in as an admin:**
   - Go to http://localhost:3000/login
   - Use admin credentials:
     - Username: `admin`
     - Password: `admin123`

2. **Then navigate to the invite codes page:**
   - Go to http://localhost:3000/admin/invite-codes
   - Or click "Invite Codes" from the admin menu

## Features

The invite codes page now has two sections:

### 1. Newly Generated Codes (Green Section)
- Appears after clicking "Generate"
- Shows codes that were just created
- Click on any code to copy it to clipboard
- These codes will move to the main table on page refresh

### 2. All Invite Codes (Main Table)
- Shows all existing codes from the database
- Displays usage statistics
- Shows assigned users
- Allows activating/deactivating codes

## Technical Details

### What Was Fixed
1. Updated authentication middleware to use JWT tokens instead of Supabase sessions
2. The app uses a hybrid authentication system:
   - JWT tokens stored in `authToken` cookie
   - Custom user table in database
   - Supabase client for database operations only

### API Authentication
The API endpoints now accept authentication via:
- Cookie: `authToken=<jwt-token>`
- Header: `Authorization: Bearer <jwt-token>`

### Test Script
You can test the authentication using:
```bash
node scripts/test-login.js
```

This will:
1. Log in as admin
2. Get a JWT token
3. Test the invite codes API
4. Show the number of existing codes
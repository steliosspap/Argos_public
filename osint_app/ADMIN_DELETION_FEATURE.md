# Admin Event Deletion Feature

## Overview
This feature enables designated admin users (Stelios and Alex) to delete events from the live Argos site with soft archiving capabilities. Deleted events are preserved for future retrieval or audit.

## Implementation Details

### Database Changes
1. **Migration File**: `database/migrations/add_soft_delete_to_events.sql`
   - Adds soft delete columns to events table:
     - `deleted` (boolean, default false)
     - `deleted_at` (timestamp)
     - `deleted_by` (user UUID reference)
     - `deletion_reason` (text)
   - Creates `archived_events` view for deleted events
   - Creates `event_deletion_log` table for audit trail
   - Updates `events_with_coords` view to exclude deleted events

### API Endpoints
1. **Delete Event**: `POST /api/admin/events/delete`
   - Admin-only endpoint
   - Soft deletes an event
   - Requires: `eventId` and optional `deletionReason`
   - Returns success confirmation

2. **Get Deleted Events**: `GET /api/admin/events/delete`
   - Admin-only endpoint
   - Retrieves paginated list of deleted events
   - Includes deletion metadata

3. **Restore Event**: `POST /api/admin/events/restore`
   - Admin-only endpoint
   - Restores a soft-deleted event
   - Requires: `eventId`

### Frontend Pages
1. **Admin Event Management**: `/admin/events`
   - Lists all live events
   - Search functionality
   - Delete button with confirmation modal
   - Pagination support

2. **Archived Events**: `/admin/events/archived`
   - Lists all deleted events
   - Shows deletion information (who, when, why)
   - Restore functionality
   - Search and pagination

### Access Control
- Only users with `role: 'admin'` can access admin features
- Admin link appears in Intelligence Center footer for admin users
- All admin routes redirect non-admins to login

## Setup Instructions

### 1. Run Database Migration
```bash
# Apply the soft delete migration
psql -U your_user -d your_database -f database/migrations/add_soft_delete_to_events.sql
```

### 2. Provision Admin Account
```bash
# Run the provisioning script
node scripts/provision-admin-accounts.js
```

This will create a shared admin account:
- **Username**: `admin`
- **Password**: `admin123`
- **Email**: admin@argos.ai

Both Alex and Stelios can use these same credentials to access admin features.

### 3. Verify Setup
1. Login as an admin user
2. Navigate to Intelligence Center
3. Look for the "Admin" link in the footer
4. Click to access the admin event management interface

## Features

### Event Deletion Workflow
1. Admin views all live events in `/admin/events`
2. Clicks delete button on an event
3. Confirmation modal appears
4. Admin selects deletion reason (optional):
   - Duplicate
   - Irrelevant
   - Low credibility
   - Incorrect information
   - Not conflict-related
   - Other
5. Event is soft-deleted and removed from all live views
6. Deletion is logged with timestamp and admin info

### Event Restoration
1. Admin navigates to `/admin/events/archived`
2. Views all deleted events with deletion metadata
3. Clicks "Restore" on an event
4. Confirmation modal appears
5. Event is restored to live views
6. Restoration is logged

### Audit Trail
- All deletions are logged in `event_deletion_log` table
- Logs include:
  - Event snapshot (full event data at deletion time)
  - Admin who deleted (email and name)
  - Timestamp
  - Deletion reason
  - Event ID reference

### Security Features
- JWT token authentication required
- Role-based access control (admin only)
- All actions are logged
- Soft delete preserves data integrity
- RLS policies enforce access restrictions

## Technical Notes

### Excluded from Live Views
All queries that populate user-facing views now include `.eq('deleted', false)`:
- `/api/events` - Main events API
- `/api/events/geojson` - GeoJSON API
- `events_with_coords` view - Database view

### Performance Optimizations
- Indexes on `deleted`, `deleted_at`, and `deleted_by` columns
- Filtered indexes for better query performance
- Pagination on all list views

### Error Handling
- Graceful fallbacks for missing Supabase connection
- Proper error messages for unauthorized access
- Validation for all inputs
- Prevention of double deletion/restoration

## Future Enhancements
- Bulk deletion capabilities
- Advanced filtering on archived events
- Export deleted events report
- Scheduled permanent deletion after X days
- Email notifications for deletions
- More granular permissions (e.g., delete own region only)
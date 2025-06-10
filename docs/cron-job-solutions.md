# Cron Job Solutions for Vercel Hobby Plan

## Problem
Vercel's hobby plan only allows daily cron jobs, but the application needs to update shared key models every 4 hours (`0 */4 * * *`).

## Solutions Implemented

### 1. ✅ Daily Vercel Cron (Current Active Solution)
**File:** `vercel.json`
- **Schedule:** `0 2 * * *` (daily at 2 AM UTC)
- **Pros:** Simple, no additional setup required
- **Cons:** Less frequent updates (24 hours vs 4 hours)

### 2. 🔄 Database-Based Scheduling (PostgreSQL)
**File:** `deployment/database/migrations/add-model-update-cron.sql`
- **Schedule:** Every 4 hours via pg_cron
- **Pros:** Runs at desired frequency, leverages existing database
- **Cons:** Requires pg_cron extension, limited to marking keys for update

**Setup:**
```sql
-- Run the migration
\i deployment/database/migrations/add-model-update-cron.sql

-- Check if cron job is scheduled
SELECT * FROM cron.job WHERE jobname = 'update-shared-key-models';
```

### 3. 🌐 Client-Side Triggered Updates
**Files:** 
- `app/api/models/update/route.ts` - Smart update API
- `hooks/useModelUpdater.ts` - React hook for automatic updates

**Features:**
- Automatic updates when users visit the app
- Rate limiting (30-minute cooldown)
- Batch processing (max 5 keys per request)
- Random delays to prevent thundering herd

**Usage:**
```typescript
import { useModelUpdater } from '@/hooks/useModelUpdater';

function MyComponent() {
  const { updateStatus, triggerUpdate, isUpdating } = useModelUpdater();
  
  return (
    <div>
      {updateStatus?.keysNeedingUpdate > 0 && (
        <button onClick={triggerUpdate} disabled={isUpdating}>
          Update {updateStatus.keysNeedingUpdate} keys
        </button>
      )}
    </div>
  );
}
```

### 4. 🚀 GitHub Actions (External Cron)
**File:** `.github/workflows/update-models.yml`
- **Schedule:** Every 4 hours
- **Pros:** Runs at desired frequency, external to Vercel
- **Cons:** Requires GitHub repository, needs API authentication

**Setup:**
1. Add repository secrets:
   - `APP_URL`: Your application URL (e.g., `https://your-app.vercel.app`)
   - `CRON_API_KEY`: Optional API key for authentication

2. The workflow will automatically run every 4 hours

## Recommended Approach

### For Immediate Use: Daily Vercel Cron
The simplest solution is already implemented - daily updates at 2 AM UTC.

### For Better Frequency: Client-Side + GitHub Actions
1. **Enable client-side updates** by adding the hook to your main layout:
   ```typescript
   // In your main layout or dashboard
   import { useModelUpdater } from '@/hooks/useModelUpdater';
   
   export default function Layout() {
     useModelUpdater(); // This will auto-update when users visit
     // ... rest of your component
   }
   ```

2. **Set up GitHub Actions** for consistent 4-hour updates:
   - Ensure the workflow file is in your repository
   - Add the required secrets to your GitHub repository settings

### For Advanced Users: Database Scheduling
If you have pg_cron enabled in your PostgreSQL/Supabase setup:
1. Run the migration script
2. The database will mark keys for updates every 4 hours
3. Client-side or API calls will process the marked keys

## API Endpoints

### Check Update Status
```bash
GET /api/models/update
```
Returns information about keys needing updates.

### Trigger Manual Update
```bash
POST /api/models/update
```
Updates up to 5 keys that need updating.

### Legacy Cron Endpoint
```bash
GET /api/cron/update-models
```
Batch updates up to 10 keys (used by Vercel cron and GitHub Actions).

## Monitoring

### Check Cron Job Status
```bash
# Check if keys need updating
curl https://your-app.vercel.app/api/models/update

# Trigger manual update
curl -X POST https://your-app.vercel.app/api/models/update
```

### Database Queries
```sql
-- Check keys needing updates
SELECT id, base_url, updated_at, 
       metadata->>'needs_model_update' as needs_update
FROM shared_keys 
WHERE is_active = true 
  AND (metadata->>'needs_model_update' = 'true' 
       OR updated_at < NOW() - INTERVAL '4 hours');

-- Check cron job status (if using database scheduling)
SELECT * FROM cron.job WHERE jobname = 'update-shared-key-models';
```

## Troubleshooting

### Vercel Cron Not Working
- Check Vercel dashboard for cron job logs
- Ensure the schedule format is correct
- Verify the API endpoint responds correctly

### GitHub Actions Failing
- Check repository secrets are set correctly
- Verify the APP_URL is accessible
- Check workflow logs in GitHub Actions tab

### Client-Side Updates Not Triggering
- Check browser console for errors
- Verify the hook is properly imported and used
- Check network tab for API calls to `/api/models/update`

## Performance Considerations

- **Rate Limiting:** Client-side updates have a 30-minute cooldown
- **Batch Size:** Maximum 5 keys per client update, 10 per cron job
- **Timeout:** API calls have reasonable timeouts to prevent hanging
- **Random Delays:** Client-side updates use random delays to prevent simultaneous requests

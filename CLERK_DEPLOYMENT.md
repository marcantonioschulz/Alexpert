# Clerk Multi-Tenant Authentication Deployment Guide

This guide covers deploying the upgraded Alexpert application with Clerk authentication, multi-tenant organization support, and quota management.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Clerk Setup](#clerk-setup)
3. [Environment Variables](#environment-variables)
4. [Database Migration](#database-migration)
5. [Backend Deployment](#backend-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Webhook Configuration](#webhook-configuration)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 20+ (check `.nvmrc`)
- PostgreSQL 14+ database
- Clerk account (https://clerk.com)
- Docker (optional, for containerized deployment)

## Clerk Setup

### 1. Create Clerk Application

1. Go to https://dashboard.clerk.com
2. Click "Add application"
3. Choose your application name (e.g., "Alexpert")
4. Select authentication options:
   - ✅ Email
   - ✅ Google (recommended)
   - ✅ GitHub (optional)
5. Enable "Organizations" feature in settings

### 2. Configure Clerk Settings

**Organization Settings:**
1. Navigate to "Organizations" in your Clerk dashboard
2. Enable "Organizations" feature
3. Set organization creation: "Anyone can create"
4. Enable "Personal accounts" if needed

**Webhook Setup:**
1. Go to "Webhooks" in Clerk dashboard
2. Click "Add Endpoint"
3. Enter your webhook URL: `https://your-domain.com/api/webhooks/clerk`
4. Select events to listen to:
   - `user.created`
   - `user.updated`
   - `user.deleted`
   - `organization.created`
   - `organization.updated`
   - `organization.deleted`
   - `organizationMembership.created`
   - `organizationMembership.updated`
   - `organizationMembership.deleted`
5. Copy the "Signing Secret" (starts with `whsec_`)

### 3. Get API Keys

From your Clerk dashboard:
1. Go to "API Keys"
2. Copy:
   - **Publishable Key** (starts with `pk_test_` or `pk_live_`)
   - **Secret Key** (starts with `sk_test_` or `sk_live_`)

## Environment Variables

### Backend (.env)

Update `backend/.env` with the following variables:

```bash
# Existing variables
NODE_ENV=production
APP_ENV=prod
PORT=4000
API_KEY=your-super-secret-api-key-min-16-chars
OPENAI_API_KEY=sk-your-openai-api-key
REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17
RESPONSES_MODEL=gpt-4o-mini
DATABASE_URL=postgresql://user:password@host:5432/alexpert
CORS_ORIGIN=https://your-frontend-domain.com
JWT_SECRET=your-jwt-secret-min-32-chars-for-security

# NEW: Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Frontend (.env)

Create `frontend/.env` with:

```bash
# Backend API
VITE_BACKEND_URL=https://your-backend-domain.com

# NEW: Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Environment Variable Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (frontend & backend) | `pk_test_abc123...` |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key (backend only) | `sk_test_xyz789...` |
| `CLERK_WEBHOOK_SECRET` | Optional* | Webhook signature verification | `whsec_def456...` |

*Required for production to verify webhook authenticity.

## Database Migration

### Option 1: Apply Migration (Existing Database)

If you have an existing database with data:

**⚠️ WARNING:** This migration is DESTRUCTIVE and will drop all existing tables!

```bash
cd backend

# Backup your database first!
pg_dump -U postgres alexpert > backup_before_clerk.sql

# Apply the migration
DATABASE_URL="your-database-url" npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

### Option 2: Reset Database (Clean Start)

For clean slate deployment:

```bash
cd backend

# Reset database (drops all data!)
DATABASE_URL="your-database-url" npx prisma migrate reset --force

# Generate Prisma Client
npx prisma generate
```

### Option 3: Manual SQL Execution

If you need more control:

```bash
cd backend
psql -U postgres -d alexpert -f prisma/migrations/20251027165134_add_clerk_multi_tenant/migration.sql
npx prisma generate
```

## Backend Deployment

### Docker Deployment

1. **Update docker-compose.yml** (if using Docker):

```yaml
backend:
  environment:
    # Add Clerk variables
    - CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY}
    - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
    - CLERK_WEBHOOK_SECRET=${CLERK_WEBHOOK_SECRET}
```

2. **Build and deploy**:

```bash
docker compose pull
docker compose up -d
```

### Node.js Deployment

```bash
cd backend
npm install
npm run build
NODE_ENV=production npm start
```

### Verify Backend

```bash
curl https://your-backend-domain.com/health
# Should return: {"status":"ok","timestamp":"..."}
```

## Frontend Deployment

### Build and Deploy

```bash
cd frontend
npm install
npm run build
# Deploy dist/ folder to your hosting service
```

### Supported Hosting Providers

- **Vercel**: Automatic deployment from Git
- **Netlify**: Drag-and-drop or Git integration
- **Cloudflare Pages**: Git integration
- **AWS S3 + CloudFront**: Static site hosting

### Vercel Example

```bash
npm install -g vercel
cd frontend
vercel --prod
```

## Webhook Configuration

### Local Development

Use a tunnel service to expose your local backend:

```bash
# Install ngrok
npm install -g ngrok

# Expose local backend
ngrok http 4000

# Update Clerk webhook URL to ngrok URL
# https://xxxx-xx-xx-xx-xx.ngrok-free.app/api/webhooks/clerk
```

### Production

1. Ensure your backend is accessible at `https://your-domain.com`
2. Webhook endpoint is: `https://your-domain.com/api/webhooks/clerk`
3. Verify webhook secret is set in backend `.env`
4. Test webhook by creating a user in Clerk dashboard

### Verify Webhooks

Check backend logs for webhook events:

```bash
# Docker
docker compose logs -f backend | grep webhook

# Node.js
# Check your application logs
```

## Testing

### 1. Test Authentication Flow

```bash
# Open frontend in browser
open https://your-frontend-domain.com

# Try signing up
1. Click "Sign Up"
2. Enter email and password
3. Verify email (check inbox)
4. Should redirect to home page

# Try signing in
1. Sign out
2. Click "Sign In"
3. Enter credentials
4. Should redirect to home page
```

### 2. Test Organization Creation

```bash
# In the app
1. Click on organization switcher
2. Create new organization
3. Enter organization name
4. Verify organization is created
5. Check backend logs for sync events
```

### 3. Test Quota System

```bash
# Via API
curl -X GET https://your-backend-domain.com/api/organizations/{org-id}/quota \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "X-Organization-ID: org_xxxx"

# Expected response:
{
  "current": 0,
  "limit": 50,
  "remaining": 50,
  "resetDate": "2024-11-27T00:00:00.000Z",
  "isUnlimited": false,
  "canProceed": true
}
```

### 4. Test Webhook Delivery

```bash
# In Clerk dashboard
1. Go to Webhooks
2. Select your webhook endpoint
3. Click "Test" tab
4. Send test event (e.g., user.created)
5. Check backend logs for processing confirmation
```

## Troubleshooting

### Issue: "Missing Clerk Publishable Key" Error

**Solution:**
- Verify `VITE_CLERK_PUBLISHABLE_KEY` is set in frontend `.env`
- Restart frontend dev server
- Clear browser cache

### Issue: Webhook Signature Verification Failed

**Solution:**
- Check `CLERK_WEBHOOK_SECRET` matches Clerk dashboard
- Ensure webhook URL is correct
- Verify request reaches backend (check logs)

### Issue: Database Migration Fails

**Solution:**
```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1"

# Check migration status
cd backend
npx prisma migrate status

# Reset and try again
npx prisma migrate reset --force
npx prisma migrate deploy
```

### Issue: User Not Syncing to Database

**Solution:**
- Check backend logs for errors
- Verify Clerk webhooks are configured
- Test webhook delivery in Clerk dashboard
- Ensure `CLERK_SECRET_KEY` is correct

### Issue: Quota Status Returns 404

**Solution:**
- Ensure organization exists in database
- Check that user is member of organization
- Verify `X-Organization-ID` header is sent
- Check backend logs for errors

### Issue: Organization Switcher Not Showing

**Solution:**
- Verify "Organizations" is enabled in Clerk
- Check user is member of at least one organization
- Ensure `hidePersonal` prop is appropriate
- Check browser console for errors

## Security Checklist

Before going to production:

- [ ] All environment variables are set correctly
- [ ] `CLERK_WEBHOOK_SECRET` is configured
- [ ] CORS is configured for your domain only
- [ ] HTTPS is enabled on all endpoints
- [ ] Database credentials are secure
- [ ] JWT_SECRET is at least 32 characters
- [ ] API_KEY is at least 16 characters
- [ ] Clerk is in production mode (live keys)
- [ ] Webhook endpoint is accessible
- [ ] Rate limiting is enabled
- [ ] Error messages don't expose sensitive data

## Monitoring

### Key Metrics to Monitor

1. **Authentication**: Track sign-up/sign-in success rates
2. **Webhooks**: Monitor webhook delivery and processing
3. **Quota**: Track quota usage across organizations
4. **API Errors**: Monitor 401/403 errors for auth issues

### Recommended Tools

- **Clerk Dashboard**: Monitor authentication events
- **Sentry**: Track application errors
- **DataDog/New Relic**: Full application monitoring
- **Grafana + Prometheus**: Custom metrics (see `monitoring/` folder)

## Support

For issues or questions:

- **Clerk Documentation**: https://clerk.com/docs
- **GitHub Issues**: [Your repository]/issues
- **Clerk Support**: https://clerk.com/support

## Migration Notes

### Breaking Changes

1. **Authentication System**: Migrated from custom JWT to Clerk
   - Old admin tokens will no longer work
   - Users must sign up/sign in through Clerk

2. **Database Schema**: Complete rewrite with multi-tenancy
   - Old data is not automatically migrated
   - Manual data migration script required if preserving data

3. **API Changes**: All API endpoints now require Clerk authentication
   - Update API clients to use Clerk tokens
   - Include `X-Organization-ID` header where needed

### Backward Compatibility

The old admin authentication system is still available for backward compatibility:
- Admin endpoints: `/api/admin/*`
- Admin login: `/api/admin/login`
- Will be deprecated in future versions

## Next Steps

After successful deployment:

1. **Configure Plans**: Update organization plans and quotas in database
2. **Invite Users**: Send invitations to team members
3. **Monitor Usage**: Track quota usage and adjust limits
4. **Customize**: Adjust Clerk branding and email templates
5. **Scale**: Consider upgrading Clerk plan for higher limits

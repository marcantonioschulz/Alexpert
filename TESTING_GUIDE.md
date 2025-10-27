# Clerk Multi-Tenant System - Testing Guide

Complete guide for testing the Clerk authentication, multi-tenant, and quota management implementation.

## Prerequisites

Before testing, ensure you have:

- ✅ Clerk account set up (see `CLERK_DEPLOYMENT.md`)
- ✅ Environment variables configured
- ✅ Database migration applied
- ✅ Backend and frontend running

## Quick Start Testing

### 1. Backend Health Check

```bash
curl http://localhost:4000/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2024-...",
  "uptime": 123.45,
  "environment": "dev"
}
```

### 2. Start Backend

```bash
cd backend

# Make sure you have a .env file with Clerk keys
cp .env.example .env
# Edit .env and add your Clerk keys

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migration (DESTRUCTIVE - backs up first!)
# WARNING: This will DROP all existing tables
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/alexpert" npx prisma migrate deploy

# Start backend
npm run dev
```

### 3. Start Frontend

```bash
cd frontend

# Make sure you have a .env file with Clerk key
cp .env.example .env
# Edit .env and add VITE_CLERK_PUBLISHABLE_KEY

# Install dependencies
npm install

# Start frontend
npm run dev
```

## Manual Testing Scenarios

### Test 1: User Sign-Up Flow ✅

**Steps:**
1. Open frontend: `http://localhost:3000`
2. You should be redirected to `/sign-in`
3. Click "Sign Up"
4. Enter email and password
5. Verify email (check inbox)
6. You should be redirected to home page `/`

**Expected Results:**
- ✅ User created in Clerk dashboard
- ✅ User synced to local database (check with `psql`)
- ✅ Backend logs show `User authenticated via Clerk`
- ✅ Webhook received: `user.created`

**Verify in Database:**
```sql
-- Connect to database
psql postgresql://postgres:postgres@localhost:5432/alexpert

-- Check user was created
SELECT id, "clerkUserId", email, name, "emailVerified", "createdAt"
FROM "User"
ORDER BY "createdAt" DESC LIMIT 1;
```

### Test 2: Organization Creation ✅

**Steps:**
1. Sign in to the application
2. Click on organization switcher (top-right)
3. Click "Create Organization"
4. Enter organization name: "Test Company"
5. Click "Create"

**Expected Results:**
- ✅ Organization created in Clerk
- ✅ Organization synced to database
- ✅ User is set as OWNER
- ✅ Initial quota: 50 conversations (FREE plan)
- ✅ Webhook received: `organization.created`

**Verify in Database:**
```sql
-- Check organization
SELECT id, "clerkOrgId", name, slug, plan, "monthlyQuota", "currentUsage"
FROM "Organization"
ORDER BY "createdAt" DESC LIMIT 1;

-- Check membership
SELECT om.id, u.email, om.role, om."joinedAt"
FROM "OrganizationMember" om
JOIN "User" u ON om."userId" = u.id
ORDER BY om."joinedAt" DESC LIMIT 5;
```

### Test 3: Quota Check API ✅

**Steps:**
```bash
# Get Clerk token (from browser DevTools)
# 1. Open DevTools → Application → Local Storage
# 2. Find Clerk session token
# OR use the Clerk session in your app

# Get your organization ID from Clerk dashboard or database
ORG_ID="org_xxxxx"
TOKEN="your-clerk-jwt-token"

# Test quota endpoint
curl -X GET "http://localhost:4000/api/organizations/${ORG_ID}/quota" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "current": 0,
  "limit": 50,
  "remaining": 50,
  "resetDate": "2024-11-27T00:00:00.000Z",
  "isUnlimited": false,
  "canProceed": true
}
```

### Test 4: Create Conversation with Quota ✅

**Steps:**
```bash
# Use token from previous test
TOKEN="your-clerk-jwt-token"
ORG_ID="org_xxxxx"

# Create conversation (this increments quota)
curl -X POST "http://localhost:4000/api/start" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-Organization-ID: ${ORG_ID}" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "conversationId": "cm3abc123..."
}
```

**Verify Quota Increment:**
```bash
# Check quota again
curl -X GET "http://localhost:4000/api/organizations/${ORG_ID}/quota" \
  -H "Authorization: Bearer ${TOKEN}"

# Should show:
# "current": 1, "remaining": 49
```

**Verify in Database:**
```sql
-- Check conversation was created
SELECT id, "userId", "organizationId", "createdAt"
FROM "Conversation"
ORDER BY "createdAt" DESC LIMIT 1;

-- Check quota was incremented
SELECT name, "currentUsage", "monthlyQuota"
FROM "Organization"
WHERE "clerkOrgId" = 'org_xxxxx';
```

### Test 5: Quota Enforcement ✅

**Test Quota Limit:**

```bash
# Manually set quota to limit
psql postgresql://postgres:postgres@localhost:5432/alexpert -c \
  "UPDATE \"Organization\"
   SET \"currentUsage\" = 50, \"monthlyQuota\" = 50
   WHERE \"clerkOrgId\" = 'org_xxxxx';"

# Try to create conversation (should fail)
curl -X POST "http://localhost:4000/api/start" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-Organization-ID: ${ORG_ID}" \
  -H "Content-Type: application/json"
```

**Expected Response (429 Too Many Requests):**
```json
{
  "code": "QUOTA_EXCEEDED",
  "message": "Monthly quota exceeded. Limit: 50, Current: 50",
  "context": {
    "current": 50,
    "limit": 50,
    "resetDate": "2024-11-27T00:00:00.000Z"
  }
}
```

### Test 6: Webhook Delivery ✅

**Setup Local Webhook Testing:**

```bash
# Install ngrok
npm install -g ngrok

# Expose local backend
ngrok http 4000

# Copy the ngrok URL (e.g., https://abc123.ngrok.io)
# Update Clerk webhook endpoint to: https://abc123.ngrok.io/api/webhooks/clerk
```

**Test Webhook:**

1. Go to Clerk Dashboard → Webhooks
2. Select your webhook endpoint
3. Go to "Testing" tab
4. Click "Send Example" → `user.created`
5. Check backend logs

**Expected Backend Logs:**
```
INFO Processing Clerk webhook type=user.created
INFO User created userId=user_xxx email=test@example.com
```

**Verify in Database:**
```sql
-- User should be created/updated
SELECT * FROM "User" WHERE "clerkUserId" = 'user_xxx';
```

### Test 7: Organization List API ✅

```bash
curl -X GET "http://localhost:4000/api/conversations?limit=10&offset=0" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-Organization-ID: ${ORG_ID}"
```

**Expected Response:**
```json
{
  "conversations": [
    {
      "id": "cm3...",
      "transcript": null,
      "score": null,
      "feedback": null,
      "createdAt": "2024-10-27T..."
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

### Test 8: Frontend Quota Widget ✅

**Steps:**
1. Sign in to application
2. Navigate to page showing QuotaUsage component
3. Widget should display:
   - Current plan (FREE/PROFESSIONAL/etc.)
   - Usage progress bar
   - Conversations used / total
   - Reset date

**Expected Display:**
```
┌─────────────────────────────────┐
│ Quota Usage      [FREE]         │
│ Test Company                    │
│                                 │
│ 1 / 50 conversations           │
│ ████░░░░░░░░░░░░░░░░  2%      │
│                                 │
│ Remaining: 49 conversations    │
│ Resets on: 11/27/2024         │
└─────────────────────────────────┘
```

### Test 9: Multi-Tenant Isolation ✅

**Test Data Isolation:**

```bash
# User A creates conversation in Org 1
TOKEN_A="user-a-token"
ORG_1="org_xxx"

curl -X POST "http://localhost:4000/api/start" \
  -H "Authorization: Bearer ${TOKEN_A}" \
  -H "X-Organization-ID: ${ORG_1}"

# User B (different org) tries to access Org 1's conversations
TOKEN_B="user-b-token"
ORG_2="org_yyy"

curl -X GET "http://localhost:4000/api/conversations" \
  -H "Authorization: Bearer ${TOKEN_B}" \
  -H "X-Organization-ID: ${ORG_2}"

# Should NOT see Org 1's conversations
```

**Expected:** User B should only see their own organization's conversations.

## Automated Testing

### Backend Unit Tests

```bash
cd backend

# Run all tests
npm test

# Run specific test file
npm test -- quota.test.ts

# Run with coverage
npm run test:coverage

# Expected: All tests pass ✅
```

### Frontend Component Tests

```bash
cd frontend

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Expected: All tests pass ✅
```

## Common Issues & Solutions

### Issue: "Missing Clerk Publishable Key"

**Solution:**
```bash
# Backend
echo 'CLERK_PUBLISHABLE_KEY=pk_test_xxx' >> backend/.env
echo 'CLERK_SECRET_KEY=sk_test_xxx' >> backend/.env

# Frontend
echo 'VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx' >> frontend/.env

# Restart servers
```

### Issue: "Organization not found"

**Solution:**
- Ensure organization is created in Clerk
- Check webhook was delivered successfully
- Verify organization exists in database:
  ```sql
  SELECT * FROM "Organization" WHERE "clerkOrgId" = 'org_xxx';
  ```

### Issue: "Webhook signature verification failed"

**Solution:**
```bash
# Ensure CLERK_WEBHOOK_SECRET is set correctly
echo 'CLERK_WEBHOOK_SECRET=whsec_xxx' >> backend/.env

# Restart backend
npm run dev
```

### Issue: Database Migration Fails

**Solution:**
```bash
# Reset database (WARNING: Deletes all data!)
cd backend
npx prisma migrate reset --force

# Apply migration
npx prisma migrate deploy

# Generate client
npx prisma generate
```

## Performance Testing

### Load Test Quota System

```bash
# Install Apache Bench
brew install apache-bench  # macOS
apt-get install apache2-utils  # Ubuntu

# Test 100 requests, 10 concurrent
ab -n 100 -c 10 \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-Organization-ID: ${ORG_ID}" \
  http://localhost:4000/api/organizations/${ORG_ID}/quota

# Expected: All requests succeed, ~10-50ms per request
```

## Security Testing

### Test Authentication Bypass

```bash
# Try to access protected endpoint without token
curl http://localhost:4000/api/conversations

# Expected: 401 Unauthorized
```

### Test Organization Access Control

```bash
# Try to access another org's data
curl -X GET "http://localhost:4000/api/organizations/org_other_company/quota" \
  -H "Authorization: Bearer ${TOKEN}"

# Expected: 403 Forbidden (if not a member)
```

## Production Readiness Checklist

Before deploying to production:

- [ ] All manual tests pass
- [ ] All automated tests pass
- [ ] Webhooks configured and tested
- [ ] Environment variables set correctly
- [ ] Database migration applied
- [ ] CORS configured for production domain
- [ ] Rate limiting tested
- [ ] Error handling verified
- [ ] Logging works correctly
- [ ] Monitoring set up (optional)
- [ ] Backup strategy in place

## Monitoring in Production

### Key Metrics to Track

1. **Authentication Success Rate**
   - Sign-ups per day
   - Sign-ins per day
   - Failed authentications

2. **Quota Usage**
   - Organizations hitting limits
   - Average usage per plan tier
   - Quota reset success rate

3. **Webhook Delivery**
   - Webhook success rate
   - Webhook latency
   - Failed webhooks requiring retry

4. **API Performance**
   - Response times per endpoint
   - Error rates
   - Database query performance

## Support

If you encounter issues:

1. Check backend logs: `npm run dev` (look for errors)
2. Check frontend console: Browser DevTools → Console
3. Verify Clerk dashboard for user/org status
4. Check database state with psql queries
5. Review `CLERK_DEPLOYMENT.md` for setup steps

## Next Steps

After successful testing:

1. Deploy to staging environment
2. Run full test suite on staging
3. Invite beta users
4. Monitor for issues
5. Deploy to production

---

**Last Updated:** 2024-10-27
**Version:** 1.0.0
**Status:** ✅ Production Ready

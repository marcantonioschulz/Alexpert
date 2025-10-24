# Migration Guide

This document provides step-by-step instructions for upgrading Alexpert between major versions.

## Table of Contents

- [v1.0.0 → v1.1.0](#v100--v110)
- [Breaking Changes](#breaking-changes)
- [Post-Migration Verification](#post-migration-verification)

---

## v1.0.0 → v1.1.0

### Overview

Version 1.1.0 includes important security updates, dependency upgrades, and improvements to API key validation. This release includes several **breaking changes** that require manual configuration updates.

### Prerequisites

Before starting the migration:

1. Backup your database:
   ```bash
   docker compose exec db pg_dump -U postgres alexpert > backup_$(date +%Y%m%d).sql
   ```

2. Stop all running containers:
   ```bash
   docker compose down
   ```

3. Pull the latest changes:
   ```bash
   git pull origin main
   ```

### Breaking Changes

#### 1. Container Names Simplified

Container names have been changed from `alexpert-*` to simple names for better Docker network integration.

**Old names (v1.0.0):**
- `alexpert-backend`
- `alexpert-db`
- `alexpert-frontend`

**New names (v1.1.0):**
- `backend`
- `db`
- `frontend`

**Required Actions:**

**Step 1: Update `.env` file**

Update the following environment variables in your `.env` file:

```bash
# Old (v1.0.0):
DATABASE_URL=postgresql://postgres:postgres@alexpert-db:5432/alexpert
VITE_BACKEND_URL=http://alexpert-backend:4000

# New (v1.1.0):
DATABASE_URL=postgresql://postgres:postgres@db:5432/alexpert
VITE_BACKEND_URL=http://backend:4000
```

**Step 2: Update Reverse Proxy Configuration**

If you're using **Nginx Proxy Manager** or another reverse proxy, update the upstream container names:

```nginx
# Old configuration:
set $server "alexpert-frontend";

# New configuration:
set $server "frontend";
```

For backend API proxying:

```nginx
# Old configuration:
set $server "alexpert-backend";

# New configuration:
set $server "backend";
```

**Important:** Restart your reverse proxy after making these changes.

#### 2. External Docker Network Required

Version 1.1.0 requires an **external Docker network** named `frontend` for integration with reverse proxies like Nginx Proxy Manager.

**Required Actions:**

**Step 1: Create the external network** (if it doesn't exist):

```bash
docker network create frontend
```

**Step 2: Verify the network exists:**

```bash
docker network ls | grep frontend
```

You should see:
```
NETWORK ID     NAME       DRIVER    SCOPE
xxxxxx         frontend   bridge    local
```

**Note:** The `docker-compose.yml` already includes the network configuration:

```yaml
networks:
  app-network:
    driver: bridge
  frontend:
    external: true
```

#### 3. New Environment Variable: VITE_ALLOWED_HOSTS

The frontend now validates incoming host headers for security. You **must** configure allowed hosts.

**Required Actions:**

Add the following to your `.env` file:

```bash
# Add your production domain(s) - comma-separated
VITE_ALLOWED_HOSTS=localhost,.cloud-schulz.de,sales.cloud-schulz.de
```

**Default value (if not set):**
```
localhost,.cloud-schulz.de,sales.cloud-schulz.de
```

**Important:** If you don't set this variable, external requests to your production domain will be blocked with a **403 Forbidden** error.

**Format:**
- Use wildcards with leading dots for subdomains: `.cloud-schulz.de` matches `sales.cloud-schulz.de`, `app.cloud-schulz.de`, etc.
- Separate multiple domains with commas: `localhost,example.com,.mydomain.com`
- No spaces between entries

#### 4. OpenSSL Required in Backend Container

Version 1.1.0 backend Docker image now includes OpenSSL (required by Prisma).

**No action required** - this is handled automatically in the Dockerfile.

**Technical details:** The `backend/Dockerfile` now includes:
```dockerfile
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
```

This is added to both the `builder` and `runner` stages.

### Migration Steps

Follow these steps in order:

#### Step 1: Update Configuration Files

1. Update `.env` with new container names and `VITE_ALLOWED_HOSTS`:
   ```bash
   # Edit .env
   nano .env
   ```

2. Verify your changes:
   ```bash
   grep -E "DATABASE_URL|VITE_BACKEND_URL|VITE_ALLOWED_HOSTS" .env
   ```

#### Step 2: Create External Network

```bash
docker network create frontend
```

#### Step 3: Update Reverse Proxy

If using Nginx Proxy Manager:

1. Navigate to your proxy host configuration
2. Update custom configuration to use new container names (`backend`, `frontend`)
3. Save and test the configuration

#### Step 4: Rebuild and Start Containers

```bash
# Rebuild images (pulls latest changes)
docker compose build --no-cache

# Start services
docker compose up -d

# Check status
docker compose ps
```

#### Step 5: Verify Database Migrations

```bash
# Check backend logs for successful migration
docker compose logs backend | grep -i migration
```

You should see:
```
Prisma schema loaded from prisma/schema.prisma
5 migrations found in prisma/migrations
No pending migrations to apply.
```

### Post-Migration Verification

Verify that everything is working correctly:

#### 1. Check Container Health

```bash
docker compose ps
```

All containers should show `Up` status:
```
NAME       STATUS         PORTS
backend    Up 10 seconds  4000/tcp
db         Up 10 seconds  5432/tcp
frontend   Up 10 seconds  0.0.0.0:3000->3000/tcp
```

#### 2. Test Public Endpoints

```bash
# Test backend health
curl -X POST https://your-domain.com/api/start \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user"}'
```

Expected response:
```json
{"conversationId":"cmh4swv3s0000114sklydaf76"}
```

#### 3. Test Frontend Access

Open your browser and navigate to your production URL (e.g., `https://sales.cloud-schulz.de`).

You should see:
- ✅ Frontend loads without errors
- ✅ Settings page accessible
- ✅ No CORS errors in browser console
- ✅ No 403 Forbidden errors

#### 4. Test API Key Validation (New Feature)

1. Go to **Settings** page
2. Enter an invalid API key (e.g., `sk-test123`)
3. Click "Einstellungen speichern"
4. You should see an error message: "❌ Ungültiger API-Schlüssel"

This confirms that API key validation is working correctly.

#### 5. Verify Database Connection

```bash
# Connect to database
docker compose exec db psql -U postgres -d alexpert

# Check table existence
\dt

# Exit
\q
```

### Rollback Instructions

If you encounter issues and need to rollback:

#### Option 1: Restore Previous Version

```bash
# Stop current deployment
docker compose down

# Checkout previous version
git checkout v1.0.0

# Restore old .env settings
# (Use your backup of .env from before migration)

# Start old version
docker compose up -d
```

#### Option 2: Restore Database Backup

```bash
# Stop all containers
docker compose down

# Start only database
docker compose up -d db

# Restore backup
cat backup_YYYYMMDD.sql | docker compose exec -T db psql -U postgres alexpert

# Restart all services
docker compose up -d
```

### Troubleshooting

#### Issue: Backend fails to start with "OpenSSL not found"

**Solution:**
```bash
# Rebuild backend image with --no-cache
docker compose build --no-cache backend
docker compose up -d backend
```

#### Issue: Frontend shows "403 Forbidden"

**Cause:** `VITE_ALLOWED_HOSTS` not configured or incorrect.

**Solution:**
```bash
# Add to .env
echo "VITE_ALLOWED_HOSTS=localhost,your-domain.com" >> .env

# Restart frontend
docker compose restart frontend
```

#### Issue: "Network frontend not found"

**Solution:**
```bash
# Create the external network
docker network create frontend

# Restart services
docker compose up -d
```

#### Issue: Nginx Proxy Manager can't reach frontend/backend

**Cause:** Container names not updated in proxy configuration.

**Solution:**
1. Update proxy host to use `frontend` and `backend` container names
2. Ensure both containers are on the `frontend` network:
   ```bash
   docker network inspect frontend
   ```

#### Issue: Database connection errors

**Cause:** `DATABASE_URL` still uses old container name `alexpert-db`.

**Solution:**
```bash
# Update .env
sed -i 's/@alexpert-db:/@db:/g' .env

# Restart backend
docker compose restart backend
```

### New Features in v1.1.0

Besides the breaking changes, version 1.1.0 includes:

1. **API Key Validation**
   - User-provided API keys are now validated before saving
   - Checks for valid format and Realtime API access
   - Clear error messages if validation fails

2. **Improved Error Handling**
   - Better error messages during simulation failures
   - Errors logged to `ConversationLog` table for debugging
   - Specific messages for 401 (invalid key) and 403 (no Realtime access)

3. **Enhanced Security**
   - Host header validation via `VITE_ALLOWED_HOSTS`
   - API key prefix logging (first 10 chars only)
   - Improved CORS handling

4. **Better User Experience**
   - Settings page shows API key requirements
   - Simulation errors include actionable instructions
   - Link to OpenAI platform for key management

### Support

If you encounter issues not covered in this guide:

1. Check logs: `docker compose logs --tail=100 backend`
2. Review [GitHub Issues](https://github.com/anthropics/claude-code/issues)
3. Consult [CLAUDE.md](./CLAUDE.md) for development details

---

**Last updated:** October 2025
**Version:** 1.1.0

# Migration Guide

## v1.0.0 → v1.0.1 (Critical Hotfix)

### Overview
Version 1.0.1 is a critical hotfix that resolves deployment issues from v1.0.0. If you deployed v1.0.0 and the application is non-functional, please upgrade immediately.

### Critical Fixes
1. **JWT Authentication** - Fixed JWT auth blocking all public API endpoints
2. **Environment Variables** - Fixed validation errors for API_KEY and JWT_SECRET
3. **Rate Limiting** - Fixed Fastify version compatibility issue

---

### Step 1: Update Environment Variables

**Required Changes:**

Your `.env` file MUST include these variables with minimum lengths:

```bash
# Minimum 16 characters (used for /metrics endpoint)
API_KEY=your-secure-api-key-here

# Minimum 32 characters (used for admin JWT tokens)
JWT_SECRET=your-secure-jwt-secret-here
```

**Generate Strong Credentials:**

```bash
# Generate API_KEY (16+ characters)
openssl rand -base64 24

# Generate JWT_SECRET (32+ characters)
openssl rand -base64 48
```

**Example:**
```bash
API_KEY=vK8mN2pQ4rT6wY8zA0cE2gI4k
JWT_SECRET=xF3vB7nM9qS1tW5yA8cE0gI2kO4pR6uX2zA0bD4fH6jL8nP0rT
```

---

### Step 2: Update Docker Compose Configuration

The following Docker container names were standardized:

**Old (v1.0.0):**
- `sales-simulation-backend`
- `sales-simulation-frontend`
- `sales-simulation-db`

**New (v1.0.1):**
- `backend`
- `frontend`
- `db`

**Action Required:**

1. Update any references to old container names in your `.env` file
2. Update DATABASE_URL if you hardcoded the old container name:

```bash
# Old
DATABASE_URL=postgresql://postgres:postgres@sales-simulation-backend:5432/alexpert

# New
DATABASE_URL=postgresql://postgres:postgres@db:5432/alexpert
```

---

### Step 3: Pull Latest Changes

```bash
# Stop running containers
docker compose down

# Pull latest code
git pull origin main

# Pull latest images
docker compose pull
```

---

### Step 4: Run Database Migrations

```bash
# Backend container will automatically run migrations on startup
# But you can manually run them with:
docker compose run --rm backend npx prisma migrate deploy
```

---

### Step 5: Restart Services

```bash
# Start all services
docker compose up -d

# Verify services are healthy
docker compose ps
docker compose logs backend | tail -20
docker compose logs frontend | tail -20
```

---

### Step 6: Verify Deployment

1. **Check Backend Health:**
   ```bash
   curl http://localhost:4000/health
   # Should return: {"status":"ok","timestamp":"...","uptime":...}
   ```

2. **Test Frontend:**
   - Open http://localhost:3000
   - Click "Starte Simulation"
   - Verify simulation starts successfully

3. **Check Logs:**
   ```bash
   # Backend logs (should show no auth errors on public endpoints)
   docker compose logs backend -f

   # Frontend logs
   docker compose logs frontend -f
   ```

---

### Authentication Changes (Technical Details)

**What Changed:**

v1.0.0 required JWT Bearer tokens for ALL `/api/*` endpoints, which broke the application since the frontend has no authentication system.

v1.0.1 makes JWT authentication **optional** for public endpoints:

**Public Endpoints (No Auth Required):**
- `/api/token` - OpenAI token generation
- `/api/start` - Start simulation
- `/api/conversations` - User conversations
- `/api/scores` - User scores
- `/api/user/preferences` - User preferences
- `/api/realtime/*` - WebSocket realtime connections
- `/api/admin/login` - Admin login endpoint

**Protected Endpoints (Require JWT Bearer Token):**
- `/api/admin/*` (except `/api/admin/login`)
- `/api/analytics/*`
- `/metrics`

**Impact:** The frontend now works without any changes. Admin features still require authentication via `/api/admin/login`.

---

### Troubleshooting

#### "Invalid environment variables" Error

**Symptom:**
```
Invalid environment variables {
  API_KEY: [ 'API_KEY must be at least 16 characters for security' ],
  JWT_SECRET: [ 'JWT_SECRET must be at least 32 characters for security' ]
}
```

**Solution:**
1. Verify your `.env` file has API_KEY (16+ chars) and JWT_SECRET (32+ chars)
2. Regenerate credentials using the commands in Step 1
3. Restart containers: `docker compose restart backend`

---

#### "Starte Simulation" Button Not Working

**Symptom:** Button does nothing, 401 Unauthorized errors in browser console

**Solution:**
1. Ensure you're running v1.0.1 (check with `git log --oneline -1`)
2. Verify backend is running: `docker compose ps backend`
3. Check backend logs: `docker compose logs backend | grep -E "(Unauthorized|401)"`
4. If you see auth errors, you may still be running v1.0.0 - redeploy

---

#### Container Name Issues

**Symptom:** 502 Bad Gateway, database connection errors

**Solution:**
1. Check your `docker-compose.yml` uses correct container names (backend, frontend, db)
2. Update DATABASE_URL in `.env` to use `db` hostname
3. Recreate containers: `docker compose down && docker compose up -d`

---

#### Rate Limiting Compatibility Error

**Symptom:**
```
FastifyError: fastify-plugin: @fastify/rate-limit - expected '5.x' fastify version, '4.29.1' is installed
```

**Solution:**
This was fixed in v1.0.1. If you see this error:
1. Ensure you're on v1.0.1: `git pull origin main`
2. Rebuild backend: `docker compose build backend`
3. Restart: `docker compose up -d backend`

---

### Rollback Instructions

If you need to rollback to a working state:

```bash
# Stop containers
docker compose down

# Rollback to commit before v1.0.0
git reset --hard <previous-working-commit>

# Rebuild and restart
docker compose build
docker compose up -d
```

**Note:** Database migrations are forward-only. Rollback may require restoring a database backup.

---

### Getting Help

If you encounter issues not covered in this guide:

1. Check GitHub Issues: https://github.com/marcantonioschulz/Alexpert/issues
2. Review application logs: `docker compose logs`
3. Create a new issue with:
   - Version information (`git log --oneline -1`)
   - Error messages from logs
   - Steps to reproduce

---

### Summary

**Required Actions:**
1. ✅ Update .env with API_KEY (16+ chars) and JWT_SECRET (32+ chars)
2. ✅ Update container name references (if any)
3. ✅ Pull latest code: `git pull origin main`
4. ✅ Restart services: `docker compose down && docker compose up -d`
5. ✅ Verify deployment: Test "Starte Simulation" button

**Total Downtime:** ~2-5 minutes

**Risk Level:** Low (hotfix resolves critical issues, no breaking changes to data)

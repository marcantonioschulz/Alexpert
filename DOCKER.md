# Docker Setup Guide

This guide explains the Docker setup for Alexpert and how to use it in different environments.

## Production Deployment (Portainer/Server)

The main `docker-compose.yml` is configured for production use with pre-built images from GitHub Container Registry (GHCR).

### Initial Setup

1. **Create `.env` file** with required environment variables:
```bash
cp .env.example .env
# Edit .env with your production values
```

2. **Pull and start containers**:
```bash
docker compose pull
docker compose up -d
```

### Updating to Latest Version

The images are configured to use the `:main` tag, which always points to the latest stable version.

**Manual update:**
```bash
docker compose pull
docker compose up -d
```

**With Portainer:**
- Navigate to your stack in Portainer
- Click "Pull and redeploy"
- Portainer will now correctly detect when updates are available

**With Watchtower (automated):**
```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --cleanup \
  --label-enable
```

### Image Tags

Production images are available with multiple tags:

- `ghcr.io/marcantonioschulz/web-app-agents-sdk-backend:main` - Latest stable (recommended)
- `ghcr.io/marcantonioschulz/web-app-agents-sdk-backend:v1.3.0` - Specific version
- `ghcr.io/marcantonioschulz/web-app-agents-sdk-backend:latest` - Same as main

**To use a specific version:**
```yaml
services:
  backend:
    image: ghcr.io/marcantonioschulz/web-app-agents-sdk-backend:v1.3.0
```

## Local Development

For local development with hot reload and source code mounting, use `docker-compose.dev.yml`:

### Setup

1. **Build and run with development override**:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

2. **Or create a permanent override** (recommended for frequent use):
```bash
ln -s docker-compose.dev.yml docker-compose.override.yml
docker compose up --build
```

When `docker-compose.override.yml` exists, it's automatically loaded by `docker compose`.

### Development Features

- **Hot Reload**: Source code changes trigger automatic rebuilds
- **Port Exposure**: Backend exposed on `localhost:4000` for debugging
- **Source Mounting**: Live code updates without rebuild (for compatible changes)
- **No Restart Policy**: Containers don't auto-restart on crash (for debugging)

## Portainer Integration

### Labels Explained

The production `docker-compose.yml` includes Portainer-specific labels:

```yaml
labels:
  - "com.centurylinklabs.watchtower.enable=true"  # Enable Watchtower auto-updates
  - "io.portainer.accesscontrol.teams=administrators"  # Portainer RBAC
```

### Update Detection

Portainer can now detect updates because:

1. **Explicit Image Reference**: Uses `image:` instead of `build:`
2. **Registry Access**: Pulls from public GHCR (no auth required for public images)
3. **Tag Strategy**: Uses `:main` tag that gets updated with each release

### Enabling Update Notifications

In Portainer:

1. Go to **Settings** → **Registries**
2. Add GHCR registry:
   - Name: `GitHub Container Registry`
   - URL: `ghcr.io`
   - Authentication: Leave empty (public access)
3. Your stacks will now show update availability

## CI/CD Integration

The GitHub Actions workflows automatically:

1. Build Docker images on every push to `main`
2. Tag images with:
   - Commit SHA (e.g., `sha-abc123`)
   - `main` tag (updated on every push)
   - Version tag on release (e.g., `v1.3.0`)
   - `latest` tag
3. Push to GHCR with public access

### Triggering Updates

**Automated (Recommended for Production):**
- Set up Watchtower with the labels (already included)
- Watchtower checks for updates every 24h by default

**Semi-Automated (Portainer):**
- Check for updates in Portainer dashboard
- Click "Pull and redeploy" when available

**Manual:**
```bash
docker compose pull
docker compose up -d
```

## Troubleshooting

### "Image not found" error

**Solution**: Ensure images are public in GHCR
```bash
# Login to GHCR (if images are private)
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

### Portainer shows "unknown" update status

**Possible causes:**
1. Using `build:` instead of `image:` (fixed in this version)
2. GHCR not added to Portainer registries
3. Private images without registry auth

**Solution**: See "Enabling Update Notifications" above

### "Container name already in use"

**Solution**: Remove old containers first
```bash
docker compose down
docker compose up -d
```

### Database migration fails

**Solution**: Check DATABASE_URL and ensure DB is accessible
```bash
docker compose logs backend
docker compose exec backend npx prisma migrate status
```

## Network Configuration

### External Network: `frontend`

The compose file uses an external network for reverse proxy integration (e.g., Nginx Proxy Manager).

**If you don't use a reverse proxy:**
```bash
# Create the network manually
docker network create frontend
```

**Or remove it from docker-compose.yml:**
```yaml
networks:
  - app-network
  # Remove: - frontend

# And remove from bottom:
networks:
  app-network:
    driver: bridge
  # Remove: frontend: external: true
```

## Security Notes

### Production Checklist

- [ ] Change default PostgreSQL credentials
- [ ] Set strong `API_KEY` and `JWT_SECRET`
- [ ] Configure `CORS_ORIGIN` to your domain
- [ ] Use HTTPS with reverse proxy
- [ ] Keep `VITE_ALLOWED_HOSTS` restrictive
- [ ] Enable Docker security features (AppArmor/SELinux)
- [ ] Regular updates via Watchtower or manual pulls

### Environment Variables

**Never commit `.env` to Git!** It contains sensitive credentials.

**Required variables:**
- `API_KEY` - Admin API authentication
- `JWT_SECRET` - Session token signing
- `OPENAI_API_KEY` - OpenAI API access

**Recommended to change:**
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_USER` - Database user

## Performance Tuning

### PostgreSQL

For production, consider tuning PostgreSQL:

```yaml
db:
  image: postgres:16-alpine
  environment:
    POSTGRES_SHARED_BUFFERS: 256MB
    POSTGRES_MAX_CONNECTIONS: 100
    POSTGRES_WORK_MEM: 4MB
  deploy:
    resources:
      limits:
        memory: 1G
```

### Backend/Frontend

Limit resources to prevent one service from consuming all available memory:

```yaml
backend:
  deploy:
    resources:
      limits:
        memory: 512M
        cpus: '1.0'
      reservations:
        memory: 256M
        cpus: '0.5'
```

## Monitoring

### Logs

**View all logs:**
```bash
docker compose logs -f
```

**View specific service:**
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

**With Portainer:**
- Navigate to container
- Click "Logs" → Enable auto-refresh

### Health Checks

Consider adding health checks to docker-compose.yml:

```yaml
backend:
  healthcheck:
    test: ["CMD", "node", "-e", "require('http').get('http://localhost:4000/health')"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

## Backup & Restore

### Database Backup

```bash
# Create backup
docker compose exec db pg_dump -U postgres alexpert > backup.sql

# Restore backup
docker compose exec -T db psql -U postgres alexpert < backup.sql
```

### Full Stack Backup

```bash
# Stop containers
docker compose down

# Backup volumes
docker run --rm -v alexpert_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# Restart
docker compose up -d
```

## Support

For issues or questions:
- **GitHub Issues**: https://github.com/marcantonioschulz/Alexpert/issues
- **Documentation**: https://github.com/marcantonioschulz/Alexpert

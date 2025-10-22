# GitHub Configuration Guide

This guide explains how to configure GitHub Secrets and Environments for CI/CD to work properly.

## 📋 Table of Contents

- [GitHub Secrets](#github-secrets)
- [GitHub Environments](#github-environments)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

---

## GitHub Secrets

GitHub Secrets are encrypted environment variables used by GitHub Actions. Navigate to:

**Repository → Settings → Secrets and variables → Actions**

### Required Secrets (for Deployment)

These secrets are **only required if you want to deploy automatically**. CI/CD tests will work without them.

| Secret Name | Description | How to Generate | Required For |
|------------|-------------|-----------------|--------------|
| `DEPLOY_HOST` | Server hostname or IP | Your server address | Deployment |
| `DEPLOY_USER` | SSH username | Server user (e.g., `deploy`) | Deployment |
| `DEPLOY_PORT` | SSH port | Usually `22` | Deployment |
| `DEPLOY_WORKDIR` | Deployment directory | e.g., `/opt/alexpert` | Deployment |
| `SSH_PRIVATE_KEY` | SSH private key | See [SSH Key Setup](#ssh-key-setup) below | Deployment |
| `SSH_PASSPHRASE` | SSH key passphrase | Leave empty if no passphrase | Deployment |

### Optional Secrets (for Enhanced Features)

| Secret Name | Description | How to Get | Used For |
|------------|-------------|------------|----------|
| `CODECOV_TOKEN` | Codecov.io upload token | [codecov.io](https://codecov.io) after signup | Code coverage reports |

### ❌ NOT NEEDED as Secrets

These are **not needed** as GitHub Secrets because they're handled differently:

- ✅ `API_KEY` & `JWT_SECRET` - Generated during `make install` and stored in `.env` on server
- ✅ `OPENAI_API_KEY` - Set in `.env` file on server (not in CI)
- ✅ `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- ✅ Test credentials - Hardcoded in `vitest.setup.ts` (safe for CI)

---

## GitHub Environments

Environments provide deployment protection rules and environment-specific secrets.

### Setup: `production` Environment

1. Go to **Repository → Settings → Environments**
2. Click **New environment**
3. Name: `production`
4. Configure protection rules:
   - ✅ **Required reviewers** (optional): Add team members who must approve deployments
   - ✅ **Wait timer** (optional): Add delay before deployment (e.g., 5 minutes)
   - ✅ **Deployment branches**: Restrict to `main` branch only

The `production` environment is used by the `deploy` job in `.github/workflows/ci.yml`.

---

## SSH Key Setup

For automated deployments, you need to set up SSH key authentication.

### Generate SSH Key Pair

On your **local machine**:

```bash
# Generate a new SSH key pair specifically for GitHub Actions
ssh-keygen -t ed25519 -C "github-actions@alexpert" -f ~/.ssh/github_actions_alexpert

# If ed25519 is not supported, use RSA
ssh-keygen -t rsa -b 4096 -C "github-actions@alexpert" -f ~/.ssh/github_actions_alexpert
```

This creates two files:
- `~/.ssh/github_actions_alexpert` (private key) - Add to GitHub Secrets
- `~/.ssh/github_actions_alexpert.pub` (public key) - Add to server

### Add Public Key to Server

On your **deployment server**:

```bash
# Create .ssh directory if it doesn't exist
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add the public key to authorized_keys
cat >> ~/.ssh/authorized_keys << 'EOF'
# Paste the contents of github_actions_alexpert.pub here
EOF

chmod 600 ~/.ssh/authorized_keys
```

### Add Private Key to GitHub

1. Copy the **private key** content:
   ```bash
   cat ~/.ssh/github_actions_alexpert
   ```

2. Go to **Repository → Settings → Secrets → Actions → New repository secret**

3. Name: `SSH_PRIVATE_KEY`

4. Value: Paste the entire private key including:
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   ...
   -----END OPENSSH PRIVATE KEY-----
   ```

### Test SSH Connection

Test from your local machine:

```bash
ssh -i ~/.ssh/github_actions_alexpert your-user@your-server.com
```

If it works, GitHub Actions will be able to connect too.

---

## Security Best Practices

### 🔒 Secrets Management

1. **Never commit secrets to Git**
   - `.env` files are in `.gitignore`
   - Use `make install` to generate secrets locally

2. **Rotate secrets regularly**
   - Change `API_KEY` and `JWT_SECRET` every 90 days
   - Rotate SSH keys annually

3. **Use different secrets for different environments**
   - Development: Use `make install` generated secrets
   - Production: Use `openssl rand -base64 48` for strong secrets

4. **Limit secret access**
   - Only repository admins should access secrets
   - Use GitHub Environment protection rules

### 🛡️ SSH Security

1. **Use dedicated SSH keys for CI/CD**
   - Don't reuse personal SSH keys
   - Label keys clearly: `github-actions@alexpert`

2. **Restrict SSH key permissions**
   - Add key to specific user (e.g., `deploy` user, not `root`)
   - Use SSH key with passphrase (store in `SSH_PASSPHRASE` secret)

3. **Disable password authentication**
   - Edit `/etc/ssh/sshd_config` on server:
     ```
     PasswordAuthentication no
     PubkeyAuthentication yes
     ```
   - Restart SSH: `sudo systemctl restart sshd`

### 📊 Audit & Monitoring

1. **Enable audit logs**
   - GitHub Actions logs all secret usage
   - Review logs regularly in Actions tab

2. **Set up deployment notifications**
   - Configure Slack/Discord webhooks
   - Get notified of every deployment

3. **Monitor failed deployments**
   - Check Actions tab for failures
   - Set up alerts for critical failures

---

## Codecov Setup (Optional)

Codecov provides visual code coverage reports in PRs.

### Steps:

1. **Sign up at [codecov.io](https://codecov.io)**
   - Use GitHub OAuth to connect

2. **Add repository**
   - Find your repo in Codecov dashboard
   - Copy the upload token

3. **Add token to GitHub**
   - Go to **Repository → Settings → Secrets → Actions**
   - Name: `CODECOV_TOKEN`
   - Value: Paste token from Codecov

4. **Verify**
   - Push a commit
   - Check Actions tab for coverage upload
   - View coverage reports in Codecov dashboard

---

## Troubleshooting

### Tests Failing in CI

**Symptom**: Tests pass locally but fail in GitHub Actions

**Solution**: Tests use hardcoded credentials from `vitest.setup.ts` - no secrets needed!

If still failing:
```bash
# Check test logs in GitHub Actions
# Ensure vitest.setup.ts has correct credentials (already configured)
```

### Deployment Fails: Permission Denied

**Symptom**: `Permission denied (publickey)` in deployment logs

**Solutions**:
1. Verify SSH private key is correct in `SSH_PRIVATE_KEY` secret
2. Ensure public key is in `~/.ssh/authorized_keys` on server
3. Check SSH key format (must include header/footer lines)
4. Test SSH connection manually from local machine

### Coverage Upload Fails

**Symptom**: Codecov upload step fails but tests pass

**Solution**:
- Coverage upload is set to `fail_ci_if_error: false`
- CI will succeed even if upload fails
- Check `CODECOV_TOKEN` is set correctly
- Verify `backend/coverage/coverage-final.json` exists

### Docker Build Fails

**Symptom**: Docker build or push fails in CI

**Solutions**:
1. Check GitHub Packages permissions:
   - Go to **Repository → Settings → Actions → General**
   - Ensure "Read and write permissions" is enabled
2. Verify `GITHUB_TOKEN` has `packages: write` permission (automatic)
3. Check Docker image size isn't exceeding limits

### Deployment Skipped

**Symptom**: Deployment step is skipped in Actions

**This is normal** if:
- `DEPLOY_HOST` secret is not set (intentional for open-source repos)
- Branch is not `main`
- Previous jobs (test/docker) failed

**To enable deployment**:
1. Add all required deployment secrets (see table above)
2. Ensure production environment is configured
3. Push to `main` branch

---

## Quick Setup Checklist

Use this checklist to verify your GitHub configuration:

### For CI/CD (Tests + Builds)
- [ ] Repository uses GitHub Actions (check `.github/workflows/ci.yml` exists)
- [ ] No secrets needed - tests work out of the box!

### For Deployment (Optional)
- [ ] Create `production` environment
- [ ] Generate SSH key pair
- [ ] Add public key to server
- [ ] Add `SSH_PRIVATE_KEY` to GitHub Secrets
- [ ] Add `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT`, `DEPLOY_WORKDIR` secrets
- [ ] Test SSH connection manually
- [ ] Push to `main` and verify deployment in Actions tab

### For Code Coverage (Optional)
- [ ] Sign up at codecov.io
- [ ] Add repository to Codecov
- [ ] Add `CODECOV_TOKEN` to GitHub Secrets
- [ ] Push commit and verify coverage report

---

## Need Help?

- 📖 [GitHub Actions Documentation](https://docs.github.com/en/actions)
- 📖 [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- 📖 [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments)
- 🐛 [Open an Issue](https://github.com/marcantonioschulz/Alexpert/issues)

---

**Last Updated**: 2025-10-22
**Version**: 1.0.0

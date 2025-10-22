# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of our software seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please Do NOT:

- Open a public GitHub issue
- Disclose the vulnerability publicly before it has been addressed
- Test the vulnerability on production systems

### Please DO:

1. **Email us privately** at security@endlichzuhause.com
2. **Include details** such as:
   - Type of vulnerability
   - Full paths of affected source files
   - Location of the affected code (tag/branch/commit)
   - Step-by-step instructions to reproduce
   - Proof-of-concept or exploit code (if possible)
   - Impact assessment
   - Suggested fix (if any)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - **Critical**: 24-48 hours
  - **High**: 1 week
  - **Medium**: 2 weeks
  - **Low**: 30 days

### What to Expect

1. **Acknowledgment**: We'll confirm receipt of your report
2. **Assessment**: We'll assess the vulnerability and its impact
3. **Fix Development**: We'll develop and test a fix
4. **Disclosure**: We'll coordinate disclosure with you
5. **Credit**: We'll credit you in the security advisory (if desired)

## Security Best Practices

### For Users

1. **Environment Variables**
   - Never commit `.env` files to version control
   - Rotate API keys regularly
   - Use strong, unique values for `JWT_SECRET` and `API_KEY`

2. **Database**
   - Use strong PostgreSQL passwords
   - Enable SSL connections in production
   - Limit database access to trusted IPs

3. **API Keys**
   - Never expose `OPENAI_API_KEY` in client-side code
   - Store sensitive credentials in secure vaults
   - Use environment-specific keys

4. **CORS Configuration**
   - Set specific `CORS_ORIGIN` values (avoid `*` in production)
   - Review and limit allowed origins

### For Developers

1. **Dependency Management**
   - Run `npm audit` regularly
   - Update dependencies promptly
   - Review security advisories

2. **Code Review**
   - Review all PRs for security issues
   - Check for hardcoded secrets
   - Validate input sanitization

3. **Authentication & Authorization**
   - Always validate JWT tokens
   - Implement rate limiting
   - Use HTTPS in production

4. **Data Validation**
   - Validate all user inputs
   - Use Zod schemas for validation
   - Sanitize database queries (use Prisma ORM)

## Known Security Considerations

### OpenAI API Integration

- API keys have full access to your OpenAI account
- Implement usage monitoring to detect anomalies
- Set spending limits in OpenAI dashboard

### Realtime Voice Sessions

- WebRTC connections are peer-to-peer
- Audio data is processed by OpenAI
- Review OpenAI's data retention policies

### Docker Images

- Images are public in GHCR
- Don't include secrets in images
- Use build-time arguments sparingly

## Security Updates

- Security patches are released as soon as possible
- Check [GitHub Security Advisories](../../security/advisories)
- Enable GitHub Dependabot alerts
- Subscribe to release notifications

## Bug Bounty Program

Currently, we do not offer a bug bounty program. However, we greatly appreciate security researchers who responsibly disclose vulnerabilities and will publicly acknowledge their contributions.

## Third-Party Dependencies

We use automated tools to monitor dependencies:

- **Dependabot**: Automatic PR for dependency updates
- **npm audit**: Regular security audits
- **Snyk** (optional): Additional vulnerability scanning

## Compliance

This project aims to follow:

- OWASP Top 10 security risks
- CWE/SANS Top 25 Most Dangerous Software Errors
- GDPR requirements for data handling

## Questions?

For security-related questions that aren't vulnerabilities:
- Open a [GitHub Discussion](../../discussions)
- Tag it with `security` label

For security vulnerabilities:
- **Email**: security@endlichzuhause.com

---

Last updated: 2025-01-22

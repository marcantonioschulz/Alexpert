# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive community documentation (issue templates, PR template, CODE_OF_CONDUCT, CONTRIBUTING, SECURITY)
- Proprietary license with commercial licensing model
- Semantic versioning strategy
- CHANGELOG.md for version tracking

### Changed
- License changed from MIT to proprietary license
- README enhanced with badges, features overview, and licensing information
- Package metadata updated across all package.json files

## [1.0.0] - 2025-01-22

### Added
- Initial public release
- Full-stack sales simulation platform
- AI-powered voice agents using OpenAI Realtime API
- Real-time analytics dashboard
- JWT-based admin authentication
- Docker Compose setup for development and production
- CI/CD pipeline with GitHub Actions
- Automated Docker image builds
- PostgreSQL database with Prisma ORM
- Comprehensive test suite with 80%+ coverage
- Prometheus/Grafana monitoring setup

### Backend Features
- Fastify REST API
- OpenAI Realtime API integration
- WebRTC session management
- Conversation storage and retrieval
- User preference management
- Admin authentication system
- Metrics endpoint with authentication
- Health check endpoints

### Frontend Features
- React 18 with TypeScript
- Real-time voice interaction
- Analytics dashboard with Recharts
- Conversation history browser
- Settings management
- Dark mode support
- Responsive design

### DevOps
- Automated CI/CD pipeline
- Docker multi-stage builds
- GitHub Container Registry integration
- Database migrations
- Environment-based configuration

---

## Version Numbering

This project uses [Semantic Versioning](https://semver.org/):

- **MAJOR** version (X.0.0): Incompatible API changes
- **MINOR** version (0.X.0): New features, backwards-compatible
- **PATCH** version (0.0.X): Bug fixes, backwards-compatible

### Release Types

- **Major Release** (1.0.0 → 2.0.0): Breaking changes, significant new features
- **Minor Release** (1.0.0 → 1.1.0): New features without breaking changes
- **Patch Release** (1.0.0 → 1.0.1): Bug fixes, security updates

### Pre-release Versions

- **Alpha**: `1.0.0-alpha.1` - Internal testing, unstable
- **Beta**: `1.0.0-beta.1` - Public testing, mostly stable
- **Release Candidate**: `1.0.0-rc.1` - Final testing before release

## Contributing to the Changelog

When you contribute, please update this file following these guidelines:

### Categories

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Features that will be removed
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security fixes

### Format

```markdown
## [Version] - YYYY-MM-DD

### Added
- Description of what was added

### Changed
- Description of what was changed

### Fixed
- Description of what was fixed
```

---

[Unreleased]: https://github.com/marcantonioschulz/Web-App-Agents-SDK/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/marcantonioschulz/Web-App-Agents-SDK/releases/tag/v1.0.0

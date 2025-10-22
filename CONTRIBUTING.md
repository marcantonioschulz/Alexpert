# Contributing to Sales Simulation Platform

First off, thank you for considering contributing to this project! It's people like you that make this platform better for everyone.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## ⚖️ Important: Licensing and Contributions

**This is a proprietary project with a custom license.**

### What This Means for Contributors

- ✅ **You keep copyright** of your contributions
- ✅ **You get credit** for your work in release notes and documentation
- ⚠️ **You grant a commercial license** to Marc Antonio Schulz to use your contribution
- ⚠️ **Your contribution may be used** in commercial versions of this software

By submitting a pull request, you agree to these terms as outlined in the [LICENSE](LICENSE).

### Why This Model?

This project is **source-available** (you can see and contribute to the code) but **not open-source** in the traditional sense. Commercial licenses fund:
- Continued development and maintenance
- Professional support for enterprise customers
- Community infrastructure and resources
- Contributor recognition and potential compensation for significant contributions

If you have concerns about this model, please open a discussion before contributing.

## Getting Started

### Prerequisites

- Node.js 20 (see `.nvmrc`)
- Docker & Docker Compose
- Git
- OpenAI API Key (for testing AI features)

### Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Web-App-Agents-SDK.git
   cd Web-App-Agents-SDK
   ```

2. **Install Dependencies**
   ```bash
   # Using make (recommended)
   make codex-setup

   # Or manually
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start Development Environment**
   ```bash
   # With Docker
   docker compose up -d

   # Or locally
   make backend-dev  # Terminal 1
   make frontend-dev # Terminal 2
   ```

## Development Workflow

### Branch Naming Convention

- `feature/` - New features (e.g., `feature/add-user-auth`)
- `fix/` - Bug fixes (e.g., `fix/conversation-not-saving`)
- `docs/` - Documentation updates (e.g., `docs/update-readme`)
- `refactor/` - Code refactoring (e.g., `refactor/simplify-api-routes`)
- `test/` - Test additions/modifications (e.g., `test/add-integration-tests`)

### Working on an Issue

1. **Find or Create an Issue**
   - Check existing issues or create a new one
   - Comment that you're working on it to avoid duplication

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Your Changes**
   - Write clean, readable code
   - Follow existing code style
   - Add tests for new functionality
   - Update documentation as needed

4. **Test Your Changes**
   ```bash
   # Backend tests
   cd backend
   npm test
   npm run test:coverage

   # Frontend tests
   cd frontend
   npm test
   npm run test:e2e

   # Lint
   npm run lint
   ```

## Pull Request Process

### Before Submitting

- [ ] All tests pass locally
- [ ] Code follows project style guidelines
- [ ] Documentation is updated
- [ ] Commit messages follow our guidelines
- [ ] Branch is up to date with `main`

### Submitting

1. **Push Your Branch**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request**
   - Use a clear, descriptive title
   - Fill out the PR template completely
   - Link related issues
   - Add screenshots/videos for UI changes

3. **Code Review**
   - Address feedback promptly
   - Keep discussions focused and professional
   - Be open to suggestions

### After Approval

- Maintainers will merge your PR
- Your branch will be deleted automatically
- You're now a contributor! 🎉

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Avoid `any` types - use proper typing
- Use interfaces for objects, types for unions

### Code Style

- Use ESLint configuration provided
- 2 spaces for indentation
- Semicolons required
- Single quotes for strings
- Trailing commas in multiline

### File Organization

```
backend/
  src/
    routes/      # API endpoints
    services/    # Business logic
    lib/         # Utilities
    plugins/     # Fastify plugins
  test/
    unit/        # Unit tests
    integration/ # Integration tests

frontend/
  src/
    components/  # React components
    hooks/       # Custom hooks
    features/    # Feature modules
  __tests__/     # Test files
```

## Testing Guidelines

### Coverage Requirements

- Minimum 80% coverage for all code
- 100% coverage for critical business logic
- Integration tests for all API endpoints

### Test Structure

```typescript
describe('Feature/Component', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something specific', () => {
    // Arrange
    const input = {};

    // Act
    const result = doSomething(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

### What to Test

- ✅ Business logic
- ✅ API endpoints
- ✅ Error handling
- ✅ Edge cases
- ✅ User interactions
- ❌ Third-party libraries
- ❌ Trivial getters/setters

## Commit Message Guidelines

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build process or tooling changes
- `perf`: Performance improvements

### Examples

```
feat(auth): add JWT-based authentication

Implement JWT token generation and validation for API routes.
Tokens expire after 24 hours and include user role information.

Closes #123
```

```
fix(api): handle null values in conversation endpoint

Prevent null pointer exceptions when transcript is not yet available.

Fixes #456
```

### Rules

- Use present tense ("add feature" not "added feature")
- Keep subject line under 72 characters
- Reference issues in footer
- Explain *what* and *why*, not *how*

## Questions?

- 💬 Open a [GitHub Discussion](../../discussions)
- 📧 Email the maintainers
- 🐛 Found a bug? [Open an issue](../../issues/new)

## Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes
- Project README (for significant contributions)

Thank you for contributing! 🙏

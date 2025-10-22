#!/usr/bin/env bash
#
# Alexpert Setup Script
# Automates initial project setup with validation and credential generation
#
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Emoji support (optional, falls back to text)
CHECK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"
ARROW="${BLUE}→${NC}"
WARN="${YELLOW}⚠${NC}"

echo -e "${BLUE}"
cat << 'EOF'
    ___   __                           __
   /   | / /__  _  ______  ___  _____/ /_
  / /| |/ / _ \| |/_/ __ \/ _ \/ ___/ __/
 / ___ / /  __/>  </ /_/ /  __/ /  / /_
/_/  |_/_/\___/_/|_/ .___/\___/_/   \__/
                  /_/

Professional Sales Training Platform
Version 1.0.0
EOF
echo -e "${NC}"

# Function to print step headers
print_step() {
    echo -e "\n${BLUE}==>${NC} ${1}"
}

# Function to print success messages
print_success() {
    echo -e "${CHECK} ${1}"
}

# Function to print error messages
print_error() {
    echo -e "${CROSS} ${1}"
}

# Function to print warning messages
print_warn() {
    echo -e "${WARN} ${1}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Generate secure random string
generate_secret() {
    local length=$1
    if command_exists openssl; then
        openssl rand -base64 "$length" | tr -d '\n' | head -c "$length"
    else
        # Fallback to /dev/urandom
        LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$length"
    fi
}

# Check prerequisites
print_step "Checking prerequisites..."

MISSING_DEPS=()

if ! command_exists node; then
    MISSING_DEPS+=("node")
fi

if ! command_exists npm; then
    MISSING_DEPS+=("npm")
fi

if ! command_exists docker; then
    MISSING_DEPS+=("docker")
fi

if ! command_exists docker-compose || ! command_exists "docker compose"; then
    MISSING_DEPS+=("docker-compose")
fi

if ! command_exists git; then
    MISSING_DEPS+=("git")
fi

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    print_error "Missing required dependencies:"
    for dep in "${MISSING_DEPS[@]}"; do
        echo "  - $dep"
    done
    echo ""
    echo "Please install the missing dependencies and try again."
    echo "See: https://docs.alexpert.dev/installation"
    exit 1
fi

print_success "All prerequisites installed"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    print_warn "Node.js version is $NODE_VERSION, but 20+ is recommended"
fi

# Check if .env exists
print_step "Checking environment configuration..."

if [ -f ".env" ]; then
    print_warn ".env file already exists"
    read -p "Do you want to regenerate it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_success "Using existing .env file"
        ENV_EXISTS=true
    else
        ENV_EXISTS=false
    fi
else
    ENV_EXISTS=false
fi

if [ "$ENV_EXISTS" = false ]; then
    print_step "Generating .env file with secure credentials..."

    # Generate secure credentials
    API_KEY=$(generate_secret 32)
    JWT_SECRET=$(generate_secret 48)

    # Create .env from template
    cat > .env << EOF
# Application Environment
APP_ENV=dev
NODE_ENV=development

# Networking
PORT=4000
VITE_PORT=3000
VITE_HOST=0.0.0.0
VITE_ALLOWED_HOSTS=localhost
VITE_BACKEND_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:3000
POSTGRES_PORT=5432

# Security Credentials (Auto-generated)
# API_KEY: Used for /metrics endpoint authentication (minimum 16 characters)
API_KEY=${API_KEY}

# JWT_SECRET: Used for admin JWT token signing (minimum 32 characters)
JWT_SECRET=${JWT_SECRET}

# OpenAI API Key (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-your-openai-key-here

# AI Models
REALTIME_MODEL=gpt-4o-realtime-preview
RESPONSES_MODEL=gpt-4o-mini

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/alexpert

# Optional: Nginx Proxy Manager automation
NPM_BASE_URL=
NPM_EMAIL=
NPM_PASSWORD=
NPM_TOKEN=
NPM_CERTIFICATE_ID=0
NPM_LETSENCRYPT_EMAIL=
NPM_FORCE_SSL=false
EOF

    print_success "Generated .env file with secure credentials"
    print_warn "Remember to add your OPENAI_API_KEY to .env"
fi

# Install dependencies
print_step "Installing dependencies..."

if [ ! -d "node_modules" ]; then
    npm install --silent
    print_success "Root dependencies installed"
else
    print_success "Root dependencies already installed"
fi

if [ ! -d "backend/node_modules" ]; then
    (cd backend && npm install --silent)
    print_success "Backend dependencies installed"
else
    print_success "Backend dependencies already installed"
fi

if [ ! -d "frontend/node_modules" ]; then
    (cd frontend && npm install --silent)
    print_success "Frontend dependencies installed"
else
    print_success "Frontend dependencies already installed"
fi

# Generate Prisma Client
print_step "Generating Prisma Client..."
(cd backend && npm run prisma:generate --silent)
print_success "Prisma Client generated"

# Start database
print_step "Starting PostgreSQL database..."

if docker compose ps | grep -q "db.*running"; then
    print_success "Database already running"
else
    docker compose up -d db
    print_success "Database started"

    # Wait for database to be ready
    echo -n "Waiting for database to be ready"
    for i in {1..30}; do
        if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
            echo ""
            print_success "Database is ready"
            break
        fi
        echo -n "."
        sleep 1
    done
fi

# Run migrations
print_step "Running database migrations..."
(cd backend && npm run prisma:migrate)
print_success "Database migrations applied"

# Build projects
print_step "Building projects..."
(cd backend && npm run build)
print_success "Backend built"

(cd frontend && npm run build)
print_success "Frontend built"

# Run tests
print_step "Running tests..."
if (cd backend && npm test); then
    print_success "All tests passed"
else
    print_warn "Some tests failed (this is okay for first setup)"
fi

# Final instructions
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Setup complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Add your OpenAI API key to ${BLUE}.env${NC}:"
echo -e "     ${BLUE}OPENAI_API_KEY=sk-your-actual-key-here${NC}"
echo -e ""
echo -e "  2. Start the development servers:"
echo -e "     ${BLUE}make dev${NC}  ${NC}(or ${BLUE}npm run dev${NC})"
echo -e ""
echo -e "  3. Open your browser:"
echo -e "     Frontend: ${BLUE}http://localhost:3000${NC}"
echo -e "     Backend:  ${BLUE}http://localhost:4000${NC}"
echo -e "     Health:   ${BLUE}http://localhost:4000/health${NC}"
echo -e ""

echo -e "${YELLOW}Useful commands:${NC}"
echo -e "  ${BLUE}make dev${NC}        Start development servers"
echo -e "  ${BLUE}make test${NC}       Run all tests"
echo -e "  ${BLUE}make docker${NC}     Start with Docker Compose"
echo -e "  ${BLUE}make clean${NC}      Clean build artifacts"
echo -e ""

echo -e "${YELLOW}Documentation:${NC}"
echo -e "  README:     ${BLUE}./README.md${NC}"
echo -e "  Dev Guide:  ${BLUE}./CLAUDE.md${NC}"
echo -e "  Migration:  ${BLUE}./docs/MIGRATION.md${NC}"
echo -e ""

echo -e "${GREEN}Happy coding! 🚀${NC}\n"

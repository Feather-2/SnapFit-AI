#!/bin/bash

# SnapFit AI Database Quick Deployment Script
# Version: 2.0.0
# Date: 2025-06-10

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DB_NAME="snapfit_ai"
DB_USER="postgres"
DEPLOY_TYPE="clean"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "SnapFit AI Database Quick Deployment"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -n, --name NAME       Database name (default: snapfit_ai)"
    echo "  -u, --user USER       Database user (default: postgres)"
    echo "  -t, --type TYPE       Deployment type: clean|schema|dev (default: clean)"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Deployment types:"
    echo "  clean   - Clean installation (structure only, no data) [DEFAULT]"
    echo "  schema  - Schema only (alias for clean)"
    echo "  dev     - Development setup (schema + create dev user)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Clean deployment to 'snapfit_ai'"
    echo "  $0 -n snapfit_ai_dev -t dev          # Development setup"
    echo "  $0 -n snapfit_ai_test -t schema      # Test environment"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            DB_NAME="$2"
            shift 2
            ;;
        -u|--user)
            DB_USER="$2"
            shift 2
            ;;
        -t|--type)
            DEPLOY_TYPE="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate deployment type
if [[ ! "$DEPLOY_TYPE" =~ ^(clean|schema|dev)$ ]]; then
    print_error "Invalid deployment type: $DEPLOY_TYPE"
    print_error "Valid types: clean, schema, dev"
    exit 1
fi

# Main deployment function
deploy_database() {
    print_status "Starting SnapFit AI Database Deployment"
    print_status "Database: $DB_NAME"
    print_status "User: $DB_USER"
    print_status "Type: $DEPLOY_TYPE"
    echo ""

    # Check if PostgreSQL is available
    if ! command -v psql &> /dev/null; then
        print_error "PostgreSQL client (psql) not found"
        print_error "Please install PostgreSQL client tools"
        exit 1
    fi

    # Check if database files exist
    case $DEPLOY_TYPE in
        "clean"|"schema"|"dev")
            DEPLOY_FILE="$SCRIPT_DIR/deploy.sql"
            ;;
    esac

    if [[ ! -f "$DEPLOY_FILE" ]]; then
        print_error "Deployment file not found: $DEPLOY_FILE"
        exit 1
    fi

    # Check if database already exists
    if psql -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        print_warning "Database '$DB_NAME' already exists"
        read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Dropping existing database..."
            dropdb -U "$DB_USER" "$DB_NAME"
        else
            print_error "Deployment cancelled"
            exit 1
        fi
    fi

    # Create database
    print_status "Creating database '$DB_NAME'..."
    createdb -U "$DB_USER" "$DB_NAME"
    print_success "Database created successfully"

    # Deploy database
    print_status "Deploying database structure..."
    if psql -U "$DB_USER" -d "$DB_NAME" -f "$DEPLOY_FILE"; then
        print_success "Database deployment completed"
    else
        print_error "Database deployment failed"
        exit 1
    fi

    # Additional setup for dev environment
    if [[ "$DEPLOY_TYPE" == "dev" ]]; then
        print_status "Setting up development environment..."

        # Create development user (if needed)
        psql -U "$DB_USER" -d "$DB_NAME" -c "
            DO \$\$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'snapfit_dev') THEN
                    CREATE ROLE snapfit_dev WITH LOGIN PASSWORD 'dev_password';
                    GRANT CONNECT ON DATABASE $DB_NAME TO snapfit_dev;
                    GRANT USAGE ON SCHEMA public TO snapfit_dev;
                    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO snapfit_dev;
                    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO snapfit_dev;
                END IF;
            END
            \$\$;
        " > /dev/null 2>&1

        print_success "Development user 'snapfit_dev' created"
    fi

    # Verification
    print_status "Verifying deployment..."

    # Check tables
    TABLE_COUNT=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    print_status "Tables created: $TABLE_COUNT"

    # Check functions
    FUNC_COUNT=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';" | tr -d ' ')
    print_status "Functions created: $FUNC_COUNT"

    # Check triggers
    TRIGGER_COUNT=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public';" | tr -d ' ')
    print_status "Triggers created: $TRIGGER_COUNT"

    # Verify expected counts
    if [[ "$TABLE_COUNT" -eq 6 && "$FUNC_COUNT" -eq 18 && "$TRIGGER_COUNT" -eq 4 ]]; then
        print_success "All database objects created successfully!"
    else
        print_warning "Object counts don't match expected values"
        print_warning "Expected: 6 tables, 18 functions, 4 triggers"
        print_warning "Actual: $TABLE_COUNT tables, $FUNC_COUNT functions, $TRIGGER_COUNT triggers"
    fi

    echo ""
    print_success "🎉 SnapFit AI Database deployment completed!"
    echo ""
    print_status "Connection details:"
    print_status "  Database: $DB_NAME"
    print_status "  User: $DB_USER"
    if [[ "$DEPLOY_TYPE" == "dev" ]]; then
        print_status "  Dev User: snapfit_dev (password: dev_password)"
    fi
    echo ""
    print_status "Connect with: psql -U $DB_USER -d $DB_NAME"
}

# Run deployment
deploy_database

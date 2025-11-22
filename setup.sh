#!/bin/bash

# DrSui Setup Script
# Fixes Python 3.14 compatibility issues by setting up Python 3.11 environment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Project root
PROJECT_ROOT="/Users/elibelilty/Documents/GitHub/DrSui"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Print functions
print_header() {
    echo -e "\n${BOLD}${CYAN}════════════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${BOLD}${CYAN}════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Python version
check_python_version() {
    if command_exists python3.11; then
        PYTHON_VERSION=$(python3.11 --version 2>&1 | awk '{print $2}')
        print_success "Python 3.11 found: $PYTHON_VERSION"
        return 0
    else
        return 1
    fi
}

# Install Homebrew
install_homebrew() {
    print_info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -f "/usr/local/bin/brew" ]]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
}

# Install Python 3.11 via Homebrew
install_python311() {
    print_info "Installing Python 3.11 via Homebrew..."
    
    if brew install python@3.11; then
        print_success "Python 3.11 installed successfully"
        
        # Add Python 3.11 to PATH
        if [[ -f "/opt/homebrew/opt/python@3.11/bin/python3.11" ]]; then
            export PATH="/opt/homebrew/opt/python@3.11/bin:$PATH"
        elif [[ -f "/usr/local/opt/python@3.11/bin/python3.11" ]]; then
            export PATH="/usr/local/opt/python@3.11/bin:$PATH"
        fi
        
        return 0
    else
        print_error "Failed to install Python 3.11"
        return 1
    fi
}

# Main setup function
main() {
    print_header "DrSui Project Setup"
    print_info "Fixing Python 3.14 compatibility by setting up Python 3.11 environment"
    
    # Step 1: Check for Python 3.11
    print_header "Step 1: Checking Python 3.11 Installation"
    
    if ! check_python_version; then
        print_warning "Python 3.11 not found. Checking for Homebrew..."
        
        # Step 2: Check for Homebrew
        if ! command_exists brew; then
            print_warning "Homebrew not found."
            echo -e "${YELLOW}To install Homebrew, run:${NC}"
            echo -e "${CYAN}/bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"${NC}"
            echo ""
            read -p "Do you want to install Homebrew now? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                install_homebrew
            else
                print_error "Cannot proceed without Homebrew. Please install it manually and run this script again."
                exit 1
            fi
        else
            print_success "Homebrew found"
        fi
        
        # Step 3: Install Python 3.11
        print_header "Step 2: Installing Python 3.11"
        if ! install_python311; then
            print_error "Failed to install Python 3.11. Please install it manually."
            exit 1
        fi
        
        # Verify installation
        if ! check_python_version; then
            print_error "Python 3.11 installation verification failed"
            print_info "You may need to add Python 3.11 to your PATH manually"
            print_info "Try: export PATH=\"/opt/homebrew/opt/python@3.11/bin:\$PATH\""
            exit 1
        fi
    fi
    
    # Step 4: Navigate to project root
    print_header "Step 3: Setting Up Project Directory"
    cd "$PROJECT_ROOT" || {
        print_error "Failed to navigate to project root: $PROJECT_ROOT"
        exit 1
    }
    print_success "Working directory: $(pwd)"
    
    # Step 5: Remove old virtual environment
    print_header "Step 4: Removing Old Virtual Environment"
    if [[ -d "$BACKEND_DIR/venv" ]]; then
        print_info "Removing old virtual environment at $BACKEND_DIR/venv"
        rm -rf "$BACKEND_DIR/venv"
        print_success "Old virtual environment removed"
    else
        print_info "No existing virtual environment found"
    fi
    
    # Also check for .venv in project root
    if [[ -d "$PROJECT_ROOT/.venv" ]]; then
        print_info "Removing old virtual environment at $PROJECT_ROOT/.venv"
        rm -rf "$PROJECT_ROOT/.venv"
        print_success "Old virtual environment removed"
    fi
    
    # Step 6: Create new virtual environment with Python 3.11
    print_header "Step 5: Creating New Virtual Environment with Python 3.11"
    cd "$BACKEND_DIR" || {
        print_error "Failed to navigate to backend directory: $BACKEND_DIR"
        exit 1
    }
    
    # Find Python 3.11
    PYTHON311=""
    if command_exists python3.11; then
        PYTHON311="python3.11"
    elif [[ -f "/opt/homebrew/opt/python@3.11/bin/python3.11" ]]; then
        PYTHON311="/opt/homebrew/opt/python@3.11/bin/python3.11"
    elif [[ -f "/usr/local/opt/python@3.11/bin/python3.11" ]]; then
        PYTHON311="/usr/local/opt/python@3.11/bin/python3.11"
    else
        print_error "Could not find python3.11 executable"
        print_info "Please ensure Python 3.11 is installed and in your PATH"
        exit 1
    fi
    
    print_info "Using Python: $PYTHON311"
    print_info "Creating virtual environment..."
    
    if "$PYTHON311" -m venv venv; then
        print_success "Virtual environment created successfully"
    else
        print_error "Failed to create virtual environment"
        exit 1
    fi
    
    # Step 7: Activate virtual environment and upgrade pip
    print_header "Step 6: Setting Up Virtual Environment"
    print_info "Activating virtual environment..."
    source venv/bin/activate
    
    print_info "Upgrading pip..."
    pip install --upgrade pip --quiet
    
    # Step 8: Install dependencies
    print_header "Step 7: Installing Dependencies"
    
    # Check if requirements.txt exists
    if [[ -f "requirements.txt" ]]; then
        print_info "Found requirements.txt, installing dependencies..."
        pip install -r requirements.txt
        print_success "Dependencies installed from requirements.txt"
    else
        print_warning "No requirements.txt found. Installing core dependencies..."
        
        # Install core dependencies based on what we see in the project
        print_info "Installing FastAPI, Uvicorn, and other core packages..."
        pip install fastapi uvicorn[standard] python-multipart
        
        print_info "Installing image processing libraries..."
        pip install pillow pydicom numpy
        
        print_info "Installing SDK and utilities..."
        pip install atoma-sdk python-dotenv requests
        
        print_success "Core dependencies installed"
        print_warning "Consider creating a requirements.txt file for better dependency management"
    fi
    
    # Step 9: Verify installation
    print_header "Step 8: Verifying Installation"
    
    print_info "Python version in venv:"
    python --version
    
    print_info "Checking key packages:"
    python -c "import fastapi; print(f'✅ FastAPI {fastapi.__version__}')" 2>/dev/null || print_error "FastAPI not found"
    python -c "import uvicorn; print(f'✅ Uvicorn {uvicorn.__version__}')" 2>/dev/null || print_error "Uvicorn not found"
    python -c "import pydicom; print(f'✅ PyDICOM {pydicom.__version__}')" 2>/dev/null || print_error "PyDICOM not found"
    python -c "import PIL; print(f'✅ Pillow {PIL.__version__}')" 2>/dev/null || print_error "Pillow not found"
    python -c "import numpy; print(f'✅ NumPy {numpy.__version__}')" 2>/dev/null || print_error "NumPy not found"
    
    # Final summary
    print_header "Setup Complete! 🎉"
    
    echo -e "${GREEN}✅ Python 3.11 virtual environment created${NC}"
    echo -e "${GREEN}✅ Dependencies installed${NC}"
    echo ""
    echo -e "${CYAN}To activate the virtual environment, run:${NC}"
    echo -e "${BOLD}cd backend && source venv/bin/activate${NC}"
    echo ""
    echo -e "${CYAN}To start the backend server, run:${NC}"
    echo -e "${BOLD}uvicorn main:app --reload${NC}"
    echo ""
    echo -e "${CYAN}To run the API tests, run:${NC}"
    echo -e "${BOLD}python test_api.py${NC}"
    echo ""
}

# Run main function
main "$@"


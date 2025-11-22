#!/bin/bash

# Dr. Sui - Start All Services Script
# Starts backend, gas station, and frontend services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Array to store background process IDs
PIDS=()

# Function to print colored output
print_status() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}\n"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for a service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=0
    
    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 1
    done
    
    echo ""
    print_warning "$service_name did not become ready after $max_attempts seconds"
    return 1
}

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            print_status "Stopping process $pid..."
            kill "$pid" 2>/dev/null
        fi
    done
    
    # Wait a bit for processes to terminate
    sleep 2
    
    # Force kill if still running
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            print_warning "Force killing process $pid..."
            kill -9 "$pid" 2>/dev/null
        fi
    done
    
    print_success "All services stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Change to project root
cd "$PROJECT_ROOT" || exit 1

print_header "Dr. Sui - Starting All Services"

# ===== Prerequisites Check =====
print_header "Checking Prerequisites"

# Check Python
if ! command_exists python3; then
    print_error "Python 3 is not installed"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
print_success "Python found: $PYTHON_VERSION"

# Check Node.js
if ! command_exists node; then
    print_error "Node.js is not installed"
    exit 1
fi
NODE_VERSION=$(node --version)
print_success "Node.js found: $NODE_VERSION"

# Check npm
if ! command_exists npm; then
    print_error "npm is not installed"
    exit 1
fi
NPM_VERSION=$(npm --version)
print_success "npm found: v$NPM_VERSION"

# Check environment files
print_status "Checking environment files..."

if [ ! -f "$PROJECT_ROOT/backend/.env" ]; then
    print_warning "backend/.env not found (optional, but recommended)"
else
    print_success "backend/.env exists"
fi

if [ ! -f "$PROJECT_ROOT/gas-station/.env" ]; then
    print_warning "gas-station/.env not found (optional, but recommended)"
else
    print_success "gas-station/.env exists"
fi

if [ ! -f "$PROJECT_ROOT/.env" ]; then
    print_warning ".env not found in project root (optional for frontend)"
else
    print_success ".env exists in project root"
fi

# ===== Start Services =====
print_header "Starting Services"

# Start Backend (Python FastAPI)
print_status "Starting Backend (Python FastAPI) on port 8000..."
cd "$PROJECT_ROOT/backend" || exit 1

if [ ! -d "venv" ]; then
    print_error "Python virtual environment not found in backend/"
    print_status "Please run: cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

source venv/bin/activate
uvicorn main:app --reload --port 8000 > /tmp/drsui-backend.log 2>&1 &
BACKEND_PID=$!
PIDS+=($BACKEND_PID)
print_success "Backend started (PID: $BACKEND_PID)"
cd "$PROJECT_ROOT" || exit 1

# Start Gas Station (Node.js)
print_status "Starting Gas Station (Node.js) on port 3001..."
cd "$PROJECT_ROOT/gas-station" || exit 1

if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found in gas-station/, installing dependencies..."
    npm install
fi

npm start > /tmp/drsui-gas-station.log 2>&1 &
GAS_STATION_PID=$!
PIDS+=($GAS_STATION_PID)
print_success "Gas Station started (PID: $GAS_STATION_PID)"
cd "$PROJECT_ROOT" || exit 1

# Start Frontend (React/Vite)
print_status "Starting Frontend (React/Vite) on port 3000..."
cd "$PROJECT_ROOT" || exit 1

if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found in project root, installing dependencies..."
    npm install
fi

npm run dev > /tmp/drsui-frontend.log 2>&1 &
FRONTEND_PID=$!
PIDS+=($FRONTEND_PID)
print_success "Frontend started (PID: $FRONTEND_PID)"

# ===== Wait for Services =====
print_header "Waiting for Services to be Ready"

# Wait for backend
if wait_for_service "http://localhost:8000/status" "Backend"; then
    BACKEND_STATUS="${GREEN}✓ Online${NC}"
else
    BACKEND_STATUS="${RED}✗ Offline${NC}"
fi

# Wait for gas station
if wait_for_service "http://localhost:3001/health" "Gas Station"; then
    GAS_STATION_STATUS="${GREEN}✓ Online${NC}"
else
    GAS_STATION_STATUS="${RED}✗ Offline${NC}"
fi

# Wait for frontend (Vite dev server)
if wait_for_service "http://localhost:3000" "Frontend"; then
    FRONTEND_STATUS="${GREEN}✓ Online${NC}"
else
    FRONTEND_STATUS="${RED}✗ Offline${NC}"
fi

# ===== Summary =====
print_header "Service Status Summary"

echo -e "${CYAN}Backend (FastAPI):${NC}     $BACKEND_STATUS"
echo -e "  ${BLUE}URL:${NC} http://localhost:8000"
echo -e "  ${BLUE}Health:${NC} http://localhost:8000/status"
echo -e "  ${BLUE}Logs:${NC} tail -f /tmp/drsui-backend.log"
echo ""

echo -e "${CYAN}Gas Station (Node.js):${NC} $GAS_STATION_STATUS"
echo -e "  ${BLUE}URL:${NC} http://localhost:3001"
echo -e "  ${BLUE}Health:${NC} http://localhost:3001/health"
echo -e "  ${BLUE}Status:${NC} http://localhost:3001/status"
echo -e "  ${BLUE}Stats:${NC} http://localhost:3001/stats"
echo -e "  ${BLUE}Logs:${NC} tail -f /tmp/drsui-gas-station.log"
echo ""

echo -e "${CYAN}Frontend (React/Vite):${NC} $FRONTEND_STATUS"
echo -e "  ${BLUE}URL:${NC} http://localhost:3000"
echo -e "  ${BLUE}Logs:${NC} tail -f /tmp/drsui-frontend.log"
echo ""

print_header "Quick Start Instructions"

echo -e "${GREEN}1.${NC} Open your browser and go to: ${CYAN}http://localhost:3000${NC}"
echo -e "${GREEN}2.${NC} Connect your Sui wallet"
echo -e "${GREEN}3.${NC} Upload a DICOM medical image for analysis"
echo -e "${GREEN}4.${NC} Verify the diagnosis on the Sui blockchain"
echo ""

echo -e "${YELLOW}To view logs:${NC}"
echo -e "  Backend:     ${CYAN}tail -f /tmp/drsui-backend.log${NC}"
echo -e "  Gas Station: ${CYAN}tail -f /tmp/drsui-gas-station.log${NC}"
echo -e "  Frontend:    ${CYAN}tail -f /tmp/drsui-frontend.log${NC}"
echo ""

echo -e "${YELLOW}To stop all services:${NC} Press ${CYAN}Ctrl+C${NC}"
echo ""

print_success "All services are running! Press Ctrl+C to stop."

# Keep script running
while true; do
    sleep 1
    # Check if any process died
    for pid in "${PIDS[@]}"; do
        if ! kill -0 "$pid" 2>/dev/null; then
            print_error "Process $pid has stopped unexpectedly"
        fi
    done
done


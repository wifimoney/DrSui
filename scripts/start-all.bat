@echo off
REM Dr. Sui - Start All Services Script (Windows)
REM Starts backend, gas station, and frontend services

setlocal enabledelayedexpansion

REM Get the directory where the script is located
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."

REM Change to project root
cd /d "%PROJECT_ROOT%"

echo.
echo ========================================
echo   Dr. Sui - Starting All Services
echo ========================================
echo.

REM ===== Prerequisites Check =====
echo [INFO] Checking Prerequisites...
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo [OK] Python found: %PYTHON_VERSION%

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js found: %NODE_VERSION%

REM Check npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [OK] npm found: v%NPM_VERSION%

REM Check environment files
echo.
echo [INFO] Checking environment files...
if exist "%PROJECT_ROOT%\backend\.env" (
    echo [OK] backend\.env exists
) else (
    echo [WARNING] backend\.env not found (optional, but recommended)
)

if exist "%PROJECT_ROOT%\gas-station\.env" (
    echo [OK] gas-station\.env exists
) else (
    echo [WARNING] gas-station\.env not found (optional, but recommended)
)

if exist "%PROJECT_ROOT%\.env" (
    echo [OK] .env exists in project root
) else (
    echo [WARNING] .env not found in project root (optional for frontend)
)

REM ===== Start Services =====
echo.
echo ========================================
echo   Starting Services
echo ========================================
echo.

REM Start Backend (Python FastAPI)
echo [INFO] Starting Backend (Python FastAPI) on port 8000...
cd "%PROJECT_ROOT%\backend"
if not exist "venv" (
    echo [ERROR] Python virtual environment not found in backend\
    echo [INFO] Please run: cd backend ^&^& python -m venv venv ^&^& venv\Scripts\activate ^&^& pip install -r requirements.txt
    exit /b 1
)

start "DrSui Backend" cmd /k "venv\Scripts\activate && uvicorn main:app --reload --port 8000"
cd "%PROJECT_ROOT%"
echo [OK] Backend started in new window

REM Start Gas Station (Node.js)
echo [INFO] Starting Gas Station (Node.js) on port 3001...
cd "%PROJECT_ROOT%\gas-station"
if not exist "node_modules" (
    echo [WARNING] node_modules not found in gas-station\, installing dependencies...
    call npm install
)

start "DrSui Gas Station" cmd /k "npm start"
cd "%PROJECT_ROOT%"
echo [OK] Gas Station started in new window

REM Start Frontend (React/Vite)
echo [INFO] Starting Frontend (React/Vite) on port 3000...
cd "%PROJECT_ROOT%"
if not exist "node_modules" (
    echo [WARNING] node_modules not found in project root, installing dependencies...
    call npm install
)

start "DrSui Frontend" cmd /k "npm run dev"
cd "%PROJECT_ROOT%"
echo [OK] Frontend started in new window

REM ===== Wait for Services =====
echo.
echo ========================================
echo   Waiting for Services to be Ready
echo ========================================
echo.

echo [INFO] Waiting for Backend to be ready...
set BACKEND_READY=0
for /l %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    curl -s http://localhost:8000/status >nul 2>&1
    if not errorlevel 1 (
        echo [OK] Backend is ready!
        set BACKEND_READY=1
        goto :backend_done
    )
    echo|set /p="."
)
:backend_done
if !BACKEND_READY!==0 (
    echo.
    echo [WARNING] Backend did not become ready after 30 seconds
)

echo.
echo [INFO] Waiting for Gas Station to be ready...
set GAS_STATION_READY=0
for /l %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    curl -s http://localhost:3001/health >nul 2>&1
    if not errorlevel 1 (
        echo [OK] Gas Station is ready!
        set GAS_STATION_READY=1
        goto :gas_station_done
    )
    echo|set /p="."
)
:gas_station_done
if !GAS_STATION_READY!==0 (
    echo.
    echo [WARNING] Gas Station did not become ready after 30 seconds
)

echo.
echo [INFO] Waiting for Frontend to be ready...
set FRONTEND_READY=0
for /l %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    curl -s http://localhost:3000 >nul 2>&1
    if not errorlevel 1 (
        echo [OK] Frontend is ready!
        set FRONTEND_READY=1
        goto :frontend_done
    )
    echo|set /p="."
)
:frontend_done
if !FRONTEND_READY!==0 (
    echo.
    echo [WARNING] Frontend did not become ready after 30 seconds
)

REM ===== Summary =====
echo.
echo ========================================
echo   Service Status Summary
echo ========================================
echo.

echo Backend (FastAPI):
if !BACKEND_READY!==1 (
    echo   [OK] Online
) else (
    echo   [ERROR] Offline
)
echo   URL: http://localhost:8000
echo   Health: http://localhost:8000/status
echo.

echo Gas Station (Node.js):
if !GAS_STATION_READY!==1 (
    echo   [OK] Online
) else (
    echo   [ERROR] Offline
)
echo   URL: http://localhost:3001
echo   Health: http://localhost:3001/health
echo   Status: http://localhost:3001/status
echo   Stats: http://localhost:3001/stats
echo.

echo Frontend (React/Vite):
if !FRONTEND_READY!==1 (
    echo   [OK] Online
) else (
    echo   [ERROR] Offline
)
echo   URL: http://localhost:3000
echo.

echo ========================================
echo   Quick Start Instructions
echo ========================================
echo.

echo 1. Open your browser and go to: http://localhost:3000
echo 2. Connect your Sui wallet
echo 3. Upload a DICOM medical image for analysis
echo 4. Verify the diagnosis on the Sui blockchain
echo.

echo To stop services: Close the command windows or press Ctrl+C in each window
echo.

echo [OK] All services are running!
echo.
echo Press any key to exit (services will continue running in their windows)...
pause >nul


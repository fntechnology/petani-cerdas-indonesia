@echo off
echo ================================================
echo    Aplikasi Analisa Pertanian Indonesia v2.1
echo              [Development Mode]
echo ================================================
echo.

:: Pastikan berada di direktori yang benar
cd /d "%~dp0"

:: Install dependencies jika belum
if not exist node_modules (
    echo Installing Node.js dependencies...
    call npm install
)

:: Install Python dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

:: Jalankan server
echo.
echo Starting development server...
start "Python API Server" cmd /c "python server.py"
timeout /t 3 /nobreak >nul

:: Jalankan React development server
npm start

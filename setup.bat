@echo off
echo ====================================
echo Instalasi Analisa Pertanian Indonesia
echo ====================================

:: Cek Python
python --version > nul 2>&1
if errorlevel 1 (
    echo Python tidak ditemukan! 
    echo Silakan install Python dari https://www.python.org/downloads/
    echo Pastikan untuk mencentang "Add Python to PATH" saat instalasi
    pause
    exit
)

:: Cek Node.js
node --version > nul 2>&1
if errorlevel 1 (
    echo Node.js tidak ditemukan!
    echo Silakan install Node.js dari https://nodejs.org/
    pause
    exit
)

:: Install dependencies Python jika diperlukan
echo.
echo Menginstall dependencies Python...
pip install -r requirements.txt

:: Install dependencies Node.js
echo.
echo Menginstall dependencies Node.js...
npm install

echo.
echo Instalasi selesai!
echo.
pause

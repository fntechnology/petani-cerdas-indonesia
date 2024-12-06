@echo off
echo ========================================
echo Menghentikan Analisa Pertanian Indonesia
echo ========================================

:: Mencari proses Python yang menjalankan server.py
for /f "tokens=2" %%a in ('tasklist ^| findstr "python.exe"') do (
    taskkill /PID %%a /F
)

echo.
echo Server telah dihentikan
echo.
pause

@echo off
echo =======================================
echo Menjalankan Analisa Pertanian Indonesia
echo =======================================

:: Jalankan server Python
start "Python Server" cmd /c "python server.py"

:: Tunggu sebentar agar server siap
timeout /t 3 /nobreak > nul

:: Buka browser ke aplikasi
start http://localhost:8000

echo.
echo Server berjalan di http://localhost:8000
echo.
echo Tekan Ctrl+C untuk menghentikan server
echo.

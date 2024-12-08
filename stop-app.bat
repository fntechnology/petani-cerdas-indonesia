@echo off
echo Menghentikan server...

:: Mencari dan menghentikan proses Python server
for /f "tokens=2" %%a in ('tasklist ^| findstr "python.exe"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Mencari dan menghentikan proses Node.js
for /f "tokens=2" %%a in ('tasklist ^| findstr "node.exe"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo Server berhasil dihentikan!
timeout /t 2 >nul

@echo off
setlocal

echo ============================
echo   Git Auto Commit + Push
echo ============================

set /p MSG=Enter commit message: 

if "%MSG%"=="" (
    echo Message required.
    pause
    exit /b
)

git add .
git commit -m "%MSG%"
git push origin main

if %ERRORLEVEL% NEQ 0 (
    echo Push failed.
) else (
    echo Done.
)

pause
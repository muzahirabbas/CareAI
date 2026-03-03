@echo off
setlocal

echo ============================
echo   Git Push Tool
echo ============================

git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo Push failed. Check connection or login.
) else (
    echo Push successful.
)

pause
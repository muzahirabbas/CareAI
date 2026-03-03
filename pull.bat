@echo off
setlocal

echo ============================
echo   Git Pull
echo ============================

git pull origin main

if %ERRORLEVEL% NEQ 0 (
    echo Pull failed.
) else (
    echo Repo updated.
)

pause
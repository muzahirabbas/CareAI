@echo off
setlocal

echo ============================
echo   Git Commit Tool
echo ============================

set /p MSG=Enter commit message: 

if "%MSG%"=="" (
    echo Commit message cannot be empty.
    pause
    exit /b
)

git add .

git commit -m "%MSG%"

echo.
echo Commit done.
pause
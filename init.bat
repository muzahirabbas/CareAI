@echo off
setlocal

echo ============================
echo   Git Repo Initializer
echo ============================

set /p REPO_NAME=Enter GitHub repo name: 

if "%REPO_NAME%"=="" (
    echo Repo name cannot be empty.
    pause
    exit /b
)

git init

git branch -M main

git add .

git commit -m "Initial commit"

git remote add origin https://github.com/%USERNAME%/%REPO_NAME%.git

echo.
echo Repo initialized and connected.
echo Now create the repo on GitHub with the same name.
echo.

pause
@echo off
setlocal

echo ============================
echo   GitHub Repo Creator
echo ============================

set /p REPO=Enter repo name: 
set /p VISIBILITY=Public or Private (p/r): 

if "%REPO%"=="" (
    echo Repo name required.
    pause
    exit /b
)

if /I "%VISIBILITY%"=="p" (
    set VIS=public
) else (
    set VIS=private
)

echo Creating repository on GitHub...

gh repo create %REPO% --%VIS% --source=. --remote=origin --push

if %ERRORLEVEL% NEQ 0 (
    echo Failed to create repo.
) else (
    echo Repo created and pushed.
)

pause
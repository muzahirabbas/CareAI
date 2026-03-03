@echo off
echo Building React application...
cmd.exe /c "npm run build"

if %errorlevel% neq 0 (
    echo.
    echo ----------------------------------------
    echo Build failed. Deployment aborted.
    echo ----------------------------------------
    pause
    exit /b %errorlevel%
)

echo.
echo Deploying to Cloudflare Pages project 'transplantcare'...
call wrangler pages deploy dist --project-name=transplantcare

if %errorlevel% neq 0 (
    echo.
    echo ----------------------------------------
    echo Deployment failed.
    echo ----------------------------------------
    pause
    exit /b %errorlevel%
)

echo.
echo ----------------------------------------
echo Build and deployment completed successfully!
echo ----------------------------------------
pause

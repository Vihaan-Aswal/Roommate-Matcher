@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "FORCE_REBUILD=0"
set "FORCE_RESEED=0"

:parse_args
if "%~1"=="" goto after_args
if /I "%~1"=="--rebuild-frontend" (
  set "FORCE_REBUILD=1"
  shift
  goto parse_args
)
if /I "%~1"=="--reseed-data" (
  set "FORCE_RESEED=1"
  shift
  goto parse_args
)
if /I "%~1"=="-h" goto show_help
if /I "%~1"=="--help" goto show_help

echo [showcase] Unknown argument: %~1
goto show_help_with_error

:after_args
if exist ".venv\Scripts\python.exe" (
  set "PYTHON_EXE=%ROOT_DIR%.venv\Scripts\python.exe"
) else (
  if exist ".venv\bin\python" (
    set "PYTHON_EXE=%ROOT_DIR%.venv\bin\python"
  ) else (
    where python >nul 2>&1
    if errorlevel 1 (
      echo [showcase] Python executable not found.
      exit /b 1
    )

    echo [showcase] .venv not found, creating local virtual environment.
    python -m venv "%ROOT_DIR%.venv"
    if errorlevel 1 exit /b 1

    if exist "%ROOT_DIR%.venv\Scripts\python.exe" (
      set "PYTHON_EXE=%ROOT_DIR%.venv\Scripts\python.exe"
    ) else (
      if exist "%ROOT_DIR%.venv\bin\python" (
        set "PYTHON_EXE=%ROOT_DIR%.venv\bin\python"
      ) else (
        echo [showcase] Failed to locate Python in newly created .venv.
        exit /b 1
      )
    )
  )
)

"%PYTHON_EXE%" --version >nul 2>&1
if errorlevel 1 (
  echo [showcase] Python executable not found.
  exit /b 1
)

echo [showcase] Using Python runtime: %PYTHON_EXE%

if "%FORCE_REBUILD%"=="1" (
  if "%FORCE_RESEED%"=="1" (
    "%PYTHON_EXE%" backend\scripts\showcase_bootstrap.py --force-rebuild-frontend --force-reseed-data
  ) else (
    "%PYTHON_EXE%" backend\scripts\showcase_bootstrap.py --force-rebuild-frontend
  )
) else (
  if "%FORCE_RESEED%"=="1" (
    "%PYTHON_EXE%" backend\scripts\showcase_bootstrap.py --force-reseed-data
  ) else (
    "%PYTHON_EXE%" backend\scripts\showcase_bootstrap.py
  )
)
if errorlevel 1 exit /b 1

echo [showcase] Starting FastAPI at http://127.0.0.1:8000
cd /d "%ROOT_DIR%backend"
"%PYTHON_EXE%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
exit /b %errorlevel%

:show_help
echo Usage: start.bat [--rebuild-frontend] [--reseed-data]
echo.
echo   --rebuild-frontend   Force rebuild frontend/dist before launching.
echo   --reseed-data        Force reset + reseed data/app.db before launching.
echo   -h, --help           Show this help message.
exit /b 0

:show_help_with_error
echo.
echo Usage: start.bat [--rebuild-frontend] [--reseed-data]
exit /b 1

@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
echo === PathFinder ML trainer ===
echo.

REM ─── 1. Find a base interpreter that has PyTorch wheels (3.10 - 3.13) ──────
REM Never rely on `python`/`pip` being on PATH; some installs (pymanager,
REM Store Python) put neither there.
set "BASEPY="
for %%V in (3.13 3.12 3.11 3.10) do (
  if not defined BASEPY (
    py -%%V -c "import sys" >nul 2>nul && set "BASEPY=py -%%V"
  )
)
if not defined BASEPY (
  py -3 -c "import sys" >nul 2>nul && set "BASEPY=py -3"
)
if not defined BASEPY (
  python -c "import sys" >nul 2>nul && set "BASEPY=python"
)
if not defined BASEPY (
  echo ERROR: No Python found. Install Python 3.12 or 3.13 from python.org
  echo        ^(tick "Add python.exe to PATH"^) and run this again.
  goto :fail
)
for /f "delims=" %%O in ('%BASEPY% -c "import sys;print(sys.version.split()[0])"') do set "PYVER=%%O"
echo Base interpreter: %BASEPY%  ^(Python %PYVER%^)
%BASEPY% -c "import sys;raise SystemExit(0 if (3,10)<=sys.version_info<(3,14) else 1)" >nul 2>nul
if errorlevel 1 (
  echo WARNING: Python %PYVER% may have no PyTorch wheels yet. If the torch
  echo          install below fails, install Python 3.13 and re-run.
)
echo.

REM ─── 2. Virtual environment ───────────────────────────────────────────────
set "VENVPY=%CD%\.venv\Scripts\python.exe"
if exist "%VENVPY%" (
  "%VENVPY%" -c "import sys" >nul 2>nul
  if errorlevel 1 (
    echo Existing .venv is broken - recreating...
    rmdir /s /q ".venv"
  )
) else (
  if exist ".venv" (
    echo Existing .venv is incomplete - recreating...
    rmdir /s /q ".venv"
  )
)
if not exist "%VENVPY%" (
  echo Creating virtual environment...
  %BASEPY% -m venv .venv
  if errorlevel 1 goto :venvfail
)
if not exist "%VENVPY%" goto :venvfail
echo Virtual environment: %VENVPY%
echo.

REM ─── 3. Dependencies (always via -m pip, never the `pip` command) ─────────
"%VENVPY%" -m pip install --upgrade pip setuptools wheel >nul 2>nul

"%VENVPY%" -c "import torch,sys;sys.exit(0 if torch.cuda.is_available() else 1)" >nul 2>nul
if errorlevel 1 (
  echo Installing PyTorch with CUDA 12.8 ^(RTX 50-series / Blackwell needs torch ^>= 2.7^)...
  echo This downloads ~2.5 GB and takes a few minutes.
  "%VENVPY%" -m pip install --upgrade torch --index-url https://download.pytorch.org/whl/cu128
  if errorlevel 1 (
    echo.
    echo ERROR: PyTorch install failed.
    echo   - On Python 3.14 there may be no cu128 wheel yet: install Python 3.13 and re-run.
    echo   - Behind a proxy? Set HTTPS_PROXY and try again.
    goto :fail
  )
)

echo Installing training requirements...
"%VENVPY%" -m pip install -r requirements.txt
if errorlevel 1 goto :fail
if exist "data\distill\train.jsonl" (
  if exist "requirements-lora.txt" "%VENVPY%" -m pip install -r requirements-lora.txt
)
echo.

REM ─── 4. Report the GPU, then train ────────────────────────────────────────
"%VENVPY%" -c "import torch;print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NONE - training on CPU (much slower)')"
echo.
"%VENVPY%" run_all.py %*
set "RC=%errorlevel%"
echo.
if "%RC%"=="0" (
  echo Done. The zip printed above is under output\ - send that file back.
) else (
  echo Finished with a failed stage - see output\run-*\train.log and REPORT.md
)
if "%NO_PAUSE%"=="" pause
exit /b %RC%

:venvfail
echo.
echo ERROR: Could not create a virtual environment with: %BASEPY%
echo        Try:  %BASEPY% -m ensurepip --upgrade
echo        or install Python 3.13 from python.org and run this again.
goto :fail

:fail
echo.
echo Setup failed. See the messages above.
if "%NO_PAUSE%"=="" pause
exit /b 1

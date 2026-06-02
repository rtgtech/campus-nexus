$ErrorActionPreference = "Stop"

$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvDir = Join-Path $BackendDir "venv"
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"
$Requirements = Join-Path $BackendDir "requirements.txt"
$EnvExample = Join-Path $BackendDir ".env.example"
$EnvFile = Join-Path $BackendDir ".env"

if (-not (Test-Path $PythonExe)) {
    $PyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($PyLauncher) {
        & py -3 -m venv $VenvDir
    } else {
        & python -m venv $VenvDir
    }
}

if (-not (Test-Path $EnvFile) -and (Test-Path $EnvExample)) {
    Copy-Item $EnvExample $EnvFile
}

& $PythonExe -c "import flask, sqlalchemy, psycopg" 2>$null
if ($LASTEXITCODE -ne 0) {
    & $PythonExe -m pip install -r $Requirements
}

& $PythonExe (Join-Path $BackendDir "app.py")

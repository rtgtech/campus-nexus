param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("backup", "sync")]
    [string]$Action,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArguments
)

$ErrorActionPreference = "Stop"

$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvDir = Join-Path $BackendDir "venv"
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"
$Requirements = Join-Path $BackendDir "requirements.txt"

if (-not (Test-Path $PythonExe)) {
    $PyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($PyLauncher) {
        & py -3 -m venv $VenvDir
    } else {
        & python -m venv $VenvDir
    }
}

& $PythonExe -c "import dotenv, flask, neo4j, sqlalchemy" 2>$null
if ($LASTEXITCODE -ne 0) {
    & $PythonExe -m pip install -r $Requirements
}

& $PythonExe (Join-Path $BackendDir "database_sync.py") $Action @RemainingArguments
exit $LASTEXITCODE

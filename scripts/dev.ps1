param([switch]$Release)
$ErrorActionPreference = 'Stop'
foreach ($name in @('CARGO_HOME','RUSTUP_HOME')) {
    $value = [Environment]::GetEnvironmentVariable($name, 'User')
    if ($value) { Set-Item -Path "Env:$name" -Value $value }
}
if ($env:CARGO_HOME) { $env:Path = (Join-Path $env:CARGO_HOME 'bin') + ';' + $env:Path }
Push-Location (Split-Path $PSScriptRoot)
try {
    if ($Release) { cargo run -p dossier --release } else { cargo run -p dossier }
    if ($LASTEXITCODE -ne 0) { throw "Dossier exited with code $LASTEXITCODE" }
} finally { Pop-Location }

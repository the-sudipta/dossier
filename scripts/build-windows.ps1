$ErrorActionPreference = 'Stop'
foreach ($name in @('CARGO_HOME','RUSTUP_HOME')) {
    $value = [Environment]::GetEnvironmentVariable($name, 'User')
    if ($value) { Set-Item -Path "Env:$name" -Value $value }
}
if ($env:CARGO_HOME) { $env:Path = (Join-Path $env:CARGO_HOME 'bin') + ';' + $env:Path }
Push-Location (Split-Path $PSScriptRoot)
try {
    cargo fmt --all -- --check
    if ($LASTEXITCODE -ne 0) { throw 'Formatting check failed.' }
    cargo test --locked -p dossier-core
    if ($LASTEXITCODE -ne 0) { throw 'Core tests failed.' }
    cargo build --locked --release --workspace
    if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed. Resolve the reported prerequisite or policy issue; no incomplete release is packaged.' }
    New-Item -ItemType Directory -Force -Path dist | Out-Null
    Copy-Item -LiteralPath 'target/release/dossier.exe' -Destination 'dist/Dossier.exe'
    Copy-Item -LiteralPath 'target/release/dossier-cli.exe' -Destination 'dist/dossier-cli.exe'
    Copy-Item -LiteralPath 'LICENSE','README.md' -Destination dist
    Get-FileHash -LiteralPath 'dist/Dossier.exe','dist/dossier-cli.exe' -Algorithm SHA256 | Format-Table
    Write-Host 'Dossier is ready in dist. Double-click Dossier.exe. No server is needed.'
} finally { Pop-Location }

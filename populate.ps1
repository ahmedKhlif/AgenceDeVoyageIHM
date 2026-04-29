param(
    [switch]$BackfillOnly
)

# Wrapper to the robust, non-interactive seed script.
# This avoids Invoke-WebRequest parsing prompts and duplicate-key crashes.
$scriptPath = Join-Path $PSScriptRoot "add-20-hotels.ps1"

if (-not (Test-Path $scriptPath)) {
    Write-Error "Seed script not found: $scriptPath"
    exit 1
}

if ($BackfillOnly) {
    & $scriptPath -BackfillOnly
}
else {
    & $scriptPath
}
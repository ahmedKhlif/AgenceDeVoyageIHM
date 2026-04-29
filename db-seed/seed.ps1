# Main Seed Script
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "   VOYAGEHUB DATABASE SEEDER (PRO)        " -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow

$scripts = @(
    "01-accounts.ps1",
    "02-hotels.ps1",
    "03-offers.ps1"
    # "04-reservations.ps1" - Disabled (requires user account)
)

foreach ($s in $scripts) {
    $path = Join-Path $PSScriptRoot $s
    if (Test-Path $path) {
        & $path
    } else {
        Write-Warning "Script not found: $s"
    }
}

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "   DATABASE SEEDING COMPLETE!             " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

. "$PSScriptRoot\config.ps1"

Write-Host "`n[STEP 1] Ensuring Accounts..." -ForegroundColor Cyan

# Ensure Agency exists
$agencies = Get-Collection -Uri "$baseUrl/agences-voyage"
if ($agencies.Count -eq 0) {
    $agencyPayload = @{
        email         = "admin@voyagehub.tn"
        motDePasse    = "Admin1234!"
        nomAgence     = "VoyageHub Agency"
        siret         = "12345678901234"
        adresseAgence = "Tunis, Tunisia"
        actif         = $true
    }
    $agency = Invoke-JsonRequest -Method POST -Uri "$baseUrl/agences-voyage" -Body $agencyPayload
    Write-Host "  + Created Admin Agency: $($agency.email)"
} else {
    $agency = $agencies[0]
    Write-Host "  . Admin Agency already exists: $($agency.email)"
}

# Verify disabled - API handles verification

# User creation disabled as requested

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

# Verify the admin agency account in the database
Write-Host "  . Verifying admin account via Prisma SQL..."
$dbUrl = ""
$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    foreach ($line in $envContent) {
        if ($line -match "^DATABASE_URL=(.*)") {
            $dbUrl = $matches[1].Trim('"').Trim("'")
        }
    }
}

if ($dbUrl -ne "") {
    $verifyScript = @"
const { Client } = require('pg');
async function verify() {
const client = new Client({ connectionString: '$dbUrl' });
await client.connect();
await client.query('UPDATE accounts SET "emailVerified" = true');
await client.end();
}
verify().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
"@
    $verifyScript | Out-File -FilePath "$PSScriptRoot\verify.js" -Encoding utf8
    node "$PSScriptRoot\verify.js"
    Remove-Item "$PSScriptRoot\verify.js"
}

# User creation disabled as requested

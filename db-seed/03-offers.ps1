. "$PSScriptRoot\config.ps1"

Write-Host "`n[STEP 3] Creating 10 Random Offers..." -ForegroundColor Cyan

$allHotels = Get-Collection -Uri "$baseUrl/hotels"
if ($allHotels.Count -lt 10) {
    Write-Host "  ! Not enough hotels to create 10 unique offers. Using what's available."
    $selected = $allHotels
} else {
    $selected = $allHotels | Get-Random -Count 10
}

$today = Get-Date
foreach ($h in $selected) {
    $offerPayload = @{
        titre       = "Exclusive Deal: $($h.nom)"
        description = "Flash sale! Book now and save big on your stay in $($h.ville)."
        tauxRemise  = Get-Random -Minimum 15 -Maximum 40
        dateDebut   = $today.ToString("o")
        dateFin     = $today.AddDays(15).ToString("o")
        active      = $true
        hotelId     = $h.id
        photo       = $hotelImages | Get-Random
    }
    Invoke-JsonRequest -Method POST -Uri "$baseUrl/offres" -Body $offerPayload | Out-Null
    Write-Host "  + Offer created for $($h.nom) ($($offerPayload.tauxRemise)% off)"
}

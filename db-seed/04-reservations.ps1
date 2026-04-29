. "$PSScriptRoot\config.ps1"

Write-Host "`n[STEP 4] Creating 3 Reservations for User..." -ForegroundColor Cyan

$userAccount = (Get-Collection -Uri "$baseUrl/accounts" | Where-Object { $_.email -eq "user@voyagehub.tn" })
if ($null -eq $userAccount) {
    Write-Error "User account not found. Run step 01 first."
    return
}

$allHotels = Get-Collection -Uri "$baseUrl/hotels" | Get-Random -Count 3
$today = Get-Date

$resCount = 0
foreach ($h in $allHotels) {
    $rooms = Get-Collection -Uri "$baseUrl/chambres?hotelId=$($h.id)"
    if ($rooms.Count -gt 0) {
        $room = $rooms[0]
        $arrival = $today.AddDays(10 + ($resCount * 14))
        $departure = $arrival.AddDays(3)
        
        $resPayload = @{
            accountId        = $userAccount.id
            chambreId        = $room.id
            dateArrivee      = $arrival.ToString("o")
            dateDepart       = $departure.ToString("o")
            nombrePersonnes  = 2
            nombreNuits      = 3
            montantTotal     = $room.prixParNuit * 3
            codeConfirmation = "VH-$(Get-Random -Minimum 1000 -Maximum 9999)-$($h.id)"
            statut           = "CONFIRMEE"
        }
        
        Invoke-JsonRequest -Method POST -Uri "$baseUrl/reservations" -Body $resPayload | Out-Null
        Write-Host "  + Reservation confirmed for $($h.nom) (Room: $($room.numero))"
        $resCount++
    }
}

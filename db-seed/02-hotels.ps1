. "$PSScriptRoot\config.ps1"

Write-Host "`n[STEP 2] Creating Hotels (1-7 per city)..." -ForegroundColor Cyan

$agency = (Get-Collection -Uri "$baseUrl/agences-voyage")[0]
$roomTypes = Get-Collection -Uri "$baseUrl/types-chambre"

if ($roomTypes.Count -eq 0) {
    Write-Host "  ! No room types found, creating defaults..."
    $types = @(
        @{ libelle = "Standard"; superficieM2 = 22; equipements = @("WiFi", "TV", "AC") },
        @{ libelle = "Deluxe";   superficieM2 = 32; equipements = @("WiFi", "TV", "AC", "Minibar") },
        @{ libelle = "Suite";    superficieM2 = 55; equipements = @("WiFi", "TV", "AC", "Minibar", "Jacuzzi") }
    )
    foreach ($t in $types) {
        Invoke-JsonRequest -Method POST -Uri "$baseUrl/types-chambre" -Body $t | Out-Null
    }
    $roomTypes = Get-Collection -Uri "$baseUrl/types-chambre"
}

foreach ($city in $cities) {
    $count = Get-Random -Minimum 1 -Maximum 8
    Write-Host "  > $($city): Generating $count hotels..."
    
    for ($i = 1; $i -le $count; $i++) {
        $prefix = $hotelPrefixes | Get-Random
        $suffix = $hotelSuffixes | Get-Random
        $hotelName = "$prefix $suffix $city"
        
        $existing = Get-Collection -Uri "$baseUrl/hotels" | Where-Object { $_.nom -eq $hotelName }
        if ($existing.Count -gt 0) { continue }
        
        $hotelPayload = @{
            nom            = $hotelName
            adresse        = "$((Get-Random -Minimum 10 -Maximum 500)) Avenue Habib Bourguiba, $city"
            ville          = $city
            pays           = "Tunisia"
            etoiles        = Get-Random -Minimum 3 -Maximum 6
            description    = "Discover the essence of luxury at $hotelName in $city. A perfect blend of tradition and modern comfort."
            email          = "info@$(($hotelName -replace ' ', '').ToLower()).tn"
            telephone      = "+216 {0:D8}" -f (Get-Random -Minimum 10000000 -Maximum 99999999)
            agenceVoyageId = $agency.id
            actif          = $true
        }
        
        $hotel = Invoke-JsonRequest -Method POST -Uri "$baseUrl/hotels" -Body $hotelPayload
        
        # Add 3-5 rooms with unique images
        $roomCount = Get-Random -Minimum 3 -Maximum 6
        for ($r = 1; $r -le $roomCount; $r++) {
            $type = $roomTypes | Get-Random
            
            # Select 2 unique room images
            $selectedRoomPhotos = $roomImages | Get-Random -Count 3
            # And add one hotel exterior photo
            $selectedHotelPhotos = $hotelImages | Get-Random -Count 1
            $allPhotos = @($selectedHotelPhotos) + @($selectedRoomPhotos)

            $roomPayload = @{
                numero        = "$($r)0$i"
                etage         = $r
                prixParNuit   = Get-Random -Minimum 120 -Maximum 850
                capacite      = Get-Random -Minimum 1 -Maximum 5
                disponible    = $true
                photos        = $allPhotos
                hotelId       = $hotel.id
                typeChambreId = $type.id
            }
            Invoke-JsonRequest -Method POST -Uri "$baseUrl/chambres" -Body $roomPayload | Out-Null
        }
    }
}

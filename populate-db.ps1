$baseUrl = "http://localhost:3001/api"
$headers = @{ "Content-Type" = "application/json" }

function Invoke-JsonRequest {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter()][object]$Body
    )
    if ($PSBoundParameters.ContainsKey("Body")) {
        $json = $Body | ConvertTo-Json -Depth 10 -Compress
        return Invoke-RestMethod -Uri $Uri -Method $Method -Headers $headers -Body $json
    }
    return Invoke-RestMethod -Uri $Uri -Method $Method -Headers $headers
}

function Get-Collection {
    param([Parameter(Mandatory = $true)][string]$Uri)
    try {
        $result = Invoke-JsonRequest -Method GET -Uri $Uri
        if ($null -eq $result) { return @() }
        if ($result -is [System.Array]) { return @($result) }
        if ($null -ne $result.items) { return @($result.items) }
        if ($null -ne $result.value) { return @($result.value) }
        return @($result)
    } catch {
        return @()
    }
}

$cities = @(
    "Ariana", "Beja", "Ben Arous", "Bizerte", "Gabes",
    "Gafsa", "Jendouba", "Kairouan", "Kasserine", "Kebili",
    "La Manouba", "Le Kef", "Mahdia", "Medenine", "Monastir",
    "Nabeul", "Sfax", "Sidi Bouzid", "Siliana", "Sousse", "Tunis", "Zaghouan"
)

$hotelPrefixes = @("The", "Royal", "Palace", "Grand", "Boutique", "Emerald", "Sapphire", "Golden", "Majestic", "Regency", "Marina", "Coastal", "Oasis", "Sahara", "Atlas", "Mediterranean", "Blue", "Pearl", "Azure")
$hotelSuffixes = @("Resort", "Spa", "Suites", "Hotel", "Lodge", "Gardens", "Palms", "Sands", "Horizon", "Prestige", "Plaza", "Inn")

$hotelImages = @(
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=80"
)

$roomImages = @(
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1578683010236-d716f9a3f98f?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1568495248636-6432b97bd949?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80"
)

Write-Host "--- Starting Premium Database Population ---"

# 1. Ensure Agency and Admin exist
Write-Host "Ensuring Agency and Admin exist..."
$agencies = Get-Collection -Uri "$baseUrl/agences-voyage"
if ($agencies.Count -eq 0) {
    $agencyPayload = @{
        email         = "admin@voyagehub.tn"
        motDePasse    = "Admin1234!"
        nomAgence     = "VoyageHub Central"
        siret         = "00000000000001"
        adresseAgence = "Tunis, Tunisia"
        actif         = $true
    }
    $agency = Invoke-JsonRequest -Method POST -Uri "$baseUrl/agences-voyage" -Body $agencyPayload
    Write-Host "  Created Agency: $($agency.nomAgence)"
} else {
    $agency = $agencies[0]
}

# Verify the admin account in the database (bypass email verification)
Write-Host "  Verifying admin account via SQL..."
$dbUrl = ""
$envFile = Join-Path $PSScriptRoot ".env"
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

# 2. Skip User Account creation as requested

# 3. Ensure Room Types exist
Write-Host "Ensuring Room Types exist..."
$roomTypes = Get-Collection -Uri "$baseUrl/types-chambre"
if ($roomTypes.Count -eq 0) {
    $types = @(
        @{ libelle = "Standard"; superficieM2 = 25; equipements = @("WiFi", "TV", "AC") },
        @{ libelle = "Deluxe";   superficieM2 = 35; equipements = @("WiFi", "TV", "Minibar", "AC") },
        @{ libelle = "Suite";    superficieM2 = 65; equipements = @("WiFi", "TV", "Minibar", "Jacuzzi", "AC", "Vue Mer") }
    )
    foreach ($t in $types) {
        Invoke-JsonRequest -Method POST -Uri "$baseUrl/types-chambre" -Body $t | Out-Null
    }
    $roomTypes = Get-Collection -Uri "$baseUrl/types-chambre"
}

# 4. Create Hotels (1 to 7 per city)
Write-Host "Creating Hotels (1-7 per city)..."
$allHotels = @()

foreach ($city in $cities) {
    $numHotels = Get-Random -Minimum 1 -Maximum 8
    Write-Host "  Processing $city ($numHotels hotels)..."
    
    for ($i = 1; $i -le $numHotels; $i++) {
        $prefix = $hotelPrefixes | Get-Random
        $suffix = $hotelSuffixes | Get-Random
        $hotelName = "$prefix $suffix $city"
        
        # Check if exists
        $existing = Get-Collection -Uri "$baseUrl/hotels" | Where-Object { $_.nom -eq $hotelName -and $_.ville -eq $city }
        if ($existing.Count -gt 0) {
            $allHotels += $existing[0]
            continue
        }
        
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
        
        $newHotel = Invoke-JsonRequest -Method POST -Uri "$baseUrl/hotels" -Body $hotelPayload
        $allHotels += $newHotel
        
        # Create 3-5 rooms for each hotel for better variety
        $roomCount = Get-Random -Minimum 3 -Maximum 6
        for ($r = 1; $r -le $roomCount; $r++) {
            $type = $roomTypes | Get-Random
            
            # Select unique room images + one hotel exterior
            $selectedRoomPhotos = $roomImages | Get-Random -Count 2
            $selectedHotelPhotos = $hotelImages | Get-Random -Count 1
            $allPhotos = @($selectedHotelPhotos) + @($selectedRoomPhotos)

            $roomPayload = @{
                numero        = "$($r)0$i"
                etage         = $r
                prixParNuit   = Get-Random -Minimum 120 -Maximum 850
                capacite      = Get-Random -Minimum 1 -Maximum 5
                disponible    = $true
                photos        = $allPhotos
                hotelId       = $newHotel.id
                typeChambreId = $type.id
            }
            Invoke-JsonRequest -Method POST -Uri "$baseUrl/chambres" -Body $roomPayload | Out-Null
        }
    }
}

# 5. Create 10 Offers for random hotels
Write-Host "Creating 10 Offers..."
$today = Get-Date
$selectedHotels = $allHotels | Get-Random -Count 10
foreach ($h in $selectedHotels) {
    $offerPayload = @{
        titre       = "Special Deal at $($h.nom)"
        description = "Get a special discount for your next stay in $($h.ville)!"
        tauxRemise  = Get-Random -Minimum 10 -Maximum 30
        dateDebut   = $today.ToString("o")
        dateFin     = $today.AddDays(30).ToString("o")
        active      = $true
        hotelId     = $h.id
        photo       = $hotelImages | Get-Random
    }
    Invoke-JsonRequest -Method POST -Uri "$baseUrl/offres" -Body $offerPayload | Out-Null
}

# 6. Skipping Reservations as requested

Write-Host "--- Database Population Complete ---"
Write-Host "Hotels created: $($allHotels.Count)"
Write-Host "Offers created: 10"

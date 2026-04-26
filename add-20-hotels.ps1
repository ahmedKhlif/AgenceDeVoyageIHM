param(
    [switch]$BackfillOnly
)

$headers = @{ "Content-Type" = "application/json" }
$baseUrl = "http://localhost:3001/api"

$cities = @(
    "Ariana",
    "Beja",
    "Ben Arous",
    "Bizerte",
    "Gabes",
    "Gafsa",
    "Jendouba",
    "Kairouan",
    "Kasserine",
    "Kebili",
    "La Manouba",
    "Le Kef",
    "Mahdia",
    "Medenine",
    "Monastir",
    "Nabeul",
    "Sfax",
    "Sidi Bouzid",
    "Siliana",
    "Sousse"
)

$adjectives = @(
    "Grand",
    "Royal",
    "Oasis",
    "Palace",
    "Resort",
    "Plaza",
    "Boutique",
    "Beach",
    "Sunset",
    "Golden",
    "Majestic",
    "Coral",
    "Pearl",
    "Azure",
    "Emerald",
    "Diamond",
    "Sapphire",
    "Crystal",
    "Imperial",
    "Mirage"
)

$roomPhotoSets = @(
    @(
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1505692952047-1a78307da8f2?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80"
    ),
    @(
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80"
    ),
    @(
        "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80&sat=-100"
    ),
    @(
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1468824357306-a439d58ccb1c?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&q=80"
    ),
    @(
        "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1578898887932-dce23a595ad4?auto=format&fit=crop&w=1200&q=80"
    ),
    @(
        "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1600566752227-8f3b547f8467?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=80"
    )
)

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

    return @(Invoke-JsonRequest -Method GET -Uri $Uri | ForEach-Object { $_ })
}

function Get-RoomPhotoSet {
    param([int]$GalleryIndex)

    return [string[]]$roomPhotoSets[$GalleryIndex % $roomPhotoSets.Count]
}

function Merge-PhotoSets {
    param(
        [string[]]$ExistingPhotos,
        [string[]]$NewPhotos
    )

    return @($ExistingPhotos + $NewPhotos | Where-Object { $_ } | Select-Object -Unique)
}

function New-RoomPayload {
    param(
        [int]$HotelId,
        [int]$TypeChambreId,
        [string]$Numero,
        [int]$Etage,
        [double]$PrixParNuit,
        [int]$Capacite,
        [string[]]$Photos
    )

    return @{
        numero = $Numero
        etage = $Etage
        prixParNuit = $PrixParNuit
        capacite = $Capacite
        disponible = $true
        photos = $Photos
        hotelId = $HotelId
        typeChambreId = $TypeChambreId
    }
}

function Ensure-HotelRoomsAndImages {
    param(
        [pscustomobject]$Hotel,
        [int[]]$TypeIds
    )

    $rooms = Get-Collection -Uri "$baseUrl/chambres?hotelId=$($Hotel.id)"

    if ($rooms.Count -eq 0) {
        Write-Host "Hotel $($Hotel.nom) has no rooms. Creating 2 rooms with galleries..."

        for ($roomIndex = 0; $roomIndex -lt 2; $roomIndex++) {
            $typeId = $TypeIds[$roomIndex % $TypeIds.Count]
            $photos = Get-RoomPhotoSet -GalleryIndex ($Hotel.id + $roomIndex)
            $payload = New-RoomPayload `
                -HotelId $Hotel.id `
                -TypeChambreId $typeId `
                -Numero ("{0}01" -f ($roomIndex + 1)) `
                -Etage ($roomIndex + 1) `
                -PrixParNuit (120 + ($roomIndex * 35)) `
                -Capacite (2 + $roomIndex) `
                -Photos $photos

            Invoke-JsonRequest -Method POST -Uri "$baseUrl/chambres" -Body $payload | Out-Null
        }

        $rooms = Get-Collection -Uri "$baseUrl/chambres?hotelId=$($Hotel.id)"
    }

    foreach ($room in $rooms) {
        $gallery = Get-RoomPhotoSet -GalleryIndex ($Hotel.id + $room.id)
        $mergedPhotos = Merge-PhotoSets -ExistingPhotos @($room.photos) -NewPhotos $gallery

        if ($mergedPhotos.Count -lt 4) {
            $mergedPhotos = $gallery
        }

        $updatePayload = @{
            numero = $room.numero
            etage = $room.etage
            prixParNuit = $room.prixParNuit
            capacite = $room.capacite
            disponible = $room.disponible
            photos = $mergedPhotos
            hotelId = $room.hotelId
            typeChambreId = $room.typeChambreId
        }

        Invoke-JsonRequest -Method PATCH -Uri "$baseUrl/chambres/$($room.id)" -Body $updatePayload | Out-Null
    }
}

try {
    $agencies = Get-Collection -Uri "$baseUrl/agences-voyage"
    $roomTypes = Get-Collection -Uri "$baseUrl/types-chambre"

    if ($agencies.Count -eq 0) {
        throw "No agences-voyage available. Seed agencies before running this script."
    }

    if ($roomTypes.Count -eq 0) {
        throw "No types-chambre available. Seed room types before running this script."
    }

    $agencyIds = @($agencies | ForEach-Object { $_.id })
    $typeIds = @($roomTypes | ForEach-Object { $_.id })

    if (-not $BackfillOnly) {
        Write-Host "Creating 20 new hotels with photo galleries..."

        for ($i = 0; $i -lt 20; $i++) {
            $city = $cities[$i]
            $hotelName = "Hotel $($adjectives[$i]) $city"
            $slug = (($hotelName -replace "[^a-zA-Z0-9]", "").ToLower())
            $agencyId = Get-Random -InputObject $agencyIds
            $hotelPayload = @{
                nom = $hotelName
                adresse = "Avenue Habib Bourguiba, $city"
                ville = $city
                pays = "Tunisia"
                etoiles = Get-Random -Minimum 3 -Maximum 6
                description = "Modern stay in $city with curated rooms, fast Wi-Fi, and a strong visual gallery."
                email = "contact-$slug@voyage-ihm.tn"
                telephone = "+216 {0:D8}" -f (Get-Random -Minimum 0 -Maximum 100000000)
                agenceVoyageId = $agencyId
                actif = $true
            }

            try {
                $hotel = Invoke-JsonRequest -Method POST -Uri "$baseUrl/hotels" -Body $hotelPayload
                Write-Host "Created Hotel: $($hotel.nom) (ID: $($hotel.id))"

                for ($roomIndex = 0; $roomIndex -lt 3; $roomIndex++) {
                    $typeId = $typeIds[$roomIndex % $typeIds.Count]
                    $photos = Get-RoomPhotoSet -GalleryIndex ($i + $roomIndex)
                    $roomPayload = New-RoomPayload `
                        -HotelId $hotel.id `
                        -TypeChambreId $typeId `
                        -Numero ("{0}01" -f ($roomIndex + 1)) `
                        -Etage ($roomIndex + 1) `
                        -PrixParNuit (Get-Random -Minimum 95 -Maximum 360) `
                        -Capacite $(if ($roomIndex -eq 2) { 4 } elseif ($roomIndex -eq 1) { 3 } else { 2 }) `
                        -Photos $photos

                    Invoke-JsonRequest -Method POST -Uri "$baseUrl/chambres" -Body $roomPayload | Out-Null
                }
            }
            catch {
                Write-Host "Failed to create hotel $hotelName : $($_.Exception.Message)"
            }
        }
    }

    Write-Host "Backfilling galleries for every hotel already in the database..."
    $allHotels = Get-Collection -Uri "$baseUrl/hotels"

    foreach ($hotel in $allHotels) {
        Ensure-HotelRoomsAndImages -Hotel $hotel -TypeIds $typeIds
    }

    $finalHotels = Get-Collection -Uri "$baseUrl/hotels"
    $finalRooms = Get-Collection -Uri "$baseUrl/chambres"
    $roomsWithPhotos = @($finalRooms | Where-Object { @($_.photos).Count -gt 0 }).Count

    Write-Host "Done."
    Write-Host "Hotels in database: $($finalHotels.Count)"
    Write-Host "Rooms in database: $($finalRooms.Count)"
    Write-Host "Rooms with photos: $roomsWithPhotos"
}
catch {
    Write-Error $_
    exit 1
}

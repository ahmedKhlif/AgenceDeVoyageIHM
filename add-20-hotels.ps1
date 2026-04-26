$headers = @{ "Content-Type" = "application/json" }

$cities = @("Ariana", "Béja", "Ben Arous", "Bizerte", "Gabès", "Gafsa", "Jendouba", "Kairouan", "Kasserine", "Kébili", "La Manouba", "Le Kef", "Mahdia", "Médenine", "Monastir", "Nabeul", "Sfax", "Sidi Bouzid", "Siliana", "Sousse")
$countries = @("Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia", "Tunisia")
$adjectives = @("Grand", "Royal", "Oasis", "Palace", "Resort", "Plaza", "Boutique", "Beach", "Sunset", "Golden", "Majestic", "Coral", "Pearl", "Azure", "Emerald", "Diamond", "Sapphire", "Crystal", "Imperial", "Mirage")

Write-Host "Creating 20 new hotels..."

for ($i = 0; $i -lt 20; $i++) {
    $city = $cities[$i]
    $country = "Tunisia"
    $adj = $adjectives[$i]
    $hotelName = "Hotel $adj $city"
    $stars = Get-Random -Minimum 3 -Maximum 6
    $agenceId = Get-Random -Minimum 1 -Maximum 4
    
    $body = '{"nom":"' + $hotelName + '","adresse":"Avenue Habib Bourguiba, ' + $city + '","ville":"' + $city + '","pays":"' + $country + '","etoiles":' + $stars + ',"email":"contact@' + ($hotelName -replace ' ','').ToLower() + '.tn","telephone":"+216 ' + (Get-Random -Minimum 70000000 -Maximum 99999999) + '","agenceVoyageId":' + $agenceId + ',"actif":true}'
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/hotels" -Method POST -Headers $headers -Body $body
        $hotelId = $response.id
        
        if ($hotelId) {
            Write-Host "Created Hotel: $hotelName (ID: $hotelId)"
            
            # Add 2 rooms for this hotel
            for ($r = 1; $r -le 2; $r++) {
                $prix = Get-Random -Minimum 80 -Maximum 350
                $roomBody = '{"numero":"' + $r + '01","etage":' + $r + ',"prixParNuit":' + $prix + ',"capacite":2,"disponible":true,"hotelId":' + $hotelId + ',"typeChambreId":1}'
                Invoke-RestMethod -Uri "http://localhost:3001/api/chambres" -Method POST -Headers $headers -Body $roomBody | Out-Null
            }
        }
    } catch {
        Write-Host "Failed to create hotel $hotelName : $_"
    }
}

Write-Host "Done adding 20 hotels and their rooms."

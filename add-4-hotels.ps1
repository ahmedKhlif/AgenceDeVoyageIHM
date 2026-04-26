$headers = @{ "Content-Type" = "application/json" }
$extras = @("Tunis2", "Hammamet2", "Sousse2", "Djerba2")
for ($i = 0; $i -lt 4; $i++) {
    $city = $extras[$i]
    $hotelName = "Hotel Extra $city"
    $stars = 4
    $agenceId = 1
    
    $body = '{"nom":"' + $hotelName + '","adresse":"Avenue 1, ' + $city + '","ville":"' + $city + '","pays":"Tunisia","etoiles":' + $stars + ',"email":"contact@' + ($hotelName -replace ' ','').ToLower() + '.tn","telephone":"+216 ' + (Get-Random -Minimum 70000000 -Maximum 99999999) + '","agenceVoyageId":' + $agenceId + ',"actif":true}'
    
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/hotels" -Method POST -Headers $headers -Body $body
    $hotelId = $response.id
    
    if ($hotelId) {
        Write-Host "Created Hotel: $hotelName (ID: $hotelId)"
        for ($r = 1; $r -le 2; $r++) {
            $prix = 150
            $roomBody = '{"numero":"' + $r + '01","etage":' + $r + ',"prixParNuit":' + $prix + ',"capacite":2,"disponible":true,"hotelId":' + $hotelId + ',"typeChambreId":1}'
            Invoke-RestMethod -Uri "http://localhost:3001/api/chambres" -Method POST -Headers $headers -Body $roomBody | Out-Null
        }
    }
}

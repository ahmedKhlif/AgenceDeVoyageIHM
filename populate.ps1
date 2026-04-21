# PowerShell script to populate the database with test data

$headers = @{ "Content-Type" = "application/json" }

# Create more agences
Invoke-WebRequest -Uri "http://localhost:3001/api/agences-voyage" -Method POST -Headers $headers -Body '{"email":"agence2@example.com","motDePasse":"agence123","nomAgence":"Travel Co","siret":"222222222","adresseAgence":"Address 3","actif":true}'
Invoke-WebRequest -Uri "http://localhost:3001/api/agences-voyage" -Method POST -Headers $headers -Body '{"email":"agence3@example.com","motDePasse":"agence123","nomAgence":"Holiday Inc","siret":"333333333","adresseAgence":"Address 4","actif":true}'

# Create 10 hotels
Invoke-WebRequest -Uri "http://localhost:3001/api/hotels" -Method POST -Headers $headers -Body '{"nom":"Hotel B","adresse":"Address 5","ville":"Rome","pays":"Italy","etoiles":4,"email":"hotelb@example.com","telephone":"333333333","agenceVoyageId":1,"actif":true}'
Invoke-WebRequest -Uri "http://localhost:3001/api/hotels" -Method POST -Headers $headers -Body '{"nom":"Hotel C","adresse":"Address 6","ville":"Barcelona","pays":"Spain","etoiles":3,"email":"hotelc@example.com","telephone":"444444444","agenceVoyageId":2,"actif":true}'
Invoke-WebRequest -Uri "http://localhost:3001/api/hotels" -Method POST -Headers $headers -Body '{"nom":"Hotel D","adresse":"Address 7","ville":"Paris","pays":"France","etoiles":5,"email":"hoteld@example.com","telephone":"555555555","agenceVoyageId":1,"actif":true}'
Invoke-WebRequest -Uri "http://localhost:3001/api/hotels" -Method POST -Headers $headers -Body '{"nom":"Hotel E","adresse":"Address 8","ville":"London","pays":"UK","etoiles":4,"email":"hotele@example.com","telephone":"666666666","agenceVoyageId":2,"actif":true}'
Invoke-WebRequest -Uri "http://localhost:3001/api/hotels" -Method POST -Headers $headers -Body '{"nom":"Hotel F","adresse":"Address 9","ville":"Berlin","pays":"Germany","etoiles":3,"email":"hotelf@example.com","telephone":"777777777","agenceVoyageId":3,"actif":true}'
Invoke-WebRequest -Uri "http://localhost:3001/api/hotels" -Method POST -Headers $headers -Body '{"nom":"Hotel G","adresse":"Address 10","ville":"Amsterdam","pays":"Netherlands","etoiles":4,"email":"hotelg@example.com","telephone":"888888888","agenceVoyageId":1,"actif":true}'
Invoke-WebRequest -Uri "http://localhost:3001/api/hotels" -Method POST -Headers $headers -Body '{"nom":"Hotel H","adresse":"Address 11","ville":"Vienna","pays":"Austria","etoiles":5,"email":"hotelh@example.com","telephone":"999999999","agenceVoyageId":2,"actif":true}'
Invoke-WebRequest -Uri "http://localhost:3001/api/hotels" -Method POST -Headers $headers -Body '{"nom":"Hotel I","adresse":"Address 12","ville":"Prague","pays":"Czech","etoiles":3,"email":"hoteli@example.com","telephone":"101010101","agenceVoyageId":3,"actif":true}'
Invoke-WebRequest -Uri "http://localhost:3001/api/hotels" -Method POST -Headers $headers -Body '{"nom":"Hotel J","adresse":"Address 13","ville":"Budapest","pays":"Hungary","etoiles":4,"email":"hotelj@example.com","telephone":"111111112","agenceVoyageId":1,"actif":true}'
Invoke-WebRequest -Uri "http://localhost:3001/api/hotels" -Method POST -Headers $headers -Body '{"nom":"Hotel K","adresse":"Address 14","ville":"Warsaw","pays":"Poland","etoiles":3,"email":"hotelk@example.com","telephone":"121212121","agenceVoyageId":2,"actif":true}'

# Create more types-chambre
Invoke-WebRequest -Uri "http://localhost:3001/api/types-chambre" -Method POST -Headers $headers -Body '{"libelle":"Suite","superficieM2":50,"equipements":["WiFi","TV","Balcony"]}'
Invoke-WebRequest -Uri "http://localhost:3001/api/types-chambre" -Method POST -Headers $headers -Body '{"libelle":"Deluxe","superficieM2":40,"equipements":["WiFi","TV"]}'

# Create multiple chambres
for ($i = 2; $i -le 20; $i++) {
    $hotelId = ($i % 10) + 1
    $typeId = ($i % 2) + 1
    $numero = "10$i"
    $etage = [math]::Floor($i / 5) + 1
    $prix = 100 + ($i * 10)
    $body = '{"numero":"' + $numero + '","etage":' + $etage + ',"prixParNuit":' + $prix + ',"capacite":2,"disponible":true,"hotelId":' + $hotelId + ',"typeChambreId":' + $typeId + '}'
    Invoke-WebRequest -Uri "http://localhost:3001/api/chambres" -Method POST -Headers $headers -Body $body
}

# Create 5 offres
Invoke-WebRequest -Uri "http://localhost:3001/api/offres" -Method POST -Headers $headers -Body '{"titre":"Winter Discount","tauxRemise":15,"dateDebut":"2026-12-01T00:00:00.000Z","dateFin":"2026-12-31T23:59:59.000Z","active":true,"hotelId":1}'
Invoke-WebRequest -Uri "http://localhost:3001/api/offres" -Method POST -Headers $headers -Body '{"titre":"Summer Sale","tauxRemise":20,"dateDebut":"2026-06-01T00:00:00.000Z","dateFin":"2026-08-31T23:59:59.000Z","active":true,"hotelId":2}'
Invoke-WebRequest -Uri "http://localhost:3001/api/offres" -Method POST -Headers $headers -Body '{"titre":"Spring Promo","tauxRemise":10,"dateDebut":"2026-03-01T00:00:00.000Z","dateFin":"2026-05-31T23:59:59.000Z","active":true,"hotelId":3}'
Invoke-WebRequest -Uri "http://localhost:3001/api/offres" -Method POST -Headers $headers -Body '{"titre":"Autumn Deal","tauxRemise":12,"dateDebut":"2026-09-01T00:00:00.000Z","dateFin":"2026-11-30T23:59:59.000Z","active":true,"hotelId":4}'
Invoke-WebRequest -Uri "http://localhost:3001/api/offres" -Method POST -Headers $headers -Body '{"titre":"Year End Special","tauxRemise":25,"dateDebut":"2026-11-01T00:00:00.000Z","dateFin":"2026-12-31T23:59:59.000Z","active":true,"hotelId":5}'

# Create more reservations
Invoke-WebRequest -Uri "http://localhost:3001/api/reservations" -Method POST -Headers $headers -Body '{"accountId":1,"chambreId":2,"dateArrivee":"2026-07-01T14:00:00.000Z","dateDepart":"2026-07-03T10:00:00.000Z","nombrePersonnes":2,"nombreNuits":2,"montantTotal":250,"codeConfirmation":"CONF125","statut":"CONFIRMEE"}'
Invoke-WebRequest -Uri "http://localhost:3001/api/reservations" -Method POST -Headers $headers -Body '{"accountId":2,"chambreId":3,"dateArrivee":"2026-08-01T14:00:00.000Z","dateDepart":"2026-08-05T10:00:00.000Z","nombrePersonnes":4,"nombreNuits":4,"montantTotal":800,"codeConfirmation":"CONF126","statut":"EN_ATTENTE"}'

# Create avis (assuming reservationId is required, but since we don't have correct DTO, skip or fix)
# Need to check DTO for avis

# Create system-config
Invoke-WebRequest -Uri "http://localhost:3001/api/system-config" -Method POST -Headers $headers -Body '{"cle":"max_reservations","valeur":"10"}'
Invoke-WebRequest -Uri "http://localhost:3001/api/system-config" -Method POST -Headers $headers -Body '{"cle":"default_currency","valeur":"EUR"}'
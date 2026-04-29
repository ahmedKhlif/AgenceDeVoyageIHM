$baseUrl = "https://agencedevoyageihm-production.up.railway.app/api"
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

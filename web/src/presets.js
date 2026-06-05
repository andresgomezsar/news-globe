export const TOPICS = [
  { id: "technology", label: "Technology", emoji: "🤖" },
  { id: "markets", label: "Markets", emoji: "📈" },
  { id: "politics", label: "Politics", emoji: "🏛️" },
  { id: "law", label: "Law", emoji: "⚖️" },
  { id: "world", label: "World", emoji: "🌍" },
  { id: "science", label: "Science", emoji: "🔬" },
  { id: "health", label: "Health", emoji: "🧬" },
  { id: "sports", label: "Sports", emoji: "🏆" },
  { id: "entertainment", label: "Culture", emoji: "🎬" },
  { id: "climate", label: "Climate", emoji: "🌱" },
];

export const TONES = [
  { id: "sharp and energetic", label: "Energetic anchor" },
  { id: "calm, measured, NPR-style", label: "Calm & measured" },
  { id: "punchy and fast, late-night style", label: "Punchy & fast" },
  { id: "warm and conversational", label: "Warm & casual" },
  { id: "dramatic, cinematic narrator", label: "Cinematic" },
];

// Major world cities across the biggest ~50 countries + key news/finance hubs.
export const MAJOR_CITIES = [
  { name: "Beijing", country: "China", lat: 39.9, lng: 116.41 },
  { name: "Shanghai", country: "China", lat: 31.23, lng: 121.47 },
  { name: "Hong Kong", country: "Hong Kong", lat: 22.32, lng: 114.17 },
  { name: "New Delhi", country: "India", lat: 28.61, lng: 77.21 },
  { name: "Mumbai", country: "India", lat: 19.08, lng: 72.88 },
  { name: "New York", country: "USA", lat: 40.71, lng: -74.01 },
  { name: "Los Angeles", country: "USA", lat: 34.05, lng: -118.24 },
  { name: "Chicago", country: "USA", lat: 41.88, lng: -87.63 },
  { name: "Washington, D.C.", country: "USA", lat: 38.91, lng: -77.04 },
  { name: "Jakarta", country: "Indonesia", lat: -6.21, lng: 106.85 },
  { name: "Karachi", country: "Pakistan", lat: 24.86, lng: 67.01 },
  { name: "Islamabad", country: "Pakistan", lat: 33.68, lng: 73.05 },
  { name: "São Paulo", country: "Brazil", lat: -23.55, lng: -46.63 },
  { name: "Rio de Janeiro", country: "Brazil", lat: -22.91, lng: -43.17 },
  { name: "Brasília", country: "Brazil", lat: -15.79, lng: -47.88 },
  { name: "Lagos", country: "Nigeria", lat: 6.52, lng: 3.38 },
  { name: "Abuja", country: "Nigeria", lat: 9.06, lng: 7.5 },
  { name: "Dhaka", country: "Bangladesh", lat: 23.81, lng: 90.41 },
  { name: "Moscow", country: "Russia", lat: 55.76, lng: 37.62 },
  { name: "Saint Petersburg", country: "Russia", lat: 59.93, lng: 30.34 },
  { name: "Mexico City", country: "Mexico", lat: 19.43, lng: -99.13 },
  { name: "Tokyo", country: "Japan", lat: 35.68, lng: 139.69 },
  { name: "Osaka", country: "Japan", lat: 34.69, lng: 135.5 },
  { name: "Addis Ababa", country: "Ethiopia", lat: 9.03, lng: 38.74 },
  { name: "Manila", country: "Philippines", lat: 14.6, lng: 120.98 },
  { name: "Cairo", country: "Egypt", lat: 30.04, lng: 31.24 },
  { name: "Kinshasa", country: "DR Congo", lat: -4.44, lng: 15.27 },
  { name: "Hanoi", country: "Vietnam", lat: 21.03, lng: 105.85 },
  { name: "Ho Chi Minh City", country: "Vietnam", lat: 10.82, lng: 106.63 },
  { name: "Tehran", country: "Iran", lat: 35.69, lng: 51.39 },
  { name: "Istanbul", country: "Turkey", lat: 41.01, lng: 28.98 },
  { name: "Ankara", country: "Turkey", lat: 39.93, lng: 32.86 },
  { name: "Berlin", country: "Germany", lat: 52.52, lng: 13.4 },
  { name: "Munich", country: "Germany", lat: 48.14, lng: 11.58 },
  { name: "Bangkok", country: "Thailand", lat: 13.76, lng: 100.5 },
  { name: "London", country: "UK", lat: 51.51, lng: -0.13 },
  { name: "Manchester", country: "UK", lat: 53.48, lng: -2.24 },
  { name: "Paris", country: "France", lat: 48.86, lng: 2.35 },
  { name: "Rome", country: "Italy", lat: 41.9, lng: 12.5 },
  { name: "Milan", country: "Italy", lat: 45.46, lng: 9.19 },
  { name: "Johannesburg", country: "South Africa", lat: -26.2, lng: 28.05 },
  { name: "Cape Town", country: "South Africa", lat: -33.92, lng: 18.42 },
  { name: "Dar es Salaam", country: "Tanzania", lat: -6.79, lng: 39.21 },
  { name: "Yangon", country: "Myanmar", lat: 16.87, lng: 96.2 },
  { name: "Nairobi", country: "Kenya", lat: -1.29, lng: 36.82 },
  { name: "Seoul", country: "South Korea", lat: 37.57, lng: 126.98 },
  { name: "Bogotá", country: "Colombia", lat: 4.71, lng: -74.07 },
  { name: "Madrid", country: "Spain", lat: 40.42, lng: -3.7 },
  { name: "Barcelona", country: "Spain", lat: 41.39, lng: 2.17 },
  { name: "Buenos Aires", country: "Argentina", lat: -34.6, lng: -58.38 },
  { name: "Algiers", country: "Algeria", lat: 36.75, lng: 3.06 },
  { name: "Khartoum", country: "Sudan", lat: 15.5, lng: 32.56 },
  { name: "Kyiv", country: "Ukraine", lat: 50.45, lng: 30.52 },
  { name: "Baghdad", country: "Iraq", lat: 33.31, lng: 44.36 },
  { name: "Kabul", country: "Afghanistan", lat: 34.56, lng: 69.21 },
  { name: "Warsaw", country: "Poland", lat: 52.23, lng: 21.01 },
  { name: "Toronto", country: "Canada", lat: 43.65, lng: -79.38 },
  { name: "Vancouver", country: "Canada", lat: 49.28, lng: -123.12 },
  { name: "Casablanca", country: "Morocco", lat: 33.57, lng: -7.59 },
  { name: "Riyadh", country: "Saudi Arabia", lat: 24.71, lng: 46.68 },
  { name: "Jeddah", country: "Saudi Arabia", lat: 21.49, lng: 39.19 },
  { name: "Tashkent", country: "Uzbekistan", lat: 41.3, lng: 69.24 },
  { name: "Lima", country: "Peru", lat: -12.05, lng: -77.04 },
  { name: "Kuala Lumpur", country: "Malaysia", lat: 3.14, lng: 101.69 },
  { name: "Luanda", country: "Angola", lat: -8.84, lng: 13.23 },
  { name: "Accra", country: "Ghana", lat: 5.6, lng: -0.19 },
  { name: "Maputo", country: "Mozambique", lat: -25.97, lng: 32.57 },
  { name: "Sana'a", country: "Yemen", lat: 15.37, lng: 44.19 },
  { name: "Kathmandu", country: "Nepal", lat: 27.72, lng: 85.32 },
  { name: "Caracas", country: "Venezuela", lat: 10.48, lng: -66.9 },
  { name: "Sydney", country: "Australia", lat: -33.87, lng: 151.21 },
  { name: "Melbourne", country: "Australia", lat: -37.81, lng: 144.96 },
  { name: "Taipei", country: "Taiwan", lat: 25.03, lng: 121.57 },
  { name: "Amsterdam", country: "Netherlands", lat: 52.37, lng: 4.9 },
  { name: "Dubai", country: "UAE", lat: 25.2, lng: 55.27 },
  { name: "Abu Dhabi", country: "UAE", lat: 24.45, lng: 54.38 },
  { name: "Singapore", country: "Singapore", lat: 1.35, lng: 103.82 },
  { name: "Zurich", country: "Switzerland", lat: 47.38, lng: 8.54 },
  { name: "Stockholm", country: "Sweden", lat: 59.33, lng: 18.07 },
  { name: "Athens", country: "Greece", lat: 37.98, lng: 23.73 },
  { name: "Lisbon", country: "Portugal", lat: 38.72, lng: -9.14 },
  { name: "Brussels", country: "Belgium", lat: 50.85, lng: 4.35 },
  { name: "Vienna", country: "Austria", lat: 48.21, lng: 16.37 },
  { name: "Tel Aviv", country: "Israel", lat: 32.08, lng: 34.78 },
  { name: "Jerusalem", country: "Israel", lat: 31.78, lng: 35.22 },
  { name: "Santiago", country: "Chile", lat: -33.45, lng: -70.67 },
  { name: "Havana", country: "Cuba", lat: 23.11, lng: -82.37 },
  { name: "Oslo", country: "Norway", lat: 59.91, lng: 10.75 },
  { name: "Dublin", country: "Ireland", lat: 53.35, lng: -6.26 },
  { name: "Auckland", country: "New Zealand", lat: -36.85, lng: 174.76 },
  { name: "Doha", country: "Qatar", lat: 25.29, lng: 51.53 },
  // More USA
  { name: "San Francisco", country: "USA", lat: 37.77, lng: -122.42 },
  { name: "Miami", country: "USA", lat: 25.76, lng: -80.19 },
  { name: "Houston", country: "USA", lat: 29.76, lng: -95.37 },
  { name: "Boston", country: "USA", lat: 42.36, lng: -71.06 },
  { name: "Seattle", country: "USA", lat: 47.61, lng: -122.33 },
  { name: "Atlanta", country: "USA", lat: 33.75, lng: -84.39 },
  // More Canada
  { name: "Montreal", country: "Canada", lat: 45.5, lng: -73.57 },
  { name: "Calgary", country: "Canada", lat: 51.05, lng: -114.07 },
  { name: "Ottawa", country: "Canada", lat: 45.42, lng: -75.7 },
  // Latin America
  { name: "Barranquilla", country: "Colombia", lat: 10.96, lng: -74.8 },
  { name: "Medellín", country: "Colombia", lat: 6.24, lng: -75.57 },
  { name: "Cali", country: "Colombia", lat: 3.44, lng: -76.52 },
  { name: "Guadalajara", country: "Mexico", lat: 20.67, lng: -103.35 },
  { name: "Monterrey", country: "Mexico", lat: 25.69, lng: -100.32 },
  { name: "Quito", country: "Ecuador", lat: -0.18, lng: -78.47 },
  { name: "Guayaquil", country: "Ecuador", lat: -2.17, lng: -79.92 },
  { name: "Montevideo", country: "Uruguay", lat: -34.9, lng: -56.16 },
  { name: "Panama City", country: "Panama", lat: 8.98, lng: -79.52 },
  { name: "San José", country: "Costa Rica", lat: 9.93, lng: -84.08 },
  { name: "Santo Domingo", country: "Dominican Republic", lat: 18.49, lng: -69.93 },
  { name: "Guatemala City", country: "Guatemala", lat: 14.63, lng: -90.51 },
  { name: "San Juan", country: "Puerto Rico", lat: 18.47, lng: -66.11 },
];

// A small, recognizable set for one-tap quick chips.
export const QUICK_CITIES = [
  "Tokyo", "New York", "London", "Paris", "Dubai", "São Paulo", "Singapore", "Nairobi",
].map((n) => MAJOR_CITIES.find((c) => c.name === n)).filter(Boolean);

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Nearest major city to a lat/lng, with its distance in km. */
export function nearestCity(lat, lng) {
  let best = null;
  let bestKm = Infinity;
  for (const c of MAJOR_CITIES) {
    const km = haversineKm({ lat, lng }, c);
    if (km < bestKm) {
      bestKm = km;
      best = c;
    }
  }
  return { city: best, km: bestKm };
}

/** Local matches against the curated list, by city OR country name. */
export function searchLocalCities(query, limit = 6) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = [];
  const contains = [];
  for (const c of MAJOR_CITIES) {
    const name = c.name.toLowerCase();
    const country = c.country.toLowerCase();
    if (name.startsWith(q) || country.startsWith(q)) starts.push(c);
    else if (name.includes(q) || country.includes(q)) contains.push(c);
  }
  return [...starts, ...contains].slice(0, limit);
}

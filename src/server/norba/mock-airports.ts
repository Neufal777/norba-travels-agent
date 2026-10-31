/**
 * The mock's small airport catalogue: the busiest points a demo is likely to ask for, with what the mock needs to
 * make believable flights (position and the standard UTC offset). The live client searches Norba's full catalogue.
 */
export type MockAirport = {
  iata: string;
  name: string;
  city: string;
  country: string;
  metro?: string;
  lat: number;
  lon: number;
  /** Standard UTC offset in hours. */
  tz: number;
  /** City and common alternative names, lower-case, without accents. */
  aka?: string[];
};

export const MOCK_AIRPORTS: MockAirport[] = [
  { iata: "MAD", name: "Adolfo Suárez Madrid-Barajas", city: "Madrid", country: "ES", lat: 40.47, lon: -3.56, tz: 1 },
  { iata: "BCN", name: "Josep Tarradellas Barcelona-El Prat", city: "Barcelona", country: "ES", lat: 41.3, lon: 2.08, tz: 1 },
  { iata: "AGP", name: "Málaga-Costa del Sol", city: "Málaga", country: "ES", lat: 36.67, lon: -4.5, tz: 1, aka: ["malaga"] },
  { iata: "PMI", name: "Palma de Mallorca", city: "Palma", country: "ES", lat: 39.55, lon: 2.74, tz: 1, aka: ["mallorca", "majorca"] },
  { iata: "SVQ", name: "Sevilla", city: "Seville", country: "ES", lat: 37.42, lon: -5.9, tz: 1, aka: ["sevilla"] },
  { iata: "VLC", name: "Valencia", city: "Valencia", country: "ES", lat: 39.49, lon: -0.48, tz: 1 },
  { iata: "LIS", name: "Humberto Delgado", city: "Lisbon", country: "PT", lat: 38.77, lon: -9.13, tz: 0, aka: ["lisboa"] },
  { iata: "OPO", name: "Francisco Sá Carneiro", city: "Porto", country: "PT", lat: 41.24, lon: -8.68, tz: 0, aka: ["oporto"] },
  { iata: "LHR", name: "Heathrow", city: "London", country: "GB", metro: "LON", lat: 51.47, lon: -0.45, tz: 0, aka: ["londres"] },
  { iata: "LGW", name: "Gatwick", city: "London", country: "GB", metro: "LON", lat: 51.15, lon: -0.18, tz: 0, aka: ["londres"] },
  { iata: "STN", name: "Stansted", city: "London", country: "GB", metro: "LON", lat: 51.88, lon: 0.24, tz: 0, aka: ["londres"] },
  { iata: "MAN", name: "Manchester", city: "Manchester", country: "GB", lat: 53.35, lon: -2.27, tz: 0 },
  { iata: "DUB", name: "Dublin", city: "Dublin", country: "IE", lat: 53.42, lon: -6.27, tz: 0, aka: ["dublin"] },
  { iata: "CDG", name: "Charles de Gaulle", city: "Paris", country: "FR", metro: "PAR", lat: 49.01, lon: 2.55, tz: 1, aka: ["paris"] },
  { iata: "ORY", name: "Orly", city: "Paris", country: "FR", metro: "PAR", lat: 48.72, lon: 2.36, tz: 1, aka: ["paris"] },
  { iata: "NCE", name: "Nice Côte d'Azur", city: "Nice", country: "FR", lat: 43.66, lon: 7.22, tz: 1, aka: ["niza"] },
  { iata: "AMS", name: "Schiphol", city: "Amsterdam", country: "NL", lat: 52.31, lon: 4.76, tz: 1 },
  { iata: "BRU", name: "Brussels", city: "Brussels", country: "BE", lat: 50.9, lon: 4.48, tz: 1, aka: ["bruselas"] },
  { iata: "FRA", name: "Frankfurt", city: "Frankfurt", country: "DE", lat: 50.04, lon: 8.56, tz: 1, aka: ["frankfurt"] },
  { iata: "MUC", name: "Munich", city: "Munich", country: "DE", lat: 48.35, lon: 11.79, tz: 1, aka: ["munich", "munchen"] },
  { iata: "BER", name: "Berlin Brandenburg", city: "Berlin", country: "DE", lat: 52.37, lon: 13.5, tz: 1 },
  { iata: "ZRH", name: "Zurich", city: "Zurich", country: "CH", lat: 47.46, lon: 8.55, tz: 1, aka: ["zurich"] },
  { iata: "GVA", name: "Geneva", city: "Geneva", country: "CH", lat: 46.24, lon: 6.11, tz: 1, aka: ["ginebra"] },
  { iata: "VIE", name: "Vienna", city: "Vienna", country: "AT", lat: 48.11, lon: 16.57, tz: 1, aka: ["viena"] },
  { iata: "FCO", name: "Fiumicino", city: "Rome", country: "IT", metro: "ROM", lat: 41.8, lon: 12.25, tz: 1, aka: ["roma"] },
  { iata: "MXP", name: "Malpensa", city: "Milan", country: "IT", metro: "MIL", lat: 45.63, lon: 8.72, tz: 1, aka: ["milan", "milano"] },
  { iata: "VCE", name: "Marco Polo", city: "Venice", country: "IT", lat: 45.5, lon: 12.35, tz: 1, aka: ["venecia", "venezia"] },
  { iata: "ATH", name: "Athens International", city: "Athens", country: "GR", lat: 37.94, lon: 23.94, tz: 2, aka: ["atenas"] },
  { iata: "SKG", name: "Thessaloniki", city: "Thessaloniki", country: "GR", lat: 40.52, lon: 22.97, tz: 2, aka: ["tesalonica"] },
  { iata: "HER", name: "Heraklion", city: "Heraklion", country: "GR", lat: 35.34, lon: 25.18, tz: 2, aka: ["creta", "crete"] },
  { iata: "JTR", name: "Santorini", city: "Santorini", country: "GR", lat: 36.4, lon: 25.48, tz: 2, aka: ["thira"] },
  { iata: "JMK", name: "Mykonos", city: "Mykonos", country: "GR", lat: 37.44, lon: 25.35, tz: 2, aka: ["miconos"] },
  { iata: "RHO", name: "Diagoras", city: "Rhodes", country: "GR", lat: 36.41, lon: 28.09, tz: 2, aka: ["rodas"] },
  { iata: "CFU", name: "Ioannis Kapodistrias", city: "Corfu", country: "GR", lat: 39.6, lon: 19.91, tz: 2, aka: ["corfu"] },
  { iata: "LCA", name: "Larnaca", city: "Larnaca", country: "CY", lat: 34.88, lon: 33.63, tz: 2, aka: ["chipre", "cyprus"] },
  { iata: "IST", name: "Istanbul", city: "Istanbul", country: "TR", lat: 41.26, lon: 28.74, tz: 3, aka: ["estambul"] },
  { iata: "TLV", name: "Ben Gurion", city: "Tel Aviv", country: "IL", lat: 32.01, lon: 34.89, tz: 2 },
  { iata: "CAI", name: "Cairo International", city: "Cairo", country: "EG", lat: 30.12, lon: 31.41, tz: 2, aka: ["el cairo"] },
  { iata: "DXB", name: "Dubai International", city: "Dubai", country: "AE", lat: 25.25, lon: 55.36, tz: 4 },
  { iata: "RAK", name: "Menara", city: "Marrakesh", country: "MA", lat: 31.61, lon: -8.04, tz: 1, aka: ["marrakech"] },
  { iata: "CMN", name: "Mohammed V", city: "Casablanca", country: "MA", lat: 33.37, lon: -7.59, tz: 1 },
  { iata: "JFK", name: "John F. Kennedy", city: "New York", country: "US", metro: "NYC", lat: 40.64, lon: -73.78, tz: -5, aka: ["nueva york", "nyc"] },
  { iata: "EWR", name: "Newark Liberty", city: "New York", country: "US", metro: "NYC", lat: 40.69, lon: -74.17, tz: -5, aka: ["nueva york", "newark"] },
  { iata: "LGA", name: "LaGuardia", city: "New York", country: "US", metro: "NYC", lat: 40.78, lon: -73.87, tz: -5, aka: ["nueva york"] },
  { iata: "BOS", name: "Logan", city: "Boston", country: "US", lat: 42.36, lon: -71.01, tz: -5 },
  { iata: "PHL", name: "Philadelphia", city: "Philadelphia", country: "US", lat: 39.87, lon: -75.24, tz: -5, aka: ["filadelfia"] },
  { iata: "DCA", name: "Reagan National", city: "Washington", country: "US", metro: "WAS", lat: 38.85, lon: -77.04, tz: -5 },
  { iata: "CLT", name: "Charlotte Douglas", city: "Charlotte", country: "US", lat: 35.21, lon: -80.94, tz: -5 },
  { iata: "MIA", name: "Miami International", city: "Miami", country: "US", lat: 25.79, lon: -80.29, tz: -5 },
  { iata: "MCO", name: "Orlando International", city: "Orlando", country: "US", lat: 28.43, lon: -81.31, tz: -5 },
  { iata: "ORD", name: "O'Hare", city: "Chicago", country: "US", metro: "CHI", lat: 41.98, lon: -87.9, tz: -6 },
  { iata: "DFW", name: "Dallas/Fort Worth", city: "Dallas", country: "US", lat: 32.9, lon: -97.04, tz: -6 },
  { iata: "AUS", name: "Austin-Bergstrom", city: "Austin", country: "US", lat: 30.19, lon: -97.67, tz: -6 },
  { iata: "DEN", name: "Denver International", city: "Denver", country: "US", lat: 39.86, lon: -104.67, tz: -7 },
  { iata: "PHX", name: "Sky Harbor", city: "Phoenix", country: "US", lat: 33.43, lon: -112.01, tz: -7 },
  { iata: "LAX", name: "Los Angeles International", city: "Los Angeles", country: "US", lat: 33.94, lon: -118.41, tz: -8, aka: ["los angeles", "la"] },
  { iata: "SFO", name: "San Francisco International", city: "San Francisco", country: "US", lat: 37.62, lon: -122.38, tz: -8 },
  { iata: "SEA", name: "Seattle-Tacoma", city: "Seattle", country: "US", lat: 47.45, lon: -122.31, tz: -8 },
  { iata: "LAS", name: "Harry Reid", city: "Las Vegas", country: "US", lat: 36.08, lon: -115.15, tz: -8 },
  { iata: "HNL", name: "Daniel K. Inouye", city: "Honolulu", country: "US", lat: 21.32, lon: -157.92, tz: -10, aka: ["hawaii"] },
  { iata: "YYZ", name: "Pearson", city: "Toronto", country: "CA", lat: 43.68, lon: -79.63, tz: -5 },
  { iata: "MEX", name: "Benito Juárez", city: "Mexico City", country: "MX", lat: 19.44, lon: -99.07, tz: -6, aka: ["ciudad de mexico", "cdmx", "mexico"] },
  { iata: "CUN", name: "Cancún", city: "Cancún", country: "MX", lat: 21.04, lon: -86.88, tz: -5, aka: ["cancun"] },
  { iata: "BOG", name: "El Dorado", city: "Bogotá", country: "CO", lat: 4.7, lon: -74.15, tz: -5, aka: ["bogota"] },
  { iata: "LIM", name: "Jorge Chávez", city: "Lima", country: "PE", lat: -12.02, lon: -77.11, tz: -5 },
  { iata: "GRU", name: "Guarulhos", city: "São Paulo", country: "BR", lat: -23.43, lon: -46.47, tz: -3, aka: ["sao paulo"] },
  { iata: "EZE", name: "Ezeiza", city: "Buenos Aires", country: "AR", lat: -34.82, lon: -58.54, tz: -3 },
  { iata: "SCL", name: "Arturo Merino Benítez", city: "Santiago", country: "CL", lat: -33.39, lon: -70.79, tz: -3, aka: ["santiago de chile"] },
  { iata: "NRT", name: "Narita", city: "Tokyo", country: "JP", metro: "TYO", lat: 35.77, lon: 140.39, tz: 9, aka: ["tokio"] },
  { iata: "HND", name: "Haneda", city: "Tokyo", country: "JP", metro: "TYO", lat: 35.55, lon: 139.78, tz: 9, aka: ["tokio"] },
  { iata: "SIN", name: "Changi", city: "Singapore", country: "SG", lat: 1.36, lon: 103.99, tz: 8, aka: ["singapur"] },
  { iata: "BKK", name: "Suvarnabhumi", city: "Bangkok", country: "TH", lat: 13.69, lon: 100.75, tz: 7 },
  { iata: "SYD", name: "Kingsford Smith", city: "Sydney", country: "AU", lat: -33.95, lon: 151.18, tz: 10, aka: ["sidney"] },
];

/** Metro codes the mock answers to, as Norba's catalogue does (LON, NYC…). */
export const MOCK_METROS: Record<string, string> = {
  LON: "London (all airports)",
  NYC: "New York (all airports)",
  PAR: "Paris (all airports)",
  TYO: "Tokyo (all airports)",
  ROM: "Rome (all airports)",
  MIL: "Milan (all airports)",
  CHI: "Chicago (all airports)",
  WAS: "Washington (all airports)",
};

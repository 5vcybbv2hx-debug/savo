/**
 * fetchWeatherData — Holt historische + heutige Wetterdaten von Open-Meteo
 * und aktualisiert DailyRevenue-Einträge, die noch keine Wetterdaten haben.
 *
 * Liest Location (PLZ + Stadt) dynamisch aus CompanyInfo-Stammdaten.
 * Geocoding via Open-Meteo Geocoding API (kostenlos, kein API Key).
 *
 * SECURITY: Nur für Admins — ändert bulkweise DailyRevenue-Datensätze.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// WMO Weather Code → Klartext
const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'Klarer Himmel',
  1: 'Überwiegend klar',
  2: 'Teilweise bewölkt',
  3: 'Bewölkt',
  45: 'Nebel',
  48: 'Reifnebel',
  51: 'Leichter Nieselregen',
  53: 'Nieselregen',
  55: 'Starker Nieselregen',
  56: 'Leichter gefrierender Nieselregen',
  57: 'Starker gefrierender Nieselregen',
  61: 'Leichter Regen',
  63: 'Regen',
  65: 'Starker Regen',
  66: 'Leichter gefrierender Regen',
  67: 'Starker gefrierender Regen',
  71: 'Leichter Schneefall',
  73: 'Schneefall',
  75: 'Starker Schneefall',
  77: 'Schneegriesel',
  80: 'Leichte Regenschauer',
  81: 'Regenschauer',
  82: 'Starkregenschauer',
  85: 'Leichte Schneeschauer',
  86: 'Starke Schneeschauer',
  95: 'Gewitter',
  96: 'Gewitter mit leichtem Hagel',
  99: 'Gewitter mit starkem Hagel',
};

// Baden-Württemberg Feiertage (vereinfacht — fixe + bewegliche)
function isHoliday(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number);
  const easter = computeEaster(year);
  const easterDate = new Date(easter);
  
  const holidays = [
    `${year}-01-01`, // Neujahr
    `${year}-01-06`, // Heilige Drei Könige (BW)
    easterPlusDays(easterDate, -2), // Karfreitag
    easterPlusDays(easterDate, 1),  // Ostermontag
    `${year}-05-01`, // Tag der Arbeit
    easterPlusDays(easterDate, 39), // Christi Himmelfahrt
    easterPlusDays(easterDate, 50), // Pfingstmontag
    easterPlusDays(easterDate, 60), // Fronleichnam (BW)
    `${year}-10-03`, // Tag der Deutschen Einheit
    `${year}-11-01`, // Allerheiligen (BW)
    `${year}-12-25`, // 1. Weihnachtstag
    `${year}-12-26`, // 2. Weihnachtstag
  ];
  
  return holidays.includes(dateStr);
}

function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function easterPlusDays(easter: Date, days: number): string {
  const d = new Date(easter);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Baden-Württemberg Schulferien (vereinfacht — grobe Zeiträume)
function isSchoolVacation(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(dateStr);
  
  const vacations: Array<[string, string]> = [
    // Sommerferien (BW: ca. Ende Juli - Mitte September)
    [`${year}-07-25`, `${year}-09-10`],
    // Herbstferien (BW: ca. Ende Oktober - Anfang November)
    [`${year}-10-28`, `${year}-11-08`],
    // Weihnachtsferien
    [`${year}-12-22`, `${year}-12-31`],
    [`${year + 1}-01-01`, `${year + 1}-01-07`],
    // Osterferien (BW: ca. Mitte April)
    [`${year}-04-10`, `${year}-04-20`],
    // Pfingstferien (BW: ca. Mitte Juni)
    [`${year}-06-10`, `${year}-06-25`],
  ];
  
  return vacations.some(([start, end]) => dateStr >= start && dateStr <= end);
}

// Geocoding: PLZ + Stadt → Lat/Long via Open-Meteo Geocoding API
async function getCoordinates(postalCode: string, city: string): Promise<{ lat: number; lon: number }> {
  const query = city || postalCode;
  const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=de&format=json`;
  
  const res = await fetch(geocodeUrl);
  if (!res.ok) throw new Error(`Geocoding API Fehler: ${res.status}`);
  const data = await res.json();
  
  if (data.results && data.results.length > 0) {
    return { lat: data.results[0].latitude, lon: data.results[0].longitude };
  }
  
  if (postalCode) {
    const plzUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(postalCode)}&count=1&language=de&format=json`;
    const plzRes = await fetch(plzUrl);
    if (plzRes.ok) {
      const plzData = await plzRes.json();
      if (plzData.results && plzData.results.length > 0) {
        return { lat: plzData.results[0].latitude, lon: plzData.results[0].longitude };
      }
    }
  }
  
  throw new Error(`Geocoding fehlgeschlagen für: ${query} (${postalCode})`);
}

export default async function fetchWeatherData(req: any) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const daysBack = req.body?.days_back || 180;
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysBack);
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];
    
    // 0. Location aus CompanyInfo-Stammdaten lesen
    const companyInfo = await base44.asServiceRole.entities.CompanyInfo.list().then((r: any) => r[0]);
    if (!companyInfo) {
      throw new Error('Keine CompanyInfo-Stammdaten gefunden — bitte in Einstellungen pflegen');
    }
    
    const postalCode = companyInfo.postal_code;
    const city = companyInfo.city;
    
    if (!postalCode && !city) {
      throw new Error('CompanyInfo hat keine PLZ/Stadt — bitte in Einstellungen pflegen');
    }
    
    // 1. Koordinaten per Geocoding ermitteln
    const { lat, lon } = await getCoordinates(postalCode, city);
    
    // 2. Wetterdaten von Open-Meteo holen
    const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_max,temperature_2m_mean,precipitation_sum,weathercode&timezone=Europe/Berlin&format=json`;
    
    const weatherRes = await fetch(weatherUrl);
    if (!weatherRes.ok) {
      throw new Error(`Open-Meteo API Fehler: ${weatherRes.status}`);
    }
    const weatherData = await weatherRes.json();
    
    const weatherMap: Record<string, any> = {};
    if (weatherData.daily && weatherData.daily.time) {
      for (let i = 0; i < weatherData.daily.time.length; i++) {
        const date = weatherData.daily.time[i];
        weatherMap[date] = {
          temp_max: weatherData.daily.temperature_2m_max[i],
          temp_mean: weatherData.daily.temperature_2m_mean[i],
          precipitation: weatherData.daily.precipitation_sum[i],
          weather_code: weatherData.daily.weathercode[i],
          weather_description: WMO_DESCRIPTIONS[weatherData.daily.weathercode[i]] || 'Unbekannt',
        };
      }
    }
    
    // 3. Alle DailyRevenue-Einträge holen, die noch keine Wetterdaten haben
    const revenues = await base44.asServiceRole.entities.DailyRevenue.list('-date', 500);
    const needWeather = revenues.filter((r: any) => r.weather_temp_max == null && weatherMap[r.date]);
    
    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    
    // 4. Jeden Eintrag mit Wetterdaten anreichern
    for (const rev of needWeather) {
      const w = weatherMap[rev.date];
      if (!w) {
        notFound++;
        continue;
      }
      
      await base44.asServiceRole.entities.DailyRevenue.update(rev.id, {
        weather_temp_max: w.temp_max,
        weather_temp_mean: w.temp_mean,
        weather_precipitation: w.precipitation,
        weather_code: w.weather_code,
        weather_description: w.weather_description,
        is_holiday: isHoliday(rev.date),
        is_school_vacation: isSchoolVacation(rev.date),
      });
      updated++;
    }
    
    return Response.json({
      success: true,
      location: `${city} (${postalCode})`,
      coordinates: { lat, lon },
      weather_days_fetched: Object.keys(weatherMap).length,
      revenue_entries_checked: revenues.length,
      entries_updated: updated,
      entries_without_weather_match: notFound,
      date_range: `${startStr} → ${endStr}`,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
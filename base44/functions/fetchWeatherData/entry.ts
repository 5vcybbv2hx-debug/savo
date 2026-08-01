/**
 * fetchWeatherData — Holt historische + heutige Wetterdaten von Open-Meteo
 * und aktualisiert DailyRevenue-Einträge, die noch keine Wetterdaten haben.
 *
 * Open-Meteo Archive API (kostenlos, kein API Key):
 * https://archive-api.open-meteo.com/v1/archive
 *
 * Aufruf: POST /api/apps/{app_id}/functions/fetchWeatherData
 * Body: { days_back?: number }  (default: 180)
 */
import { base44 } from 'base44';

const LATITUDE = 52.52;   // Berlin
const LONGITUDE = 13.405;

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

// Berliner Feiertage (vereinfacht — fixe + bewegliche)
function isHoliday(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(dateStr);
  const easter = computeEaster(year);
  const easterDate = new Date(easter);
  
  const holidays = [
    `${year}-01-01`, // Neujahr
    `${year}-03-08`, // Intl. Frauentag (Berlin seit 2019)
    easterPlusDays(easterDate, -2), // Karfreitag
    easterPlusDays(easterDate, 1),  // Ostermontag
    `${year}-05-01`, // Tag der Arbeit
    easterPlusDays(easterDate, 39), // Christi Himmelfahrt
    easterPlusDays(easterDate, 50), // Pfingstmontag
    `${year}-10-03`, // Tag der Deutschen Einheit
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

// Berliner Schulferien (vereinfacht — grobe Zeiträume)
function isSchoolVacation(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(dateStr);
  
  const vacations: Array<[string, string]> = [
    // Winterferien (ca. Anfang Februar)
    [`${year}-02-01`, `${year}-02-05`],
    // Sommerferien (ca. Mitte Juli - Ende August)
    [`${year}-07-15`, `${year}-08-31`],
    // Herbstferien (ca. Mitte Oktober)
    [`${year}-10-10`, `${year}-10-25`],
    // Weihnachtsferien
    [`${year}-12-22`, `${year}-12-31`],
    // Osterferien (ca. Mitte März - Anfang April)
    [`${year}-03-20`, `${year}-04-05`],
    // Pfingstferien (ca. Ende Mai)
    [`${year}-05-23`, `${year}-06-01`],
  ];
  
  return vacations.some(([start, end]) => dateStr >= start && dateStr <= end);
}

export default async function fetchWeatherData(req: any) {
  const daysBack = req.body?.days_back || 180;
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - daysBack);
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = today.toISOString().split('T')[0];
  
  // 1. Wetterdaten von Open-Meteo holen
  const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}&longitude=${LONGITUDE}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_max,temperature_2m_mean,precipitation_sum,weathercode&timezone=Europe/Berlin&format=json`;
  
  const weatherRes = await fetch(weatherUrl);
  if (!weatherRes.ok) {
    throw new Error(`Open-Meteo API Fehler: ${weatherRes.status}`);
  }
  const weatherData = await weatherRes.json();
  
  // Map: date → weather data
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
  
  // 2. Alle DailyRevenue-Einträge holen, die noch keine Wetterdaten haben
  const revenues = await base44.asServiceRole.entities.DailyRevenue.list('-date', 500);
  const needWeather = revenues.filter((r: any) => r.weather_temp_max == null && weatherMap[r.date]);
  
  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  
  // 3. Jeden Eintrag mit Wetterdaten anreichern
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
  
  // 4. Für Tage ohne DailyRevenue-Eintrag einen Weather-Only-Eintrag erstellen?
  // Nein — Wetterdaten werden beim Erstellen des Tagesabschlusses nachgezogen.
  
  return {
    success: true,
    weather_days_fetched: Object.keys(weatherMap).length,
    revenue_entries_checked: revenues.length,
    entries_updated: updated,
    entries_without_weather_match: notFound,
    date_range: `${startStr} → ${endStr}`,
  };
}

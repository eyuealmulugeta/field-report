// 2.64.0 (owner, 7 Nov, R8): the next 3 days' weather at the site (Open-Meteo, free, no key), on Today. Only when the
// project has a map position (set in Central Hub, Reports > Weather). Same terms as the report's weather (2.7.0).

export const wmoWord = (code, wind = 0) => (wind >= 30 ? 'Windy' : (code >= 63 && code <= 67) || code >= 81 ? 'Heavy Rain' : code >= 51 ? 'Light Rain' : code >= 45 ? 'Foggy / Hazy' : code === 3 ? 'Cloudy / Overcast' : code >= 1 ? 'Partly Cloudy' : 'Sunny');
export const forecastUrl = (la, lo) => `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&daily=weather_code,precipitation_sum,temperature_2m_max,wind_speed_10m_max&forecast_days=3&timezone=auto`;
/** { date, word, rain, tmax, heavy } per day; heavy = heavy rain or 10 mm and more. */
export function forecastOf(json) {
  const d = (json && json.daily) || {};
  return (d.time || []).map((date, i) => {
    const word = wmoWord(+(d.weather_code || [])[i] || 0, +(d.wind_speed_10m_max || [])[i] || 0), rain = Math.round((+(d.precipitation_sum || [])[i] || 0) * 10) / 10;
    return { date, word, rain, tmax: Math.round(+(d.temperature_2m_max || [])[i] || 0), heavy: word === 'Heavy Rain' || rain >= 10 };
  });
}

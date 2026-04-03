// Vercel Serverless Function — Property & Suburb Data Lookup
// Fetches data from multiple public sources server-side (no CORS issues)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { address, suburb, postcode, state } = req.query;
  if (!suburb && !address) {
    return res.status(400).json({ error: 'suburb or address required' });
  }

  const s = (suburb || '').toUpperCase().trim();
  const pc = (postcode || '').trim();
  const st = (state || 'NSW').toUpperCase().trim();

  const result = {
    suburb: s, postcode: pc, state: st,
    property: {}, // beds, baths, land, etc.
    suburbStats: {},
    sources: [],
    errors: [],
  };

  // 1. Try Domain.com.au public search API for property details
  try {
    if (address) {
      const domainUrl = `https://www.domain.com.au/phoenix/api/locations/auto-complete?searchTerms=${encodeURIComponent(address)}&maxResults=5`;
      const domResp = await fetch(domainUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PropertyAnalyzer/1.0)' }
      });
      if (domResp.ok) {
        const domData = await domResp.json();
        if (domData && domData.length > 0) {
          result.sources.push('Domain autocomplete');
        }
      }
    }
  } catch (e) { result.errors.push(`Domain: ${e.message}`); }

  // 2. Try to fetch suburb profile from public endpoints
  try {
    const profileUrl = `https://www.domain.com.au/suburb-profile/${s.toLowerCase().replace(/\s+/g, '-')}-${st.toLowerCase()}-${pc}`;
    const profResp = await fetch(profileUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    if (profResp.ok) {
      const html = await profResp.text();

      // Parse median price
      const medianMatch = html.match(/median[^$]*\$([0-9,]+)/i);
      if (medianMatch) {
        result.suburbStats.medianPrice = parseInt(medianMatch[1].replace(/,/g, ''));
        result.sources.push('Domain suburb profile');
      }

      // Parse median rent
      const rentMatch = html.match(/median\s*(?:weekly)?\s*rent[^$]*\$([0-9,]+)/i);
      if (rentMatch) {
        result.suburbStats.weeklyRent = parseInt(rentMatch[1].replace(/,/g, ''));
      }
    }
  } catch (e) { result.errors.push(`Domain profile: ${e.message}`); }

  // 3. Try Allhomes/PropertyValue for additional data
  try {
    const ahUrl = `https://www.allhomes.com.au/research/${s.toLowerCase().replace(/\s+/g, '-')}-${st.toLowerCase()}-${pc}`;
    const ahResp = await fetch(ahUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    if (ahResp.ok) {
      const html = await ahResp.text();

      const daysMatch = html.match(/(\d+)\s*days?\s*(?:on\s*market|to\s*sell)/i);
      if (daysMatch) result.suburbStats.daysOnMarket = parseInt(daysMatch[1]);

      result.sources.push('Allhomes');
    }
  } catch (e) { result.errors.push(`Allhomes: ${e.message}`); }

  // 4. Try to get ABS Census data
  try {
    const absUrl = `https://abs.gov.au/census/find-census-data/quickstats/2021/POA${pc}`;
    const absResp = await fetch(absUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      redirect: 'follow'
    });
    if (absResp.ok) {
      const html = await absResp.text();

      const popMatch = html.match(/Total[^0-9]*([0-9,]+)\s*(?:people|persons)/i);
      if (popMatch) result.suburbStats.population = parseInt(popMatch[1].replace(/,/g, ''));

      const incomeMatch = html.match(/Median[^$]*\$([0-9,]+)\s*(?:per week|weekly)/i);
      if (incomeMatch) result.suburbStats.medianIncomeWeekly = parseInt(incomeMatch[1].replace(/,/g, ''));

      result.sources.push('ABS Census');
    }
  } catch (e) { result.errors.push(`ABS: ${e.message}`); }

  // 5. Try Homes.com.au for quick suburb stats
  try {
    const homesUrl = `https://homes.com.au/suburb-profile/${s.toLowerCase().replace(/\s+/g, '-')}-${st.toLowerCase()}-${pc}`;
    const homesResp = await fetch(homesUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    if (homesResp.ok) {
      const html = await homesResp.text();

      const yieldMatch = html.match(/(\d+\.?\d*)\s*%\s*(?:rental\s*)?yield/i);
      if (yieldMatch) result.suburbStats.grossYield = parseFloat(yieldMatch[1]);

      const salesMatch = html.match(/(\d+)\s*(?:house)?\s*sales?\s*(?:in|over)\s*(?:the\s*)?(?:past|last)\s*12/i);
      if (salesMatch) result.suburbStats.annualSales = parseInt(salesMatch[1]);

      result.sources.push('Homes.com.au');
    }
  } catch (e) { result.errors.push(`Homes: ${e.message}`); }

  // 6. Merge with embedded fallback data
  const FALLBACK_DB = {
    'BERKELEY VALE': { postcode:'2261', medianPrice:935000, weeklyRent:680, population:8951, popGrowth:7.13, medianIncomeWeekly:1780, incomeGrowth:27.78, vacancyRate:1.0, ownerOccRate:77.1, annualGrowth:5.65, daysOnMarket:26, annualSales:149, boomScore:52, zoning:'R2 Low Density', nearestStationKm:4.0 },
    'TUGGERAH': { postcode:'2259', medianPrice:850000, weeklyRent:620, population:3500, popGrowth:5.2, medianIncomeWeekly:1650, incomeGrowth:22.0, vacancyRate:0.8, ownerOccRate:72.0, annualGrowth:6.2, daysOnMarket:28, annualSales:95, boomScore:55, zoning:'R2 Low Density', nearestStationKm:0.3 },
    'WYONG': { postcode:'2259', medianPrice:780000, weeklyRent:580, population:4200, popGrowth:4.8, medianIncomeWeekly:1500, incomeGrowth:20.0, vacancyRate:0.9, ownerOccRate:68.0, annualGrowth:5.8, daysOnMarket:32, annualSales:120, boomScore:48, zoning:'R2 Low Density', nearestStationKm:0.2 },
    'GOSFORD': { postcode:'2250', medianPrice:920000, weeklyRent:650, population:5800, popGrowth:6.0, medianIncomeWeekly:1700, incomeGrowth:25.0, vacancyRate:0.7, ownerOccRate:65.0, annualGrowth:8.4, daysOnMarket:24, annualSales:180, boomScore:60, zoning:'R2 Low Density', nearestStationKm:0.1 },
    'THE ENTRANCE': { postcode:'2261', medianPrice:870000, weeklyRent:600, population:4100, popGrowth:3.5, medianIncomeWeekly:1400, incomeGrowth:18.0, vacancyRate:1.2, ownerOccRate:60.0, annualGrowth:4.5, daysOnMarket:35, annualSales:110, boomScore:45, zoning:'R3 Medium Density', nearestStationKm:2.5 },
    'ERINA': { postcode:'2250', medianPrice:1100000, weeklyRent:750, population:5500, popGrowth:4.0, medianIncomeWeekly:1900, incomeGrowth:22.0, vacancyRate:0.8, ownerOccRate:78.0, annualGrowth:6.0, daysOnMarket:22, annualSales:90, boomScore:58, zoning:'R2 Low Density', nearestStationKm:3.0 },
    'WOY WOY': { postcode:'2256', medianPrice:950000, weeklyRent:660, population:5000, popGrowth:5.5, medianIncomeWeekly:1600, incomeGrowth:24.0, vacancyRate:0.9, ownerOccRate:72.0, annualGrowth:5.5, daysOnMarket:30, annualSales:105, boomScore:50, zoning:'R2 Low Density', nearestStationKm:0.3 },
    'BLACKTOWN': { postcode:'2148', medianPrice:880000, weeklyRent:550, population:47000, popGrowth:8.0, medianIncomeWeekly:1650, incomeGrowth:25.0, vacancyRate:1.5, ownerOccRate:62.0, annualGrowth:7.2, daysOnMarket:25, annualSales:350, boomScore:55, zoning:'R2 Low Density', nearestStationKm:0.2 },
    'PARRAMATTA': { postcode:'2150', medianPrice:1200000, weeklyRent:650, population:30000, popGrowth:10.0, medianIncomeWeekly:1800, incomeGrowth:28.0, vacancyRate:1.2, ownerOccRate:55.0, annualGrowth:6.5, daysOnMarket:22, annualSales:280, boomScore:62, zoning:'R4 High Density', nearestStationKm:0.1 },
    'LIVERPOOL': { postcode:'2170', medianPrice:850000, weeklyRent:530, population:27000, popGrowth:7.5, medianIncomeWeekly:1550, incomeGrowth:23.0, vacancyRate:1.8, ownerOccRate:60.0, annualGrowth:6.8, daysOnMarket:28, annualSales:250, boomScore:50, zoning:'R3 Medium Density', nearestStationKm:0.3 },
    'PENRITH': { postcode:'2750', medianPrice:820000, weeklyRent:520, population:13000, popGrowth:6.5, medianIncomeWeekly:1500, incomeGrowth:22.0, vacancyRate:1.5, ownerOccRate:65.0, annualGrowth:7.0, daysOnMarket:30, annualSales:200, boomScore:48, zoning:'R2 Low Density', nearestStationKm:0.2 },
    'GLENNING VALLEY': { postcode:'2261', medianPrice:1255000, weeklyRent:750, population:4000, popGrowth:8.5, medianIncomeWeekly:2000, incomeGrowth:30.0, vacancyRate:0.6, ownerOccRate:82.0, annualGrowth:23.0, daysOnMarket:18, annualSales:60, boomScore:72, zoning:'R2 Low Density', nearestStationKm:3.5 },
    'NEWCASTLE': { postcode:'2300', medianPrice:1068000, weeklyRent:706, population:4500, popGrowth:5.0, medianIncomeWeekly:1600, incomeGrowth:20.0, vacancyRate:1.0, ownerOccRate:58.0, annualGrowth:5.5, daysOnMarket:28, annualSales:150, boomScore:55, zoning:'R3 Medium Density', nearestStationKm:0.5 },
    'WOLLONGONG': { postcode:'2500', medianPrice:1300000, weeklyRent:600, population:15000, popGrowth:4.5, medianIncomeWeekly:1700, incomeGrowth:22.0, vacancyRate:1.2, ownerOccRate:60.0, annualGrowth:5.0, daysOnMarket:30, annualSales:200, boomScore:50, zoning:'R3 Medium Density', nearestStationKm:0.3 },
    'BANKSTOWN': { postcode:'2200', medianPrice:1670000, weeklyRent:750, population:35000, popGrowth:9.0, medianIncomeWeekly:1500, incomeGrowth:22.0, vacancyRate:1.3, ownerOccRate:55.0, annualGrowth:26.3, daysOnMarket:20, annualSales:300, boomScore:70, zoning:'R3 Medium Density', nearestStationKm:0.1 },
    'MOUNT DRUITT': { postcode:'2770', medianPrice:750000, weeklyRent:500, population:15000, popGrowth:7.0, medianIncomeWeekly:1300, incomeGrowth:20.0, vacancyRate:1.5, ownerOccRate:55.0, annualGrowth:5.6, daysOnMarket:25, annualSales:180, boomScore:48, zoning:'R2 Low Density', nearestStationKm:0.2 },
    'ST MARYS': { postcode:'2760', medianPrice:800000, weeklyRent:520, population:12000, popGrowth:8.0, medianIncomeWeekly:1400, incomeGrowth:22.0, vacancyRate:1.3, ownerOccRate:58.0, annualGrowth:15.1, daysOnMarket:22, annualSales:160, boomScore:58, zoning:'R2 Low Density', nearestStationKm:0.1 },
    'QUAKERS HILL': { postcode:'2763', medianPrice:950000, weeklyRent:600, population:28000, popGrowth:5.5, medianIncomeWeekly:1700, incomeGrowth:24.0, vacancyRate:1.2, ownerOccRate:75.0, annualGrowth:4.5, daysOnMarket:28, annualSales:150, boomScore:50, zoning:'R2 Low Density', nearestStationKm:0.5 },
    'CHITTAWAY BAY': { postcode:'2261', medianPrice:900000, weeklyRent:650, population:3200, popGrowth:5.0, medianIncomeWeekly:1700, incomeGrowth:24.0, vacancyRate:0.9, ownerOccRate:75.0, annualGrowth:5.5, daysOnMarket:28, annualSales:80, boomScore:50, zoning:'R2 Low Density', nearestStationKm:3.5 },
    'KILLARNEY VALE': { postcode:'2261', medianPrice:880000, weeklyRent:640, population:6500, popGrowth:4.5, medianIncomeWeekly:1650, incomeGrowth:22.0, vacancyRate:1.0, ownerOccRate:72.0, annualGrowth:5.2, daysOnMarket:30, annualSales:100, boomScore:48, zoning:'R2 Low Density', nearestStationKm:3.8 },
    'BATEAU BAY': { postcode:'2261', medianPrice:950000, weeklyRent:680, population:7000, popGrowth:4.0, medianIncomeWeekly:1750, incomeGrowth:22.0, vacancyRate:0.8, ownerOccRate:76.0, annualGrowth:5.8, daysOnMarket:25, annualSales:110, boomScore:52, zoning:'R2 Low Density', nearestStationKm:4.5 },
    'TERRIGAL': { postcode:'2260', medianPrice:1350000, weeklyRent:780, population:8500, popGrowth:3.5, medianIncomeWeekly:2000, incomeGrowth:20.0, vacancyRate:0.7, ownerOccRate:80.0, annualGrowth:5.5, daysOnMarket:22, annualSales:120, boomScore:55, zoning:'R2 Low Density', nearestStationKm:6.0 },
    'TOUKLEY': { postcode:'2263', medianPrice:750000, weeklyRent:530, population:5500, popGrowth:5.5, medianIncomeWeekly:1400, incomeGrowth:22.0, vacancyRate:1.0, ownerOccRate:65.0, annualGrowth:6.5, daysOnMarket:28, annualSales:130, boomScore:50, zoning:'R2 Low Density', nearestStationKm:4.0 },
    'UMINA BEACH': { postcode:'2257', medianPrice:1000000, weeklyRent:680, population:8000, popGrowth:5.0, medianIncomeWeekly:1600, incomeGrowth:24.0, vacancyRate:0.8, ownerOccRate:70.0, annualGrowth:6.0, daysOnMarket:26, annualSales:140, boomScore:54, zoning:'R2 Low Density', nearestStationKm:1.5 },
    'ETTALONG BEACH': { postcode:'2257', medianPrice:1050000, weeklyRent:700, population:4500, popGrowth:4.5, medianIncomeWeekly:1650, incomeGrowth:22.0, vacancyRate:0.7, ownerOccRate:68.0, annualGrowth:5.8, daysOnMarket:24, annualSales:80, boomScore:52, zoning:'R2 Low Density', nearestStationKm:1.8 },
  };

  // Merge: API data takes priority, then fallback DB, then defaults
  const fallback = FALLBACK_DB[s] || {};
  const stats = result.suburbStats;

  result.suburbStats = {
    medianPrice: stats.medianPrice || fallback.medianPrice || 800000,
    weeklyRent: stats.weeklyRent || fallback.weeklyRent || 550,
    population: stats.population || fallback.population || 5000,
    popGrowth: fallback.popGrowth || 5.0,
    medianIncomeWeekly: stats.medianIncomeWeekly || fallback.medianIncomeWeekly || 1500,
    incomeGrowth: fallback.incomeGrowth || 20.0,
    vacancyRate: fallback.vacancyRate || 1.5,
    ownerOccRate: fallback.ownerOccRate || 70.0,
    annualGrowth: fallback.annualGrowth || 5.0,
    daysOnMarket: stats.daysOnMarket || fallback.daysOnMarket || 30,
    annualSales: stats.annualSales || fallback.annualSales || 100,
    boomScore: fallback.boomScore || 50,
    zoning: fallback.zoning || 'R2 Low Density',
    nearestStationKm: fallback.nearestStationKm || 2.0,
    grossYield: stats.grossYield || null,
  };

  // Flag which data came from live sources vs fallback
  result.dataSource = result.sources.length > 0 ? 'live+fallback' : (FALLBACK_DB[s] ? 'database' : 'defaults');

  return res.status(200).json(result);
}

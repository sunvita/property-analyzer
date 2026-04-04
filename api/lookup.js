// Vercel Serverless Function — Property & Suburb Data Lookup
// Fetches data from 7+ categories of AU property research sites
// Uses Claude API as intelligent fallback for any suburb
// Falls back to embedded database when all else fails

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT = 8000;

// Helper: fetch with timeout
async function fetchWithTimeout(url, opts = {}, timeout = TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, { ...opts, signal: controller.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    clearTimeout(timer);
    return resp;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function rx(html, pattern, group = 1) {
  const m = html.match(pattern);
  return m ? m[group] : null;
}
function rxNum(html, pattern, group = 1) {
  const v = rx(html, pattern, group);
  return v ? parseFloat(v.replace(/,/g, '')) : null;
}

// ─── SOURCE 1: BoomScore ───
async function fetchBoomScore(suburb, state, postcode) {
  const data = { source: 'BoomScore', fields: {} };
  try {
    const slug = suburb.toLowerCase().replace(/\s+/g, '-');
    const urls = [
      `https://app.boomscore.com.au/api/suburb?name=${encodeURIComponent(suburb)}&state=${state}&postcode=${postcode}`,
      `https://app.boomscore.com.au/suburb-profile/${slug}-${state.toLowerCase()}-${postcode}`,
    ];
    for (const url of urls) {
      try {
        const resp = await fetchWithTimeout(url);
        if (!resp.ok) continue;
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const json = await resp.json();
          if (json.boomScore || json.boom_score) data.fields.boomScore = json.boomScore || json.boom_score;
          if (json.medianPrice || json.median_price) data.fields.medianPrice = json.medianPrice || json.median_price;
          if (json.daysOnMarket || json.dom) data.fields.daysOnMarket = json.daysOnMarket || json.dom;
          if (json.grossYield) data.fields.grossYield = json.grossYield;
          data.ok = true; break;
        } else {
          const html = await resp.text();
          const bs = rxNum(html, /boom\s*score[^0-9]*(\d+)/i);
          if (bs) data.fields.boomScore = bs;
          const mp = rxNum(html, /median[^$]*\$([0-9,]+)/i);
          if (mp) data.fields.medianPrice = mp;
          if (Object.keys(data.fields).length > 0) { data.ok = true; break; }
        }
      } catch (e) { continue; }
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// ─── SOURCE 1b: HtAG ───
async function fetchHtag(suburb, state, postcode) {
  const data = { source: 'HtAG', fields: {} };
  try {
    const slug = suburb.toLowerCase().replace(/\s+/g, '-');
    const urls = [
      `https://www.htag.com.au/suburb/${slug}-${state.toLowerCase()}-${postcode}`,
      `https://www.htag.com.au/api/suburb?name=${encodeURIComponent(suburb)}&state=${state}`,
    ];
    for (const url of urls) {
      try {
        const resp = await fetchWithTimeout(url);
        if (!resp.ok) continue;
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const json = await resp.json();
          if (json.medianPrice) data.fields.medianPrice = json.medianPrice;
          if (json.grossYield) data.fields.grossYield = json.grossYield;
          if (json.vacancyRate) data.fields.vacancyRate = json.vacancyRate;
          data.ok = true; break;
        } else {
          const html = await resp.text();
          const mp = rxNum(html, /median\s*(?:house)?\s*price[^$]*\$([0-9,]+)/i);
          if (mp) data.fields.medianPrice = mp;
          const gy = rxNum(html, /gross\s*yield[^0-9]*([0-9.]+)\s*%/i);
          if (gy) data.fields.grossYield = gy;
          if (Object.keys(data.fields).length > 0) { data.ok = true; break; }
        }
      } catch (e) { continue; }
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// ─── SOURCE 2: LandChecker ───
async function fetchLandchecker(suburb, state, postcode) {
  const data = { source: 'LandChecker', fields: {} };
  try {
    const slug = suburb.toLowerCase().replace(/\s+/g, '-');
    const url = `https://landchecker.com.au/suburb-profiles/${slug}-${state.toLowerCase()}-${postcode}`;
    const resp = await fetchWithTimeout(url);
    if (resp.ok) {
      const html = await resp.text();
      const pop = rxNum(html, /population[^0-9]*([0-9,]+)/i);
      if (pop) data.fields.population = pop;
      const inc = rxNum(html, /(?:median|household)\s*income[^$]*\$([0-9,]+)/i);
      if (inc) data.fields.medianIncomeWeekly = inc;
      if (Object.keys(data.fields).length > 0) data.ok = true;
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// ─── SOURCE 3: REMPLAN ───
async function fetchRemplan(suburb, state) {
  const data = { source: 'REMPLAN', fields: {} };
  try {
    const slug = suburb.toLowerCase().replace(/\s+/g, '-');
    const url = `https://app.remplan.com.au/community/${slug}/community/summary`;
    const resp = await fetchWithTimeout(url);
    if (resp.ok) {
      const html = await resp.text();
      const pop = rxNum(html, /(?:estimated|total)\s*(?:resident)?\s*population[^0-9]*([0-9,]+)/i);
      if (pop) data.fields.population = pop;
      const inc = rxNum(html, /median\s*(?:weekly)?\s*income[^$]*\$([0-9,]+)/i);
      if (inc) data.fields.medianIncomeWeekly = inc;
      if (Object.keys(data.fields).length > 0) data.ok = true;
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// ─── SOURCE 4: Microburbs ───
async function fetchMicroburbs(suburb, state) {
  const data = { source: 'Microburbs', fields: {} };
  try {
    const stateMap = { NSW:'NSW', VIC:'Vic', QLD:'Qld', WA:'WA', SA:'SA', TAS:'Tas', NT:'NT', ACT:'ACT' };
    const slug = suburb.replace(/\s+/g, '-');
    const urls = [
      `https://www2.microburbs.com.au/api/v1/suburb?name=${encodeURIComponent(suburb)}&state=${state}`,
      `https://www.microburbs.com.au/${stateMap[state] || state}/${slug}`,
    ];
    for (const url of urls) {
      try {
        const resp = await fetchWithTimeout(url);
        if (!resp.ok) continue;
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const json = await resp.json();
          if (json.affluenceScore || json.affluence_score) data.fields.affluenceScore = json.affluenceScore || json.affluence_score;
          if (json.crimeScore || json.crime_score) data.fields.crimeScore = json.crimeScore || json.crime_score;
          data.ok = true; break;
        } else {
          const html = await resp.text();
          const aff = rxNum(html, /affluence\s*(?:score)?[^0-9]*(\d+)/i);
          if (aff) data.fields.affluenceScore = aff;
          if (Object.keys(data.fields).length > 0) { data.ok = true; break; }
        }
      } catch (e) { continue; }
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// ─── SOURCE 5: OpenStats ───
async function fetchOpenStats(suburb) {
  const data = { source: 'OpenStats', fields: {} };
  try {
    const slug = suburb.toLowerCase().replace(/\s+/g, '-');
    const resp = await fetchWithTimeout(`https://openstats.com.au/dashboards/crime/suburb/${slug}/`);
    if (resp.ok) {
      const html = await resp.text();
      const cr = rxNum(html, /(?:total|overall)\s*crime\s*rate[^0-9]*([0-9,.]+)/i);
      if (cr) data.fields.crimeRate = cr;
      const seifa = rxNum(html, /(?:SEIFA|socio[- ]economic)[^0-9]*(\d+)/i);
      if (seifa) data.fields.seifaIndex = seifa;
      if (Object.keys(data.fields).length > 0) data.ok = true;
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// ─── SOURCE 6: Property.com.au + Domain ───
async function fetchPropertySites(suburb, state, postcode) {
  const data = { source: 'Property.com.au/Domain', fields: {} };
  try {
    const slug = suburb.toLowerCase().replace(/\s+/g, '-');
    const urls = [
      `https://www.property.com.au/${slug}-${state.toLowerCase()}-${postcode}/`,
      `https://www.domain.com.au/suburb-profile/${slug}-${state.toLowerCase()}-${postcode}`,
    ];
    for (const url of urls) {
      try {
        const resp = await fetchWithTimeout(url);
        if (!resp.ok) continue;
        const html = await resp.text();
        const mp = rxNum(html, /median[^$]*\$([0-9,]+)/i);
        if (mp && !data.fields.medianPrice) data.fields.medianPrice = mp;
        const rent = rxNum(html, /median\s*(?:weekly)?\s*rent[^$]*\$([0-9,]+)/i);
        if (rent && !data.fields.weeklyRent) data.fields.weeklyRent = rent;
        const dom = rxNum(html, /(\d+)\s*days?\s*(?:on\s*market|to\s*sell)/i);
        if (dom && !data.fields.daysOnMarket) data.fields.daysOnMarket = dom;
        const growth = rxNum(html, /(?:annual|yearly)\s*(?:capital)?\s*growth[^0-9]*([0-9.]+)\s*%/i);
        if (growth && !data.fields.annualGrowth) data.fields.annualGrowth = growth;
        const flood = rx(html, /(flood\s*(?:zone|risk|prone)[^<]{0,100})/i);
        if (flood) data.fields.floodZone = flood.trim();
        const fire = rx(html, /(bush\s*fire\s*(?:zone|risk|prone|BAL)[^<]{0,100})/i);
        if (fire) data.fields.bushfireRisk = fire.trim();
        if (Object.keys(data.fields).length > 0) data.ok = true;
      } catch (e) { continue; }
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// ─── SOURCE 7: SuburbsFinder ───
async function fetchSuburbsFinder(suburb, state, postcode) {
  const data = { source: 'SuburbsFinder', fields: {} };
  try {
    const slug = suburb.toLowerCase().replace(/\s+/g, '-');
    const urls = [
      `https://www.suburbsfinder.com.au/suburb/${state.toLowerCase()}/${slug}-${postcode}`,
      `https://www.suburbsfinder.com.au/${state.toLowerCase()}/${slug}-${postcode}`,
    ];
    for (const url of urls) {
      try {
        const resp = await fetchWithTimeout(url);
        if (!resp.ok) continue;
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const json = await resp.json();
          if (json.medianPrice) data.fields.medianPrice = json.medianPrice;
          if (json.weeklyRent || json.medianRent) data.fields.weeklyRent = json.weeklyRent || json.medianRent;
          if (json.grossYield) data.fields.grossYield = json.grossYield;
          if (json.vacancyRate) data.fields.vacancyRate = json.vacancyRate;
          if (json.annualGrowth) data.fields.annualGrowth = json.annualGrowth;
          data.ok = true; break;
        } else {
          const html = await resp.text();
          const mp = rxNum(html, /median\s*(?:house)?\s*price[^$]*\$([0-9,]+)/i);
          if (mp) data.fields.medianPrice = mp;
          const gy = rxNum(html, /(?:gross|rental)\s*yield[^0-9]*([0-9.]+)\s*%/i);
          if (gy) data.fields.grossYield = gy;
          const vr = rxNum(html, /vacancy\s*rate[^0-9]*([0-9.]+)\s*%/i);
          if (vr) data.fields.vacancyRate = vr;
          if (Object.keys(data.fields).length > 0) { data.ok = true; break; }
        }
      } catch (e) { continue; }
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// ─── ABS Census ───
async function fetchABS(postcode) {
  const data = { source: 'ABS Census', fields: {} };
  try {
    const resp = await fetchWithTimeout(`https://abs.gov.au/census/find-census-data/quickstats/2021/POA${postcode}`, { redirect: 'follow' });
    if (resp.ok) {
      const html = await resp.text();
      const pop = rxNum(html, /Total[^0-9]*([0-9,]+)\s*(?:people|persons)/i);
      if (pop) data.fields.population = pop;
      const inc = rxNum(html, /Median[^$]*\$([0-9,]+)\s*(?:per week|weekly)/i);
      if (inc) data.fields.medianIncomeWeekly = inc;
      if (Object.keys(data.fields).length > 0) data.ok = true;
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// ─── Claude API Fallback for Unknown Suburbs ───
async function fetchClaudeAnalysis(suburb, state, postcode) {
  const data = { source: 'Claude AI', fields: {} };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { data.error = 'No ANTHROPIC_API_KEY'; return data; }

  try {
    const prompt = `You are an Australian property data assistant. Provide the best available data for the suburb "${suburb}" in ${state} ${postcode}. Return ONLY a valid JSON object with these fields (use null if unknown, numbers only, no strings for numeric fields):
{
  "medianPrice": number (house median in AUD),
  "weeklyRent": number (median weekly rent for house),
  "population": number,
  "popGrowth": number (% growth over 5 years),
  "medianIncomeWeekly": number (household median weekly income AUD),
  "incomeGrowth": number (% growth over 5 years),
  "vacancyRate": number (%),
  "ownerOccRate": number (%),
  "annualGrowth": number (% annual capital growth),
  "daysOnMarket": number,
  "annualSales": number (12-month sales volume),
  "boomScore": number (0-100, demand/supply rating),
  "zoning": string (primary residential zoning),
  "nearestStationKm": number (km to nearest train station)
}`;

    const resp = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    }, 15000); // 15s timeout for AI

    if (resp.ok) {
      const result = await resp.json();
      const text = result.content?.[0]?.text || '';
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Map fields
        for (const [key, val] of Object.entries(parsed)) {
          if (val !== null && val !== undefined) {
            data.fields[key] = val;
          }
        }
        data.ok = true;
      }
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// ─── EMBEDDED FALLBACK DATABASE (25 suburbs) ───
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

// ─── MAIN HANDLER ───
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
  const hasFallback = !!FALLBACK_DB[s];

  // ── Phase 1: Run ALL web sources in parallel ──
  const webResults = await Promise.allSettled([
    fetchBoomScore(s, st, pc),        // 1. Demand/Supply
    fetchHtag(s, st, pc),             // 1b. Demand/Supply
    fetchLandchecker(s, st, pc),      // 2. Property type/Income
    fetchRemplan(s, st),              // 3. Economy/Community
    fetchMicroburbs(s, st),           // 4. Affluence/Crime
    fetchOpenStats(s),                // 5. Crime/Socio-economic
    fetchPropertySites(s, st, pc),    // 6. Property details
    fetchSuburbsFinder(s, st, pc),    // 7. Cash flow metrics
    fetchABS(pc),                     // Census data
  ]);

  const allSources = webResults.map(r =>
    r.status === 'fulfilled' ? r.value : { source: 'unknown', error: 'rejected' }
  );
  let successSources = allSources.filter(s => s.ok);
  let liveFields = {};
  for (const src of successSources) {
    Object.assign(liveFields, src.fields);
  }

  // ── Sanity validation: discard obviously wrong scraped values ──
  const VALID_RANGES = {
    medianPrice:      [100000, 20000000],  // $100K ~ $20M
    weeklyRent:       [100, 5000],         // $100 ~ $5000/week
    population:       [100, 5000000],      // 100 ~ 5M
    popGrowth:        [-10, 50],           // -10% ~ 50%
    medianIncomeWeekly: [300, 10000],      // $300 ~ $10000/week
    incomeGrowth:     [-10, 100],
    vacancyRate:      [0, 30],             // 0% ~ 30%
    ownerOccRate:     [10, 100],
    annualGrowth:     [-20, 50],           // -20% ~ 50%
    daysOnMarket:     [1, 365],
    annualSales:      [1, 10000],
    boomScore:        [0, 100],
    grossYield:       [0.5, 20],           // 0.5% ~ 20%
    affluenceScore:   [0, 100],
    crimeRate:        [0, 50000],
    seifaIndex:       [500, 1200],
  };
  for (const [key, [min, max]] of Object.entries(VALID_RANGES)) {
    if (liveFields[key] !== undefined && liveFields[key] !== null) {
      if (typeof liveFields[key] === 'number' && (liveFields[key] < min || liveFields[key] > max)) {
        delete liveFields[key]; // Discard out-of-range value
      }
    }
  }

  // ── Cross-validation: if implied gross yield is unrealistic, discard rent ──
  const xPrice = liveFields.medianPrice || (hasFallback ? fallback.medianPrice : null);
  const xRent  = liveFields.weeklyRent;
  if (xPrice && xRent && typeof xPrice === 'number' && typeof xRent === 'number') {
    const impliedYield = (xRent * 52) / xPrice * 100;
    if (impliedYield > 12 || impliedYield < 1) {
      // Yield outside 1-12% is almost certainly bad scraped data
      delete liveFields.weeklyRent;
      delete liveFields.grossYield;
    }
  }

  // ── Phase 2: If no web data AND no fallback DB → use Claude API ──
  const hasUsefulData = Object.keys(liveFields).length >= 3 || hasFallback;
  let claudeResult = null;

  if (!hasUsefulData) {
    claudeResult = await fetchClaudeAnalysis(s, st, pc);
    if (claudeResult.ok) {
      successSources.push(claudeResult);
      Object.assign(liveFields, claudeResult.fields);
    }
  }

  const failedSources = allSources.filter(s => !s.ok);
  const fallback = FALLBACK_DB[s] || {};

  // ── Merge: live > Claude > fallback > defaults ──
  const result = {
    suburb: s, postcode: pc || fallback.postcode || '', state: st,
    suburbStats: {
      medianPrice: liveFields.medianPrice || fallback.medianPrice || 800000,
      weeklyRent: liveFields.weeklyRent || fallback.weeklyRent || 550,
      population: liveFields.population || fallback.population || 5000,
      popGrowth: liveFields.popGrowth || fallback.popGrowth || 5.0,
      medianIncomeWeekly: liveFields.medianIncomeWeekly || fallback.medianIncomeWeekly || 1500,
      incomeGrowth: liveFields.incomeGrowth || fallback.incomeGrowth || 20.0,
      vacancyRate: liveFields.vacancyRate || fallback.vacancyRate || 1.5,
      ownerOccRate: liveFields.ownerOccRate || fallback.ownerOccRate || 70.0,
      annualGrowth: liveFields.annualGrowth || fallback.annualGrowth || 5.0,
      daysOnMarket: liveFields.daysOnMarket || fallback.daysOnMarket || 30,
      annualSales: liveFields.annualSales || fallback.annualSales || 100,
      boomScore: liveFields.boomScore || fallback.boomScore || 50,
      grossYield: liveFields.grossYield || null,
      zoning: liveFields.zoning || fallback.zoning || 'R2 Low Density',
      nearestStationKm: liveFields.nearestStationKm || fallback.nearestStationKm || 2.0,
      // Specialized data
      affluenceScore: liveFields.affluenceScore || null,
      crimeRate: liveFields.crimeRate || null,
      crimeScore: liveFields.crimeScore || null,
      seifaIndex: liveFields.seifaIndex || null,
      floodZone: liveFields.floodZone || null,
      bushfireRisk: liveFields.bushfireRisk || null,
    },
    sources: successSources.map(s => s.source),
    failedSources: failedSources.map(s => ({ source: s.source, error: s.error })),
    liveFieldCount: Object.keys(liveFields).length,
    dataSource: successSources.length > 0
      ? `live(${successSources.length}/${allSources.length + (claudeResult ? 1 : 0)})`
      : (hasFallback ? 'database' : 'defaults'),
    usedClaude: !!claudeResult?.ok,
  };

  return res.status(200).json(result);
}

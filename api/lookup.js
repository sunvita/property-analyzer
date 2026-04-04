// Vercel Serverless Function — Property & Suburb Data Lookup
// Fetches data from 7+ categories of AU property research sites
// Uses Claude API as intelligent fallback for any suburb
// Falls back to embedded database when all else fails

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TIMEOUT = 10000;

// Full browser-like headers to avoid bot detection
const BROWSER_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9,ko;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'sec-ch-ua': '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="8"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

// Helper: fetch with timeout
async function fetchWithTimeout(url, opts = {}, timeout = TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: { ...BROWSER_HEADERS, ...(opts.headers || {}) },
      redirect: 'follow',
    });
    clearTimeout(timer);
    return resp;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// Helper: fetch via ScraperAPI (bypasses bot detection for blocked sites)
// Requires SCRAPER_API_KEY env var — falls back to direct fetch if absent
// render=true uses headless browser (5x credits) for JS-rendered pages
async function fetchViaScraperAPI(url, timeout = 25000, render = false) {
  const key = process.env.SCRAPER_API_KEY;
  if (!key) return fetchWithTimeout(url, {}, timeout);
  const scraperUrl = `https://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}&country_code=au&render=${render ? 'true' : 'false'}`;
  return fetchWithTimeout(scraperUrl, { headers: {} }, timeout);
}

function rx(html, pattern, group = 1) {
  const m = html.match(pattern);
  return m ? m[group] : null;
}
function rxNum(html, pattern, group = 1) {
  const v = rx(html, pattern, group);
  return v ? parseFloat(v.replace(/,/g, '')) : null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Street type normalization for URL slug generation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const STREET_ABBREVS = {
  'street': 'st', 'avenue': 'ave', 'road': 'rd', 'drive': 'dr',
  'place': 'pl', 'court': 'ct', 'crescent': 'cres', 'lane': 'ln',
  'boulevard': 'blvd', 'terrace': 'tce', 'parade': 'pde', 'close': 'cl',
  'circuit': 'cct', 'way': 'way',
};
const STREET_FULL = Object.fromEntries(Object.entries(STREET_ABBREVS).map(([k,v]) => [v, k]));

function abbreviateStreet(street) {
  return street.replace(/\b(street|avenue|road|drive|place|court|crescent|lane|boulevard|terrace|parade|close|circuit)\b/i,
    (m) => STREET_ABBREVS[m.toLowerCase()] || m);
}
function expandStreet(street) {
  return street.replace(/\b(st|ave|rd|dr|pl|ct|cres|ln|blvd|tce|pde|cl|cct)\b/i,
    (m) => STREET_FULL[m.toLowerCase()] || m);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE 0: Individual Listing Lookup (address-specific)
// Tries to find the ACTUAL property listing price/rent
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Domain Property Profile: past sale/rent history for an address
async function fetchDomainPropertyProfile(street, suburb, state, postcode) {
  const data = { source: 'Domain Property Profile', fields: {} };
  try {
    // Strategy 1: Domain's search suggest API (JSON, less bot detection)
    const searchQuery = `${street}, ${suburb} ${state} ${postcode}`;
    try {
      const suggestUrl = `https://suggest.domain.com.au/v1/suggest?query=${encodeURIComponent(searchQuery)}&types=property`;
      const suggestResp = await fetchWithTimeout(suggestUrl, {
        headers: { ...BROWSER_HEADERS, 'Accept': 'application/json', 'Referer': 'https://www.domain.com.au/' }
      });
      if (suggestResp.ok) {
        const suggestions = await suggestResp.json();
        if (Array.isArray(suggestions) && suggestions.length > 0) {
          const prop = suggestions[0];
          // Domain suggest API may return property ID for deeper lookup
          if (prop.id || prop.propertyId) {
            data.fields._domainPropertyId = prop.id || prop.propertyId;
          }
          if (prop.address) data.fields._domainAddress = prop.address;
        }
      }
    } catch (e) { /* suggest API failed, continue to HTML scrape */ }

    // Strategy 2: Direct HTML property profile page — Domain blocks Vercel IPs, use ScraperAPI
    const fullStreet = expandStreet(street);
    const slug = `${fullStreet}-${suburb}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
    const url = `https://www.domain.com.au/property-profile/${slug}-${state.toLowerCase()}-${postcode}`;
    data.urlAttempted = url;
    const resp = await fetchViaScraperAPI(url);
    if (!resp.ok) { data.error = `HTTP ${resp.status}`; return data; }
    const html = await resp.text();
    data.htmlLength = html.length;

    // Try __NEXT_DATA__ JSON — Domain uses Apollo GraphQL cache
    const nextMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextMatch) {
      try {
        const nd = JSON.parse(nextMatch[1]);
        const pp = nd?.props?.pageProps;
        if (pp) {
          // ── Strategy A: Apollo State (primary — this is how Domain stores data) ──
          const apollo = pp['__APOLLO_STATE__'];
          if (apollo) {
            const propKey = Object.keys(apollo).find(k => k.startsWith('Property:'));
            const prop = propKey ? apollo[propKey] : null;
            if (prop) {
              // Rental estimate (most important!)
              const rentEst = prop.rentalEstimate;
              if (rentEst?.weeklyRentEstimate && typeof rentEst.weeklyRentEstimate === 'number') {
                data.fields.listingRent = rentEst.weeklyRentEstimate;
              }
              // Valuation (estimated value range)
              const val = prop.valuation;
              if (val?.midPrice && typeof val.midPrice === 'number' && val.midPrice > 100000) {
                data.fields.estimatedValue = val.midPrice;
              }
              // Active listing price (from listings array)
              if (Array.isArray(prop.listings) && prop.listings.length > 0) {
                const liveListing = prop.listings.find(l => l.status === 'LIVE') || prop.listings[0];
                const displayPrice = liveListing?.priceDetails?.displayPrice;
                if (displayPrice) {
                  const priceNum = parseFloat(displayPrice.replace(/[^0-9.]/g, ''));
                  if (priceNum > 100000) data.fields.listingPrice = priceNum;
                }
                data.fields._listingType = liveListing?.type; // BUY or RENT
              }
              // Property details
              if (prop.bedrooms) data.fields.beds = prop.bedrooms;
              if (prop.bathrooms) data.fields.baths = prop.bathrooms;
              if (prop.parkingSpaces) data.fields.cars = prop.parkingSpaces;
              // landArea with unit key: landArea({"unit":"SQUARE_METERS"})
              const landKey = Object.keys(prop).find(k => k.startsWith('landArea'));
              const landVal = landKey ? prop[landKey] : null;
              if (landVal && typeof landVal === 'number' && landVal >= 50 && landVal < 100000) {
                data.fields.landSize = landVal;
              }
              if (prop.type) data.fields.propertyType = prop.type; // House, Unit, etc.
              // Timeline for sale history
              if (prop.timeline) {
                try {
                  const events = Array.isArray(prop.timeline) ? prop.timeline :
                    (prop.timeline.edges || []).map(e => e.node);
                  const saleEvent = events.find(e => e?.category === 'SOLD' || e?.__typename?.includes('Sale'));
                  if (saleEvent) {
                    const sp = saleEvent.price || saleEvent.amount;
                    if (sp && typeof sp === 'number' && sp > 100000) {
                      data.fields.lastSoldPrice = sp;
                      data.fields.lastSoldDate = saleEvent.date || null;
                    }
                  }
                } catch (e) { /* timeline parse failed */ }
              }
              if (Object.keys(data.fields).length > 0) data.ok = true;
            }
          }

          // ── Strategy B: Direct pageProps fields (legacy fallback) ──
          if (!data.ok) {
            const soldHistory = pp.soldHistory || pp.sales || pp.saleHistory;
            if (Array.isArray(soldHistory) && soldHistory.length > 0) {
              const latest = soldHistory[0];
              const soldPrice = latest.price || latest.soldPrice || latest.amount;
              if (soldPrice && typeof soldPrice === 'number') {
                data.fields.lastSoldPrice = soldPrice;
                data.fields.lastSoldDate = latest.date || latest.soldDate || null;
              }
            }
            const candidateLP = pp.listingPrice || pp.estimatedValue || pp.price;
            if (candidateLP && typeof candidateLP === 'number' && candidateLP > 100000) {
              if (!data.fields.lastSoldPrice || Math.abs(candidateLP - data.fields.lastSoldPrice) > 1000) {
                data.fields.listingPrice = candidateLP;
              }
            }
            if (pp.beds || pp.bedrooms) data.fields.beds = pp.beds || pp.bedrooms;
            if (pp.baths || pp.bathrooms) data.fields.baths = pp.baths || pp.bathrooms;
            if (pp.parking || pp.carSpaces) data.fields.cars = pp.parking || pp.carSpaces;
            const rawLand = pp.landSize || pp.landArea;
            if (rawLand && typeof rawLand === 'number' && rawLand >= 50 && rawLand < 100000) data.fields.landSize = rawLand;
            if (pp.propertyType) data.fields.propertyType = pp.propertyType;
            const rentHistory = pp.rentHistory || pp.rentalHistory || pp.rentals;
            if (Array.isArray(rentHistory) && rentHistory.length > 0) {
              const latestRent = rentHistory[0];
              const rentPrice = latestRent.price || latestRent.weeklyRent || latestRent.amount;
              if (rentPrice && typeof rentPrice === 'number') data.fields.listingRent = rentPrice;
            }
            if (Object.keys(data.fields).length > 0) data.ok = true;
          }
        }
      } catch (e) { /* JSON parse failed */ }
    }

    // Fallback: regex from rendered HTML
    if (!data.ok) {
      const priceGuide = rxNum(html, /Price\s*Guide[^$]*\$([0-9,]+)/i);
      if (priceGuide && priceGuide > 100000) { data.fields.listingPrice = priceGuide; data.ok = true; }
      const sold = rxNum(html, /(?:sold|sale\s*price|last\s*sold)[^$]*\$([0-9,]+)/i);
      if (sold && sold > 100000) { data.fields.lastSoldPrice = sold; data.ok = true; }
      const estimate = rxNum(html, /(?:estimated?\s*value|price\s*estimate)[^$]*\$([0-9,]+)/i);
      if (estimate && estimate > 100000 && !data.fields.listingPrice) { data.fields.listingPrice = estimate; data.ok = true; }
      const beds = rxNum(html, /(\d+)\s*(?:bed(?:room)?s?)\b/i);
      if (beds && beds <= 10) data.fields.beds = beds;
      const baths = rxNum(html, /(\d+)\s*(?:bath(?:room)?s?)\b/i);
      if (baths && baths <= 10) data.fields.baths = baths;
      const cars = rxNum(html, /(\d+)\s*(?:car\s*(?:space|park)?s?|garage)\b/i);
      if (cars && cars <= 10) data.fields.cars = cars;
      const land = rxNum(html, /(\d[\d,]+)\s*m[²2]/i);
      if (land && land >= 50 && land < 100000) data.fields.landSize = land;
      const rent = rxNum(html, /(?:rent(?:al)?\s*estimate|weekly\s*rent)[^$]*\$([0-9,]+)/i);
      if (rent && rent >= 100 && rent <= 3000) { data.fields.listingRent = rent; data.ok = true; }
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// REA (realestate.com.au) property profile: largest AU listing database
async function fetchREAPropertyProfile(street, suburb, state, postcode) {
  const data = { source: 'realestate.com.au', fields: {} };
  try {
    // REA uses ABBREVIATED street types: 75-lakedge-ave-berkeley-vale-nsw-2261
    const abbrevStreet = abbreviateStreet(street);
    const slug = `${abbrevStreet}-${suburb}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');

    // Strategy 1: REA property page — via ScraperAPI if key available, else direct
    try {
      const apiUrl = `https://www.realestate.com.au/property/${slug}-${state.toLowerCase()}-${postcode}`;
      const apiResp = await fetchViaScraperAPI(apiUrl);
      if (apiResp.ok) {
        const html = await apiResp.text();
        data.urlAttempted = apiUrl;
        data.htmlLength = html.length;
        // Check if we got actual content (not a captcha/redirect page)
        if (html.length > 5000 && !html.includes('captcha') && !html.includes('challenge-platform')) {
          return parseREAHtml(data, html);
        }
        data.error = `Got ${html.length} bytes but appears to be captcha/block page`;
      } else {
        data.error = `HTTP ${apiResp.status}`;
      }
    } catch (e) { data.error = e.message; }

    // Strategy 2: Try REA buy listing search — via ScraperAPI (REA blocks Vercel IPs)
    if (!data.ok) {
      try {
        const buyUrl = `https://www.realestate.com.au/buy/in-${suburb.toLowerCase().replace(/\s+/g, '-')},+${state.toLowerCase()}+${postcode}/list-1`;
        const buyResp = await fetchViaScraperAPI(buyUrl);
        if (buyResp.ok) {
          const buyHtml = await buyResp.text();
          data.urlAttempted = buyUrl;
          data.htmlLength = buyHtml.length;
          // Look for our specific address in buy results
          const addrPattern = street.replace(/\s+/g, '\\s+');
          const addrMatch = buyHtml.match(new RegExp(`${addrPattern}[\\s\\S]{0,500}?\\$([\\d,]+)`, 'i'));
          if (addrMatch) {
            const price = parseFloat(addrMatch[1].replace(/,/g, ''));
            if (price > 100000) {
              data.fields.listingPrice = price;
              data.ok = true;
            }
          }
          // Also try to extract rent estimate from buy listing
          const rentMatch = buyHtml.match(new RegExp(`${addrPattern}[\\s\\S]{0,1000}?\\$([\\d,]+)\\s*(?:/\\s*w|pw|per\\s*w)`, 'i'));
          if (rentMatch) {
            const rent = parseFloat(rentMatch[1].replace(/,/g, ''));
            if (rent >= 100 && rent <= 3000) data.fields.listingRent = rent;
          }
        }
      } catch (e) { /* buy search failed */ }
    }

    // Strategy 3: Try REA sold search — via ScraperAPI
    if (!data.ok) {
      try {
        const soldUrl = `https://www.realestate.com.au/sold/in-${suburb.toLowerCase().replace(/\s+/g, '-')},+${state.toLowerCase()}+${postcode}/list-1`;
        const soldResp = await fetchViaScraperAPI(soldUrl);
        if (soldResp.ok) {
          const soldHtml = await soldResp.text();
          const addrPattern = street.replace(/\s+/g, '\\s+');
          const addrMatch = soldHtml.match(new RegExp(`${addrPattern}[\\s\\S]{0,500}?\\$([\\d,]+)`, 'i'));
          if (addrMatch) {
            const soldPrice = parseFloat(addrMatch[1].replace(/,/g, ''));
            if (soldPrice > 100000) {
              data.fields.lastSoldPrice = soldPrice;
              data.ok = true;
            }
          }
        }
      } catch (e) { /* sold search failed */ }
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// Parse REA HTML content (extracted to share between strategies)
function parseREAHtml(data, html) {
  try {
    // REA uses ArgonautExchange or __NEXT_DATA__ for property data
    const argMatch = html.match(/window\.ArgonautExchange\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i);
    if (argMatch) {
      try {
        const argData = JSON.parse(argMatch[1]);
        const details = argData?.rpiRecentSales || argData?.propertyDetails || argData;
        if (details) {
          const soldPrice = details.lastSoldPrice || details.price?.soldPrice;
          if (soldPrice && typeof soldPrice === 'number') data.fields.lastSoldPrice = soldPrice;
          const estimate = details.valuation?.mid || details.estimatedValue || details.priceEstimate?.midPrice;
          if (estimate && typeof estimate === 'number') data.fields.listingPrice = estimate;
          if (details.bedrooms || details.beds) data.fields.beds = details.bedrooms || details.beds;
          if (details.bathrooms || details.baths) data.fields.baths = details.bathrooms || details.baths;
          if (details.carSpaces || details.parking) data.fields.cars = details.carSpaces || details.parking;
          const ld = details.landSize || details.landArea;
          if (ld && typeof ld === 'number' && ld >= 50) data.fields.landSize = ld;
          if (details.propertyType) data.fields.propertyType = details.propertyType;
          // REA rental estimate
          const rentEst = details.rentalEstimate || details.rental?.weeklyRent;
          if (rentEst && typeof rentEst === 'number' && rentEst >= 100 && rentEst <= 3000) data.fields.listingRent = rentEst;
          if (Object.keys(data.fields).length > 0) data.ok = true;
        }
      } catch (e) { /* ArgonautExchange parse failed */ }
    }

    // Try __NEXT_DATA__ too
    if (!data.ok) {
      const nextMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      if (nextMatch) {
        try {
          const nd = JSON.parse(nextMatch[1]);
          const pp = nd?.props?.pageProps;
          if (pp?.property || pp?.listing) {
            const prop = pp.property || pp.listing;
            if (prop.price) data.fields.listingPrice = typeof prop.price === 'number' ? prop.price : parseFloat(String(prop.price).replace(/[^0-9.]/g, ''));
            if (prop.bedrooms) data.fields.beds = prop.bedrooms;
            if (prop.bathrooms) data.fields.baths = prop.bathrooms;
            if (prop.carSpaces || prop.parking) data.fields.cars = prop.carSpaces || prop.parking;
            const ld2 = prop.landSize;
            if (ld2 && typeof ld2 === 'number' && ld2 >= 50) data.fields.landSize = ld2;
            if (prop.propertyType) data.fields.propertyType = prop.propertyType;
            if (Object.keys(data.fields).length > 0) data.ok = true;
          }
        } catch (e) { /* parse failed */ }
      }
    }

    // Final regex fallback
    if (!data.ok) {
      const sold = rxNum(html, /(?:sold|sale\s*price|last\s*sold)[^$]*\$([0-9,]+)/i);
      if (sold && sold > 100000) { data.fields.lastSoldPrice = sold; data.ok = true; }
      const estimate = rxNum(html, /(?:estimated?\s*value|price\s*estimate|price\s*guide)[^$]*\$([0-9,]+)/i);
      if (estimate && estimate > 100000) { data.fields.listingPrice = estimate; data.ok = true; }
      const beds = rxNum(html, /(\d+)\s*(?:bed(?:room)?s?)\b/i);
      if (beds && beds <= 10) data.fields.beds = beds;
      const baths = rxNum(html, /(\d+)\s*(?:bath(?:room)?s?)\b/i);
      if (baths && baths <= 10) data.fields.baths = baths;
      const land = rxNum(html, /(\d+)\s*m[²2]/i);
      if (land && land > 50 && land < 100000) data.fields.landSize = land;
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE 1: Suburb-level data sources
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

// ─── SOURCE 6: Property.com.au ───
async function fetchPropertyComAu(suburb, state, postcode) {
  const data = { source: 'Property.com.au', fields: {} };
  try {
    const slug = suburb.toLowerCase().replace(/\s+/g, '-');
    const url = `https://www.property.com.au/${slug}-${state.toLowerCase()}-${postcode}/`;
    data.urlAttempted = url;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) { data.error = `HTTP ${resp.status}`; return data; }
    const html = await resp.text();
    // More specific regex patterns to avoid grabbing wrong numbers
    const mp = rxNum(html, /median\s*(?:house|sold)?\s*price[^$]*\$([0-9,]+)/i);
    if (mp) data.fields.medianPrice = mp;
    const rent = rxNum(html, /median\s*(?:weekly\s*)?rent\s*(?:house)?[^$]*\$([0-9,]+)\s*(?:\/?\s*w(?:ee)?k|pw)/i);
    if (rent) data.fields.weeklyRent = rent;
    const dom = rxNum(html, /(\d+)\s*(?:average\s*)?days?\s*(?:on\s*market|to\s*sell)/i);
    if (dom) data.fields.daysOnMarket = dom;
    const growth = rxNum(html, /(?:annual|yearly|12[- ]month)\s*(?:capital\s*)?growth[^0-9]*([0-9.]+)\s*%/i);
    if (growth) data.fields.annualGrowth = growth;
    if (Object.keys(data.fields).length > 0) data.ok = true;
    else data.htmlSnippet = html.slice(0, 500);
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
        data.urlAttempted = url;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok) { data.error = `HTTP ${resp.status}`; continue; }
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
          else data.htmlSnippet = html.slice(0, 500);
        }
      } catch (e) { data.error = e.message; continue; }
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// ─── SOURCE 8: SQM Research (authoritative rent + price) ───
async function fetchSQM(postcode) {
  const data = { source: 'SQM Research', fields: {} };
  try {
    // Weekly rents page — render=true because SQM uses JS to populate table
    const rentResp = await fetchViaScraperAPI(
      `https://sqmresearch.com.au/weekly-rents.php?postcode=${postcode}&t=1`,
      25000, true
    );
    if (rentResp.ok) {
      const html = await rentResp.text();
      data.htmlSnippet = html.slice(0, 800); // debug: first 800 chars
      // Pattern 1: table row — <td>Houses</td><td>$750</td> ($ optional)
      const p1 = rxNum(html, /Houses<\/t[dh]>\s*<t[dh][^>]*>\s*\$?([0-9,]+)/i);
      // Pattern 2: "All Houses $750" or "Houses Median $750"
      const p2 = rxNum(html, /(?:All\s*)?Houses?\s*(?:Median)?[^$\d]{0,30}\$([0-9,]+)/i);
      // Pattern 3: JS chart data — ['Houses', 750] or "Houses":750
      const p3 = rxNum(html, /['"](H|h)ouses?['"][^0-9]{0,20}([4-9][0-9]{2}|[1-9][0-9]{3})/);
      const p3val = (() => { const m = html.match(/['"](H|h)ouses?['"][^0-9]{0,20}([4-9][0-9]{2}|[1-9][0-9]{3})/); return m ? parseFloat(m[2]) : null; })();
      // Pattern 4: any number 300-2000 near "asking" and "house"
      const p4 = rxNum(html, /asking[^$]{0,200}?houses?[^$\d]{0,30}([4-9][0-9]{2}|[1-9][0-9]{3})/i)
               || rxNum(html, /houses?[^$]{0,200}?asking[^$\d]{0,30}([4-9][0-9]{2}|[1-9][0-9]{3})/i);
      const houseRent = p1 || p2 || p3val || p4;
      if (houseRent && houseRent >= 200 && houseRent <= 2000) data.fields.weeklyRent = houseRent;
      // Vacancy rate
      const vr = rxNum(html, /vacancy\s*rate[^0-9]*([0-9.]+)\s*%/i);
      if (vr) data.fields.vacancyRate = vr;
      if (Object.keys(data.fields).length > 0) data.ok = true;
      else data.error = `no_match (${html.length}b): ${html.slice(0, 200).replace(/\s+/g, ' ')}`;
    } else {
      data.error = `HTTP ${rentResp.status}`;
    }
  } catch (e) { data.error = `rent_err: ${e.message}`; }

  try {
    // Median price graph
    const priceResp = await fetchViaScraperAPI(`https://sqmresearch.com.au/graph.php?postcode=${postcode}&mode=6&t=1`);
    if (priceResp.ok) {
      const html = await priceResp.text();
      const mp = rxNum(html, /(?:Median|Current)\s*(?:House)?\s*Price[^$]*\$([0-9,]+)/i);
      if (mp) { data.fields.medianPrice = mp; data.ok = true; }
      const chartPrice = rxNum(html, /"(?:median|price|y)"[:\s]*([0-9]+(?:\.[0-9]+)?)/i);
      if (chartPrice && chartPrice > 100000 && !data.fields.medianPrice) {
        data.fields.medianPrice = chartPrice; data.ok = true;
      }
    }
  } catch (e) { /* SQM price failed */ }

  return data;
}

// ─── SOURCE 9: Domain Suburb Profile (__NEXT_DATA__ JSON) ───
async function fetchDomainProfile(suburb, state, postcode) {
  const data = { source: 'Domain Profile', fields: {} };
  try {
    const slug = suburb.toLowerCase().replace(/\s+/g, '-');
    const url = `https://www.domain.com.au/suburb-profile/${slug}-${state.toLowerCase()}-${postcode}`;
    // Domain blocks Vercel IPs — use ScraperAPI if available
    const resp = await fetchViaScraperAPI(url);
    if (!resp.ok) { data.error = `HTTP ${resp.status}`; return data; }
    const html = await resp.text();

    // Try __NEXT_DATA__ JSON first (structured, most reliable)
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const props = nextData?.props?.pageProps;
        if (props) {
          // Deep-search for suburb stats in nested JSON
          const stats = props.suburbProfile || props.suburbData || props;
          // Look for house-specific data first, then general
          const houseStats = stats.house || stats.houses || stats.propertyTypeStats?.house || stats;

          // Median price: prefer house median
          const mp = houseStats.medianSoldPrice || houseStats.medianPrice || stats.medianSoldPrice || stats.medianPrice;
          if (mp && typeof mp === 'number' && mp > 100000) data.fields.medianPrice = mp;

          // Weekly rent: ONLY accept house median, reject combined/unit values
          const houseRent = houseStats.medianRentPrice || houseStats.medianWeeklyRent;
          const generalRent = stats.medianRentPrice || stats.medianWeeklyRent || stats.medianRent;
          // Use house rent if available, otherwise general but validate range
          const rentVal = houseRent || generalRent;
          if (rentVal && typeof rentVal === 'number' && rentVal >= 100 && rentVal <= 2000) {
            data.fields.weeklyRent = rentVal;
          }

          if (stats.daysOnMarket || stats.avgDaysOnMarket || houseStats.daysOnMarket) {
            data.fields.daysOnMarket = houseStats.daysOnMarket || stats.daysOnMarket || stats.avgDaysOnMarket;
          }
          if (stats.annualGrowth || stats.medianPriceGrowth || houseStats.annualGrowth) {
            data.fields.annualGrowth = houseStats.annualGrowth || stats.annualGrowth || stats.medianPriceGrowth;
          }
          if (stats.rentalYield || houseStats.rentalYield) data.fields.grossYield = houseStats.rentalYield || stats.rentalYield;
          if (stats.numberSold || stats.salesCount || houseStats.numberSold) {
            data.fields.annualSales = houseStats.numberSold || stats.numberSold || stats.salesCount;
          }
          if (Object.keys(data.fields).length > 0) data.ok = true;
        }
      } catch (e) { /* JSON parse failed, fall through to regex */ }
    }

    // Fallback: regex — use STRICT patterns to avoid grabbing wrong numbers
    if (!data.ok) {
      // House median price: match "$X,XXX,XXX" right after "house" context
      const mp = rxNum(html, /(?:house|houses)\s*(?:median)?\s*(?:sold)?\s*(?:price)?[^$]*\$([0-9,]+)/i)
              || rxNum(html, /median\s*(?:sold)?\s*price\s*(?:for\s*)?(?:house|houses)[^$]*\$([0-9,]+)/i);
      if (mp && mp > 100000) data.fields.medianPrice = mp;
      // House rent: must have "house" context AND "/w" or "pw" or "per week"
      const rent = rxNum(html, /(?:house|houses)\s*(?:median)?\s*(?:weekly)?\s*rent[^$]*\$([0-9,]+)\s*(?:\/?\s*w|pw|per\s*w)/i);
      if (rent && rent >= 100 && rent <= 2000) data.fields.weeklyRent = rent;
      const dom = rxNum(html, /(?:house|houses)[^0-9]*(\d+)\s*(?:average\s*)?days?\s*(?:on\s*market|to\s*sell)/i);
      if (dom) data.fields.daysOnMarket = dom;
      if (Object.keys(data.fields).length > 0) data.ok = true;
    }
  } catch (e) { data.error = e.message; }
  return data;
}

// ─── SOURCE 10: NSW ArcGIS — Flood & Bushfire ───
// Suburb centroid coordinates for common suburbs (expandable)
const SUBURB_COORDS = {
  'BERKELEY VALE': [-33.343, 151.434],
  'TUGGERAH': [-33.307, 151.416],
  'GOSFORD': [-33.426, 151.342],
  'WYONG': [-33.283, 151.422],
  'THE ENTRANCE': [-33.341, 151.498],
  'ERINA': [-33.437, 151.389],
  'WOY WOY': [-33.485, 151.324],
  'BLACKTOWN': [-33.771, 150.906],
  'PARRAMATTA': [-33.815, 151.001],
  'LIVERPOOL': [-33.920, 150.924],
  'PENRITH': [-33.751, 150.694],
  'NEWCASTLE': [-32.926, 151.776],
  'WOLLONGONG': [-34.424, 150.893],
  'BANKSTOWN': [-33.918, 151.035],
};

async function fetchFloodBushfire(suburb, state) {
  const data = { source: 'NSW Hazard Maps', fields: {} };
  if (state !== 'NSW') return data; // Only NSW ArcGIS for now

  const coords = SUBURB_COORDS[suburb];
  if (!coords) return data; // No coordinates available

  const [lat, lng] = coords;
  const geom = JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } });

  // Bushfire Prone Land query
  try {
    const bfUrl = `https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/ePlanning/Planning_Portal_Hazard/MapServer/229/query?geometry=${encodeURIComponent(geom)}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json`;
    const bfResp = await fetchWithTimeout(bfUrl);
    if (bfResp.ok) {
      const json = await bfResp.json();
      if (json.features && json.features.length > 0) {
        const cat = json.features[0].attributes?.Category || json.features[0].attributes?.category || 'Yes';
        data.fields.bushfireRisk = `Bushfire Prone Land — ${cat}`;
      } else {
        data.fields.bushfireRisk = 'Not in Bushfire Prone Land';
      }
      data.ok = true;
    }
  } catch (e) { /* bushfire query failed */ }

  // Flood Planning query
  try {
    const flUrl = `https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/Hazard/MapServer/1/query?geometry=${encodeURIComponent(geom)}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json`;
    const flResp = await fetchWithTimeout(flUrl);
    if (flResp.ok) {
      const json = await flResp.json();
      if (json.features && json.features.length > 0) {
        data.fields.floodZone = 'Flood Planning Area — confirmed';
      } else {
        data.fields.floodZone = 'Not in Flood Planning Area';
      }
      data.ok = true;
    }
  } catch (e) { /* flood query failed */ }

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
// Last updated: manually curated from CoreLogic/Domain data
const FALLBACK_DB_UPDATED_AT = '2025-01';
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

  // Extract street from full address for individual listing lookup
  const fullAddress = (address || '').trim();
  const streetMatch = fullAddress.match(/^(\d+[a-z]?\s+[\w\s]+?(?:ave(?:nue)?|st(?:reet)?|rd|road|dr(?:ive)?|pl(?:ace)?|ct|court|cres(?:cent)?|way|la(?:ne)?|ln|blvd|boulevard|tce|terrace|pde|parade|cl(?:ose)?|cct|circuit))\b/i);
  // Fallback: if regex fails, extract everything before suburb/state/postcode
  let street = streetMatch ? streetMatch[1].trim() : '';
  if (!street && s && fullAddress) {
    const suburbIdx = fullAddress.toUpperCase().indexOf(s);
    if (suburbIdx > 0) {
      street = fullAddress.substring(0, suburbIdx).replace(/[,\s]+$/, '').trim();
    }
  }

  // ── Phase 0 + Phase 1: Run ALL sources in parallel ──
  // Phase 0 = individual listing lookup (REA + Domain property profile)
  // Phase 1 = suburb-level data (12 sources)
  const allResults = await Promise.allSettled([
    // Phase 0: Individual listing (runs in parallel with Phase 1)
    street ? fetchREAPropertyProfile(street, s, st, pc) : Promise.resolve({ source: 'realestate.com.au', fields: {} }),
    street ? fetchDomainPropertyProfile(street, s, st, pc) : Promise.resolve({ source: 'Domain Property Profile', fields: {} }),
    // Phase 1: Suburb-level sources
    fetchBoomScore(s, st, pc),        // 1. Demand/Supply
    fetchHtag(s, st, pc),             // 1b. Demand/Supply
    fetchLandchecker(s, st, pc),      // 2. Property type/Income
    fetchRemplan(s, st),              // 3. Economy/Community
    fetchMicroburbs(s, st),           // 4. Affluence/Crime
    fetchOpenStats(s),                // 5. Crime/Socio-economic
    fetchPropertyComAu(s, st, pc),    // 6. Property.com.au
    fetchSuburbsFinder(s, st, pc),    // 7. Cash flow metrics
    fetchSQM(pc),                     // 8. SQM Research (rent + price authority)
    fetchDomainProfile(s, st, pc),    // 9. Domain structured data
    fetchFloodBushfire(s, st),        // 10. NSW Flood/Bushfire ArcGIS
    fetchABS(pc),                     // 11. Census data
  ]);

  // Separate Phase 0 (individual listing) from Phase 1 (suburb data)
  const listingResults = allResults.slice(0, 2).map(r => r.status === 'fulfilled' ? r.value : { source: 'unknown', fields: {} });
  const webResults = allResults.slice(2).map(r => r.status === 'fulfilled' ? r.value : { source: 'unknown', error: 'rejected' });

  // Extract individual listing data (price, rent, beds, baths, etc.)
  let listingData = {};
  const listingSources = [];
  for (const lr of listingResults) {
    if (lr.ok) {
      listingSources.push(lr.source);
      // Listing-specific fields: listingPrice, listingRent, lastSoldPrice, beds, baths, cars, landSize
      for (const [key, val] of Object.entries(lr.fields)) {
        if (val !== undefined && val !== null && !listingData[key]) {
          listingData[key] = val;
        }
      }
    }
  }

  const allSources = webResults;
  let successSources = allSources.filter(s => s.ok);

  // ── SMART DATA VALIDATION ──
  // Instead of blindly merging, validate each scraped field properly
  const VALID_RANGES = {
    medianPrice:      [100000, 20000000],
    weeklyRent:       [100, 5000],
    population:       [100, 5000000],
    popGrowth:        [-10, 50],
    medianIncomeWeekly: [300, 10000],
    incomeGrowth:     [-10, 100],
    vacancyRate:      [0, 30],
    ownerOccRate:     [10, 100],
    annualGrowth:     [-20, 50],
    daysOnMarket:     [1, 365],
    annualSales:      [1, 10000],
    boomScore:        [0, 100],
    grossYield:       [0.5, 20],
    affluenceScore:   [0, 100],
    crimeRate:        [0, 50000],
    seifaIndex:       [500, 1200],
  };

  const fallback = FALLBACK_DB[s] || {};

  // ── TRUSTED SOURCES: SQM & Domain Profile are higher reliability ──
  const TRUSTED_SOURCES = ['SQM Research', 'Domain Profile'];

  // Step 1: Collect ALL values per field from every source
  const fieldCandidates = {};
  for (const src of successSources) {
    for (const [key, val] of Object.entries(src.fields || {})) {
      if (val === undefined || val === null) continue;
      if (typeof val === 'number' && VALID_RANGES[key]) {
        const [min, max] = VALID_RANGES[key];
        if (val < min || val > max) continue;
      }
      if (!fieldCandidates[key]) fieldCandidates[key] = [];
      fieldCandidates[key].push({ value: val, source: src.source, trusted: TRUSTED_SOURCES.includes(src.source) });
    }
  }

  // Step 2: Smart field selection with source trust hierarchy
  let liveFields = {};
  for (const [key, candidates] of Object.entries(fieldCandidates)) {
    if (candidates.length === 0) continue;

    const numCandidates = candidates.filter(c => typeof c.value === 'number');
    const trustedCandidates = numCandidates.filter(c => c.trusted);
    const strCandidates = candidates.filter(c => typeof c.value === 'string');

    // String fields (floodZone, bushfireRisk, zoning): prefer NSW Hazard Maps
    if (strCandidates.length > 0 && numCandidates.length === 0) {
      const hazardSource = strCandidates.find(c => c.source === 'NSW Hazard Maps');
      liveFields[key] = hazardSource ? hazardSource.value : strCandidates[0].value;
      continue;
    }

    // Numeric fields: trust hierarchy
    if (trustedCandidates.length >= 2) {
      // 2+ trusted sources agree: use their median
      const sorted = trustedCandidates.map(c => c.value).sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      liveFields[key] = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    } else if (trustedCandidates.length === 1) {
      // 1 trusted source: use it BUT cross-validate against untrusted median if available
      const trustedVal = trustedCandidates[0].value;
      const untrustedNums = numCandidates.filter(c => !c.trusted);
      if (untrustedNums.length >= 2) {
        // Cross-check trusted vs untrusted median — if trusted is >1.8x off, use untrusted median
        const sorted = untrustedNums.map(c => c.value).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const untrustedMedian = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        const ratio = trustedVal / untrustedMedian;
        if (ratio > 1.8 || ratio < 0.5) {
          // Trusted source is way off from untrusted consensus → use untrusted median
          liveFields[key] = untrustedMedian;
        } else {
          liveFields[key] = trustedVal;
        }
      } else if (fallback[key] !== undefined) {
        // Cross-check trusted vs DB — if >1.8x off, flag it
        const ratio = trustedVal / fallback[key];
        if (ratio > 1.8 || ratio < 0.5) {
          // Trusted but suspicious — skip, let fallback fill it
        } else {
          liveFields[key] = trustedVal;
        }
      } else {
        liveFields[key] = trustedVal;
      }

    } else if (numCandidates.length >= 2) {
      // No trusted, but 2+ untrusted: use median
      const sorted = numCandidates.map(c => c.value).sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      liveFields[key] = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    } else if (numCandidates.length === 1) {
      // Single untrusted source: cross-check against DB if available
      const scraped = numCandidates[0].value;
      if (fallback[key] !== undefined) {
        const ratio = scraped / fallback[key];
        if (ratio > 3 || ratio < 0.2) {
          // Too far from DB → discard (DB used later as fallback)
        } else {
          liveFields[key] = scraped;
        }
      } else {
        liveFields[key] = scraped;
      }
    }
  }

  // Step 3: Cross-field consistency checks
  // 3a: If Phase 0 has listing rent, use it to validate suburb weeklyRent
  if (listingData.listingRent && liveFields.weeklyRent) {
    const listingRent = listingData.listingRent;
    const suburbRent = liveFields.weeklyRent;
    // If suburb rent is >2x the listing rent, suburb data is likely wrong
    if (suburbRent > listingRent * 2) {
      delete liveFields.weeklyRent;
      delete liveFields.grossYield;
    }
  }
  // 3b: Yield-based consistency check
  const checkPrice = liveFields.medianPrice || fallback.medianPrice;
  const checkRent  = liveFields.weeklyRent;
  if (checkPrice && checkRent && typeof checkPrice === 'number' && typeof checkRent === 'number') {
    const impliedYield = (checkRent * 52) / checkPrice * 100;
    if (impliedYield > 12 || impliedYield < 1) {
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
    // Individual listing data (from REA / Domain property profile)
    listing: Object.keys(listingData).length > 0 ? {
      listingPrice: listingData.listingPrice || null,
      listingRent: listingData.listingRent || null,
      lastSoldPrice: listingData.lastSoldPrice || null,
      lastSoldDate: listingData.lastSoldDate || null,
      beds: listingData.beds || null,
      baths: listingData.baths || null,
      cars: listingData.cars || null,
      landSize: listingData.landSize || null,
      propertyType: listingData.propertyType || null,
      sources: listingSources,
    } : null,
    sources: [...listingSources, ...successSources.map(s => s.source)],
    // Debug: Phase 0 listing attempts
    listingDebug: listingResults.map(lr => ({
      source: lr.source,
      ok: !!lr.ok,
      url: lr.urlAttempted || null,
      htmlLen: lr.htmlLength || 0,
      error: lr.error || null,
      fields: lr.ok ? Object.keys(lr.fields) : [],
    })),
    // Debug: which sources provided each key investment field
    fieldSources: Object.fromEntries(
      Object.entries(fieldCandidates)
        .filter(([k]) => ['weeklyRent','medianPrice','annualGrowth','vacancyRate','daysOnMarket','boomScore','grossYield','annualSales'].includes(k))
        .map(([k, cands]) => [k, cands.map(c => ({ src: c.source, val: c.value, trusted: c.trusted }))])
    ),
    failedSources: failedSources.map(s => ({ source: s.source, error: s.error, url: s.urlAttempted || null, htmlSnippet: s.htmlSnippet || null })),
    scraperApiEnabled: !!process.env.SCRAPER_API_KEY,
    liveFieldCount: Object.keys(liveFields).length,
    dataSource: successSources.length > 0
      ? `live(${successSources.length + listingSources.length}/${allSources.length + 2 + (claudeResult ? 1 : 0)})`
      : (hasFallback ? 'database' : 'defaults'),
    usedClaude: !!claudeResult?.ok,
    // Show staleness warning when core investment metrics (price OR rent) come from FALLBACK_DB
    fallbackUpdatedAt: ((!liveFields.medianPrice || !liveFields.weeklyRent) && hasFallback) ? FALLBACK_DB_UPDATED_AT : null,
  };

  return res.status(200).json(result);
}

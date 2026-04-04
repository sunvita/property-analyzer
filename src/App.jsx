import { useState, useMemo, useCallback } from "react";

// ─── Embedded Suburb Database ───
const SUBURB_DATA = {
  'BERKELEY VALE': { postcode:'2261', state:'NSW', medianPrice:935000, weeklyRent:680, population:8951, popGrowth:7.13, medianIncomeWeekly:1780, incomeGrowth:27.78, vacancyRate:1.0, ownerOccRate:77.1, annualGrowth:5.65, daysOnMarket:26, annualSales:149, boomScore:52, zoning:'R2 Low Density', nearestStationKm:4.0 },
  'TUGGERAH': { postcode:'2259', state:'NSW', medianPrice:850000, weeklyRent:620, population:3500, popGrowth:5.2, medianIncomeWeekly:1650, incomeGrowth:22.0, vacancyRate:0.8, ownerOccRate:72.0, annualGrowth:6.2, daysOnMarket:28, annualSales:95, boomScore:55, zoning:'R2 Low Density', nearestStationKm:0.3 },
  'WYONG': { postcode:'2259', state:'NSW', medianPrice:780000, weeklyRent:580, population:4200, popGrowth:4.8, medianIncomeWeekly:1500, incomeGrowth:20.0, vacancyRate:0.9, ownerOccRate:68.0, annualGrowth:5.8, daysOnMarket:32, annualSales:120, boomScore:48, zoning:'R2 Low Density', nearestStationKm:0.2 },
  'GOSFORD': { postcode:'2250', state:'NSW', medianPrice:920000, weeklyRent:650, population:5800, popGrowth:6.0, medianIncomeWeekly:1700, incomeGrowth:25.0, vacancyRate:0.7, ownerOccRate:65.0, annualGrowth:8.4, daysOnMarket:24, annualSales:180, boomScore:60, zoning:'R2 Low Density', nearestStationKm:0.1 },
  'THE ENTRANCE': { postcode:'2261', state:'NSW', medianPrice:870000, weeklyRent:600, population:4100, popGrowth:3.5, medianIncomeWeekly:1400, incomeGrowth:18.0, vacancyRate:1.2, ownerOccRate:60.0, annualGrowth:4.5, daysOnMarket:35, annualSales:110, boomScore:45, zoning:'R3 Medium Density', nearestStationKm:2.5 },
  'ERINA': { postcode:'2250', state:'NSW', medianPrice:1100000, weeklyRent:750, population:5500, popGrowth:4.0, medianIncomeWeekly:1900, incomeGrowth:22.0, vacancyRate:0.8, ownerOccRate:78.0, annualGrowth:6.0, daysOnMarket:22, annualSales:90, boomScore:58, zoning:'R2 Low Density', nearestStationKm:3.0 },
  'WOY WOY': { postcode:'2256', state:'NSW', medianPrice:950000, weeklyRent:660, population:5000, popGrowth:5.5, medianIncomeWeekly:1600, incomeGrowth:24.0, vacancyRate:0.9, ownerOccRate:72.0, annualGrowth:5.5, daysOnMarket:30, annualSales:105, boomScore:50, zoning:'R2 Low Density', nearestStationKm:0.3 },
  'BLACKTOWN': { postcode:'2148', state:'NSW', medianPrice:880000, weeklyRent:550, population:47000, popGrowth:8.0, medianIncomeWeekly:1650, incomeGrowth:25.0, vacancyRate:1.5, ownerOccRate:62.0, annualGrowth:7.2, daysOnMarket:25, annualSales:350, boomScore:55, zoning:'R2 Low Density', nearestStationKm:0.2 },
  'PARRAMATTA': { postcode:'2150', state:'NSW', medianPrice:1200000, weeklyRent:650, population:30000, popGrowth:10.0, medianIncomeWeekly:1800, incomeGrowth:28.0, vacancyRate:1.2, ownerOccRate:55.0, annualGrowth:6.5, daysOnMarket:22, annualSales:280, boomScore:62, zoning:'R4 High Density', nearestStationKm:0.1 },
  'LIVERPOOL': { postcode:'2170', state:'NSW', medianPrice:850000, weeklyRent:530, population:27000, popGrowth:7.5, medianIncomeWeekly:1550, incomeGrowth:23.0, vacancyRate:1.8, ownerOccRate:60.0, annualGrowth:6.8, daysOnMarket:28, annualSales:250, boomScore:50, zoning:'R3 Medium Density', nearestStationKm:0.3 },
  'PENRITH': { postcode:'2750', state:'NSW', medianPrice:820000, weeklyRent:520, population:13000, popGrowth:6.5, medianIncomeWeekly:1500, incomeGrowth:22.0, vacancyRate:1.5, ownerOccRate:65.0, annualGrowth:7.0, daysOnMarket:30, annualSales:200, boomScore:48, zoning:'R2 Low Density', nearestStationKm:0.2 },
  'GLENNING VALLEY': { postcode:'2261', state:'NSW', medianPrice:1255000, weeklyRent:750, population:4000, popGrowth:8.5, medianIncomeWeekly:2000, incomeGrowth:30.0, vacancyRate:0.6, ownerOccRate:82.0, annualGrowth:23.0, daysOnMarket:18, annualSales:60, boomScore:72, zoning:'R2 Low Density', nearestStationKm:3.5 },
  'NEWCASTLE': { postcode:'2300', state:'NSW', medianPrice:1068000, weeklyRent:706, population:4500, popGrowth:5.0, medianIncomeWeekly:1600, incomeGrowth:20.0, vacancyRate:1.0, ownerOccRate:58.0, annualGrowth:5.5, daysOnMarket:28, annualSales:150, boomScore:55, zoning:'R3 Medium Density', nearestStationKm:0.5 },
  'WOLLONGONG': { postcode:'2500', state:'NSW', medianPrice:1300000, weeklyRent:600, population:15000, popGrowth:4.5, medianIncomeWeekly:1700, incomeGrowth:22.0, vacancyRate:1.2, ownerOccRate:60.0, annualGrowth:5.0, daysOnMarket:30, annualSales:200, boomScore:50, zoning:'R3 Medium Density', nearestStationKm:0.3 },
  'BANKSTOWN': { postcode:'2200', state:'NSW', medianPrice:1670000, weeklyRent:750, population:35000, popGrowth:9.0, medianIncomeWeekly:1500, incomeGrowth:22.0, vacancyRate:1.3, ownerOccRate:55.0, annualGrowth:26.3, daysOnMarket:20, annualSales:300, boomScore:70, zoning:'R3 Medium Density', nearestStationKm:0.1 },
  'MOUNT DRUITT': { postcode:'2770', state:'NSW', medianPrice:750000, weeklyRent:500, population:15000, popGrowth:7.0, medianIncomeWeekly:1300, incomeGrowth:20.0, vacancyRate:1.5, ownerOccRate:55.0, annualGrowth:5.6, daysOnMarket:25, annualSales:180, boomScore:48, zoning:'R2 Low Density', nearestStationKm:0.2 },
  'ST MARYS': { postcode:'2760', state:'NSW', medianPrice:800000, weeklyRent:520, population:12000, popGrowth:8.0, medianIncomeWeekly:1400, incomeGrowth:22.0, vacancyRate:1.3, ownerOccRate:58.0, annualGrowth:15.1, daysOnMarket:22, annualSales:160, boomScore:58, zoning:'R2 Low Density', nearestStationKm:0.1 },
  'QUAKERS HILL': { postcode:'2763', state:'NSW', medianPrice:950000, weeklyRent:600, population:28000, popGrowth:5.5, medianIncomeWeekly:1700, incomeGrowth:24.0, vacancyRate:1.2, ownerOccRate:75.0, annualGrowth:4.5, daysOnMarket:28, annualSales:150, boomScore:50, zoning:'R2 Low Density', nearestStationKm:0.5 },
  'CHITTAWAY BAY': { postcode:'2261', state:'NSW', medianPrice:900000, weeklyRent:650, population:3200, popGrowth:5.0, medianIncomeWeekly:1700, incomeGrowth:24.0, vacancyRate:0.9, ownerOccRate:75.0, annualGrowth:5.5, daysOnMarket:28, annualSales:80, boomScore:50, zoning:'R2 Low Density', nearestStationKm:3.5 },
  'KILLARNEY VALE': { postcode:'2261', state:'NSW', medianPrice:880000, weeklyRent:640, population:6500, popGrowth:4.5, medianIncomeWeekly:1650, incomeGrowth:22.0, vacancyRate:1.0, ownerOccRate:72.0, annualGrowth:5.2, daysOnMarket:30, annualSales:100, boomScore:48, zoning:'R2 Low Density', nearestStationKm:3.8 },
  'BATEAU BAY': { postcode:'2261', state:'NSW', medianPrice:950000, weeklyRent:680, population:7000, popGrowth:4.0, medianIncomeWeekly:1750, incomeGrowth:22.0, vacancyRate:0.8, ownerOccRate:76.0, annualGrowth:5.8, daysOnMarket:25, annualSales:110, boomScore:52, zoning:'R2 Low Density', nearestStationKm:4.5 },
  'TERRIGAL': { postcode:'2260', state:'NSW', medianPrice:1350000, weeklyRent:780, population:8500, popGrowth:3.5, medianIncomeWeekly:2000, incomeGrowth:20.0, vacancyRate:0.7, ownerOccRate:80.0, annualGrowth:5.5, daysOnMarket:22, annualSales:120, boomScore:55, zoning:'R2 Low Density', nearestStationKm:6.0 },
  'TOUKLEY': { postcode:'2263', state:'NSW', medianPrice:750000, weeklyRent:530, population:5500, popGrowth:5.5, medianIncomeWeekly:1400, incomeGrowth:22.0, vacancyRate:1.0, ownerOccRate:65.0, annualGrowth:6.5, daysOnMarket:28, annualSales:130, boomScore:50, zoning:'R2 Low Density', nearestStationKm:4.0 },
  'UMINA BEACH': { postcode:'2257', state:'NSW', medianPrice:1000000, weeklyRent:680, population:8000, popGrowth:5.0, medianIncomeWeekly:1600, incomeGrowth:24.0, vacancyRate:0.8, ownerOccRate:70.0, annualGrowth:6.0, daysOnMarket:26, annualSales:140, boomScore:54, zoning:'R2 Low Density', nearestStationKm:1.5 },
  'ETTALONG BEACH': { postcode:'2257', state:'NSW', medianPrice:1050000, weeklyRent:700, population:4500, popGrowth:4.5, medianIncomeWeekly:1650, incomeGrowth:22.0, vacancyRate:0.7, ownerOccRate:68.0, annualGrowth:5.8, daysOnMarket:24, annualSales:80, boomScore:52, zoning:'R2 Low Density', nearestStationKm:1.8 },
};

// ─── TOD / LMR Data ───
const TOD_STATIONS = [
  { name: 'Tuggerah Station', lat: -33.3075, lng: 151.4170, radius: 400 },
  { name: 'Wyong Station', lat: -33.2840, lng: 151.4235, radius: 400 },
  { name: 'Gosford Station', lat: -33.4245, lng: 151.3420, radius: 400 },
  { name: 'Woy Woy Station', lat: -33.4855, lng: 151.3235, radius: 400 },
];
const LMR_CENTRES = [
  { name: 'Westfield Tuggerah', lat: -33.3100, lng: 151.4140, radius: 800 },
  { name: 'Erina Fair', lat: -33.4370, lng: 151.3880, radius: 800 },
  { name: 'The Entrance Town Centre', lat: -33.3400, lng: 151.4950, radius: 800 },
  { name: 'Wyong Town Centre', lat: -33.2840, lng: 151.4235, radius: 800 },
  { name: 'Gosford Town Centre', lat: -33.4245, lng: 151.3420, radius: 800 },
  { name: 'Woy Woy Town Centre', lat: -33.4855, lng: 151.3235, radius: 800 },
  { name: 'Green Point', lat: -33.4610, lng: 151.3650, radius: 800 },
];

// ─── Helper Functions ───
const fmt = (v) => new Intl.NumberFormat('en-AU', { style:'currency', currency:'AUD', minimumFractionDigits:0, maximumFractionDigits:0 }).format(v);
const fmtK = (v) => v >= 1000000 ? `$${(v/1000000).toFixed(2)}M` : `$${Math.round(v/1000)}K`;
const pct = (v, d=1) => `${v.toFixed(d)}%`;

function parseAddress(address) {
  const parts = address.trim().split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const street = parts[0];
    const rest = parts.slice(1).join(' ');
    const stateMatch = rest.match(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/i);
    const postcodeMatch = rest.match(/\b(\d{4})\b/);
    const state = stateMatch ? stateMatch[1].toUpperCase() : 'NSW';
    const postcode = postcodeMatch ? postcodeMatch[1] : '';
    let suburb = rest.replace(stateMatch?.[0] || '', '').replace(postcodeMatch?.[0] || '', '').replace(/,/g, '').trim().toUpperCase();
    return { street, suburb, state, postcode };
  }
  return null;
}

function calcStampDuty(price) {
  if (price <= 17000) return price * 0.0125;
  if (price <= 35000) return 212.5 + (price - 17000) * 0.015;
  if (price <= 93000) return 482.5 + (price - 35000) * 0.0175;
  if (price <= 351000) return 1497.5 + (price - 93000) * 0.035;
  if (price <= 1168000) return 10527.5 + (price - 351000) * 0.045;
  return 47292.5 + (price - 1168000) * 0.055;
}

function calcMortgage(principal, annualRate, years, isIO) {
  const monthlyRate = annualRate / 100 / 12;
  if (isIO) return principal * monthlyRate;
  if (monthlyRate === 0) return principal / (years * 12);
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, years * 12)) / (Math.pow(1 + monthlyRate, years * 12) - 1);
}

function getBadgeClass(level) {
  if (['green','양호','성장','긍정','낮음','활발','안정적','프리미엄'].some(k => level.includes(k))) return 'badge-green';
  if (['orange','보통','중간','확인','기본'].some(k => level.includes(k))) return 'badge-orange';
  if (['red','높음','미해당','부적합'].some(k => level.includes(k))) return 'badge-red';
  return 'badge-blue';
}

function Badge({ text, type }) {
  const cls = type || getBadgeClass(text);
  return <span className={`badge ${cls}`}>{text}</span>;
}

// ─── Scoring Algorithm ───
function calcScores(d, cashflow) {
  const demandScore = Math.min(10, Math.round(
    (d.popGrowth > 5 ? 2 : 1) + (d.incomeGrowth > 20 ? 2 : 1) + (d.vacancyRate < 1 ? 2 : d.vacancyRate < 2 ? 1.5 : 1) + (d.ownerOccRate > 70 ? 2 : 1) + ((d.annualSales || 100) > 100 ? 2 : 1)
  ));
  const supplyScore = Math.min(10, Math.round(
    (d.daysOnMarket < 25 ? 3 : d.daysOnMarket < 35 ? 2 : 1) + (d.boomScore > 55 ? 3 : d.boomScore > 45 ? 2 : 1) + 2
  ));
  const locationScore = Math.min(10, Math.round(
    (d.nearestStationKm < 1 ? 3 : d.nearestStationKm < 3 ? 2 : 1) + 2 + 2
  ));
  const growthScore = Math.min(10, Math.round(
    (d.annualGrowth > 8 ? 4 : d.annualGrowth > 5 ? 3 : 2) + 3
  ));
  const grossYield = (d.weeklyRent * 52) / d.medianPrice * 100;
  const cashflowScore = Math.min(10, Math.round(
    (grossYield > 5 ? 3 : grossYield > 4 ? 2 : 1) + (cashflow >= 0 ? 3 : cashflow > -15000 ? 2 : 1) + 1
  ));
  const landSize = 600; // default estimate
  const devScore = Math.min(10, Math.round(
    (landSize >= 450 ? 3 : 1) + (d.zoning?.includes('R2') ? 3 : 2) + 2
  ));
  const todScore = d.nearestStationKm <= 0.4 ? 9 : d.nearestStationKm <= 0.8 ? 7 : d.nearestStationKm <= 2 ? 5 : 3;
  const riskScore = Math.min(10, Math.round(
    (d.daysOnMarket < 30 ? 2 : 1) + (d.vacancyRate < 1.5 ? 2 : 1) + 2
  ));

  const items = [
    { label: '수요 강도', score: demandScore },
    { label: '공급 환경', score: supplyScore },
    { label: '입지 / 인프라', score: locationScore },
    { label: '자본 성장 잠재력', score: growthScore },
    { label: '현금흐름', score: cashflowScore },
    { label: '개발 잠재력', score: devScore },
    { label: 'TOD/LMR 수혜', score: todScore },
    { label: '리스크 수준', score: riskScore },
  ];
  const avg = items.reduce((s, i) => s + i.score, 0) / items.length;
  return { items, avg };
}

// ─── Main App Component ───
export default function App() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');

  // Adjustable financial parameters (string state to allow empty input)
  const [priceStr, setPriceStr] = useState('');
  const [rentStr, setRentStr] = useState('');
  const [lvr, setLvr] = useState(80);
  const [rateStr, setRateStr] = useState('6.0');
  const [isIO, setIsIO] = useState(true);

  const purchasePrice = parseFloat(priceStr) || 0;
  const weeklyRent = parseFloat(rentStr) || 0;
  const interestRate = parseFloat(rateStr) || 0;

  const handleAnalyze = useCallback(async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError('');
    setData(null);

    const p = parseAddress(address);
    if (!p || !p.suburb) {
      setError('주소 형식을 확인해주세요. 예: 75 Lakedge Ave, Berkeley Vale NSW 2261');
      setLoading(false);
      return;
    }
    setParsed(p);

    // Try local DB first
    const localData = SUBURB_DATA[p.suburb];
    let fetchedData = null;

    try {
      const params = new URLSearchParams({
        address: address.trim(),
        suburb: p.suburb,
        postcode: p.postcode || (localData?.postcode || ''),
        state: p.state || 'NSW',
      });
      const resp = await fetch(`/api/lookup?${params}`);
      if (resp.ok) {
        fetchedData = await resp.json();
      }
    } catch (e) {
      console.log('API fetch failed, using local DB:', e);
    }

    const stats = fetchedData?.suburbStats || localData || SUBURB_DATA['BERKELEY VALE'];
    const postcode = p.postcode || fetchedData?.postcode || localData?.postcode || '2261';
    const state = p.state || fetchedData?.state || localData?.state || 'NSW';

    const finalData = {
      ...stats,
      postcode,
      state,
      suburb: p.suburb,
      street: p.street,
      dataSource: fetchedData?.dataSource || (localData ? 'database' : 'defaults'),
      sources: fetchedData?.sources || [],
      usedClaude: fetchedData?.usedClaude || false,
      // Extra fields from specialized sources
      affluenceScore: fetchedData?.suburbStats?.affluenceScore || null,
      crimeRate: fetchedData?.suburbStats?.crimeRate || null,
      crimeScore: fetchedData?.suburbStats?.crimeScore || null,
      seifaIndex: fetchedData?.suburbStats?.seifaIndex || null,
      floodZone: fetchedData?.suburbStats?.floodZone || null,
      bushfireRisk: fetchedData?.suburbStats?.bushfireRisk || null,
    };

    setData(finalData);
    setPriceStr(String(finalData.medianPrice));
    setRentStr(String(finalData.weeklyRent));
    setLvr(80);
    setRateStr('6.0');
    setIsIO(true);
    setLoading(false);
  }, [address]);

  // ─── Derived Financial Calculations ───
  const finance = useMemo(() => {
    if (!data) return null;
    const price = purchasePrice;
    const rent = weeklyRent;
    const deposit = price * (1 - lvr / 100);
    const loanAmount = price * (lvr / 100);
    const stampDuty = Math.round(calcStampDuty(price));
    const totalInitial = deposit + stampDuty;
    const monthlyPayment = calcMortgage(loanAmount, interestRate, 30, isIO);
    const annualMortgage = monthlyPayment * 12;

    const grossRental = rent * 52;
    const vacancyLoss = rent * 2;
    const mgmtFee = Math.round(grossRental * 0.07);
    const councilRates = 2000;
    const waterRates = 1200;
    const insurance = 1800;
    const maintenance = 2000;
    const netRental = grossRental - vacancyLoss - mgmtFee - councilRates - waterRates - insurance - maintenance;
    const annualCashflow = netRental - annualMortgage;
    const grossYield = (grossRental / price * 100);
    const netYield = (netRental / price * 100);

    return {
      price, rent, deposit, loanAmount, stampDuty, totalInitial,
      monthlyPayment, annualMortgage,
      grossRental, vacancyLoss, mgmtFee, councilRates, waterRates, insurance, maintenance,
      netRental, annualCashflow, grossYield, netYield,
    };
  }, [data, purchasePrice, weeklyRent, lvr, interestRate, isIO]);

  const scores = useMemo(() => {
    if (!data || !finance) return null;
    return calcScores(data, finance.annualCashflow);
  }, [data, finance]);

  // ─── Render: Address Input ───
  if (!data) {
    return (
      <div className="container">
        <div className="header" style={{ textAlign: 'center', padding: '40px 32px' }}>
          <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Australian Property Investment Analyzer</h1>
          <p style={{ opacity: 0.95, fontSize: '17px', fontWeight: 500, marginBottom: '6px' }}>
            주소 하나로 끝내는 투자 분석 리포트
          </p>
          <p style={{ opacity: 0.7, fontSize: '13px', lineHeight: 1.6 }}>
            15,000+ suburbs | 9개 데이터 소스 자동 수집 | 실시간 현금흐름 시뮬레이션
          </p>
        </div>

        <div className="section" style={{ maxWidth: 600, margin: '30px auto', textAlign: 'center' }}>
          <h2 style={{ borderBottom: 'none', marginBottom: 8, fontSize: '20px' }}>Analyze Any Address in Australia</h2>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
            주소만 입력하면 수요/공급, 현금흐름, TOD/LMR, 리스크까지 한번에
          </p>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            placeholder="예: 75 Lakedge Ave, Berkeley Vale NSW 2261"
            style={{
              width: '100%', padding: '14px 16px', fontSize: '16px',
              border: '2px solid #2E75B6', borderRadius: '10px', outline: 'none',
              marginBottom: '16px',
            }}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading}
            style={{
              width: '100%', padding: '14px', fontSize: '18px', fontWeight: 700,
              background: loading ? '#999' : 'linear-gradient(135deg, #1B3A5C, #2E75B6)',
              color: 'white', border: 'none', borderRadius: '10px', cursor: loading ? 'wait' : 'pointer',
              transition: 'transform 0.1s',
            }}
          >
            {loading ? 'Analyzing... (9개 소스 수집 중)' : 'Analyze!'}
          </button>
          {error && <p style={{ color: '#c62828', marginTop: 12, fontSize: 14 }}>{error}</p>}

          {/* Feature highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '28px', textAlign: 'left' }}>
            {[
              { icon: '📊', title: '10-Section Report', desc: '수요, 공급, 입지, TOD/LMR, 현금흐름, 리스크, 종합평가' },
              { icon: '🔄', title: 'Real-time Cashflow', desc: '매입가, 렌트, LVR, 이자율, IO/P&I 즉시 재계산' },
              { icon: '🌐', title: '9 Data Sources', desc: 'BoomScore, Domain, OpenStats, ABS Census 등 자동 수집' },
              { icon: '🏗️', title: 'TOD/LMR Analysis', desc: 'NSW Planning Reform 2025 자동 분석' },
            ].map((f, i) => (
              <div key={i} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e8e8e8' }}>
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{f.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1B3A5C' }}>{f.title}</div>
                <div style={{ fontSize: '11px', color: '#666', lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 20, fontSize: 11, color: '#aaa' }}>
            NSW, VIC, QLD, WA, SA, TAS, NT, ACT — 호주 전국 모든 주소 분석 가능
          </p>
        </div>
      </div>
    );
  }

  // ─── Render: Full Report ───
  const d = data;
  const f = finance;
  const sc = scores;
  const todApplicable = d.nearestStationKm <= 0.4;
  const lmrApplicable = d.nearestStationKm <= 0.8;
  const region = d.postcode?.startsWith('22') || d.postcode?.startsWith('225') || d.postcode?.startsWith('226') ? 'Central Coast' : 'Greater Sydney';

  const verdictText = sc.avg >= 7.5 ? '적극 투자 추천' :
    sc.avg >= 6 ? '투자 검토 가치 있음 (조건부 긍정)' :
    sc.avg >= 4.5 ? '보수적 접근 권장' : '투자 부적합';

  return (
    <div className="container">

      {/* ── HEADER ── */}
      <div className="header">
        <h1>Property Investment Analysis</h1>
        <div className="address">{address}</div>
        <div className="meta">{region}, {d.state} | Analysis Date: {new Date().toLocaleDateString('en-AU', {month:'long', year:'numeric'})}</div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>
          Data: {d.dataSource} | Sources: {d.sources?.length > 0 ? d.sources.join(', ') : 'Embedded DB'}
          {d.usedClaude && ' | Claude AI assisted'}
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              const url = window.location.href;
              if (navigator.share) {
                navigator.share({ title: 'Investment Analysis: ' + address, url: url });
              } else {
                navigator.clipboard.writeText(url).then(function() { alert('Link copied!'); });
              }
            }}
            style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Share
          </button>
          <button
            onClick={function() { window.print(); }}
            style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            PDF
          </button>
          <button
            onClick={function() { setData(null); setAddress(''); }}
            style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
          >
            New Analysis
          </button>
        </div>
      </div>

      {/* ── 1. Property Overview ── */}
      <div className="section">
        <h2>1. 매물 개요 (Property Overview)</h2>
        <div className="score-card">
          <div className="score-item"><div className="value">{fmtK(d.medianPrice)}</div><div className="label">Median (House)</div></div>
          <div className="score-item"><div className="value">${d.weeklyRent}/w</div><div className="label">Weekly Rent</div></div>
          <div className="score-item"><div className="value">{d.boomScore}/100</div><div className="label">BoomScore</div></div>
          <div className="score-item"><div className="value">{d.daysOnMarket}일</div><div className="label">Days on Market</div></div>
          <div className="score-item"><div className="value">{d.annualSales}건</div><div className="label">Annual Sales</div></div>
          <div className="score-item"><div className="value">{d.zoning}</div><div className="label">Zoning</div></div>
        </div>
        <table>
          <thead><tr><th>항목</th><th>내용</th><th>평가</th></tr></thead>
          <tbody>
            <tr><td>지역 중간 가격</td><td>{fmt(d.medianPrice)}</td><td>{region} 수준</td></tr>
            <tr><td>연간 자본 성장률</td><td>{pct(d.annualGrowth)}</td><td><Badge text={d.annualGrowth > 5 ? '양호' : '보통'} /></td></tr>
            <tr><td>렌탈 수익률 (Gross)</td><td>{pct((d.weeklyRent * 52) / d.medianPrice * 100, 2)}</td><td><Badge text={(d.weeklyRent * 52 / d.medianPrice * 100) > 4.5 ? '양호' : '보통'} /></td></tr>
            <tr><td>주간 렌트</td><td>${d.weeklyRent}/week</td><td>{region} 수준</td></tr>
            <tr><td>BoomScore</td><td>{d.boomScore}/100 - {d.boomScore >= 60 ? 'Strong' : d.boomScore >= 45 ? 'Healthy' : 'Weak'} Market</td><td><Badge text="안정적" type="badge-blue" /></td></tr>
            <tr><td>평균 매물 체류</td><td>{d.daysOnMarket}일</td><td><Badge text={d.daysOnMarket < 30 ? '빠른 거래' : '보통'} /></td></tr>
            <tr><td>연간 매매 건수</td><td>{d.annualSales}건 (12개월)</td><td><Badge text={d.annualSales > 100 ? '활발' : '보통'} /></td></tr>
          </tbody>
        </table>
      </div>

      {/* ── 2. Demand Analysis ── */}
      <div className="section">
        <h2>2. 수요 분석 (Demand Analysis)</h2>
        <table>
          <thead><tr><th>수요 지표</th><th>수치</th><th>트렌드</th><th>평가</th></tr></thead>
          <tbody>
            <tr><td>인구 (2021 Census)</td><td>{d.population?.toLocaleString()}명</td><td>성장률 +{pct(d.popGrowth)}</td><td><Badge text="성장" /></td></tr>
            <tr><td>주간 가구 중위 소득</td><td>${d.medianIncomeWeekly?.toLocaleString()}/주</td><td>성장률 +{pct(d.incomeGrowth)}</td><td><Badge text={d.incomeGrowth > 25 ? '강한 성장' : '성장'} /></td></tr>
            <tr><td>자가 거주율</td><td>{pct(d.ownerOccRate)}</td><td>{d.ownerOccRate > 70 ? '높은 자가율' : '적정 수준'}</td><td><Badge text={d.ownerOccRate > 70 ? '안정적' : '보통'} type="badge-blue" /></td></tr>
            <tr><td>임대 비율</td><td>{pct(100 - d.ownerOccRate)}</td><td>적정 임차 수요</td><td><Badge text="안정적" type="badge-blue" /></td></tr>
            <tr><td>공실률</td><td>{d.vacancyRate < 1 ? '< 1%' : pct(d.vacancyRate)}</td><td>{d.vacancyRate < 1 ? '극도로 타이트' : '적정'}</td><td><Badge text={d.vacancyRate < 1 ? '매우 양호' : '양호'} /></td></tr>
          </tbody>
        </table>
        <div className="highlight">
          <strong>수요 핵심 포인트:</strong> 인구 성장(+{pct(d.popGrowth)})과 소득 증가(+{pct(d.incomeGrowth)})이 동반되며, {d.vacancyRate < 1 ? '1% 미만의 극도로 낮은 공실률은 강한 렌탈 수요를 보여줍니다' : `${pct(d.vacancyRate)} 공실률은 적정 수준의 렌탈 시장을 나타냅니다`}.
        </div>
      </div>

      {/* ── 3. Supply Analysis ── */}
      <div className="section">
        <h2>3. 공급 분석 (Supply Analysis)</h2>
        <table>
          <thead><tr><th>공급 지표</th><th>상태</th><th>상세 내용</th><th>투자 영향</th></tr></thead>
          <tbody>
            <tr><td>매물 재고 수준</td><td><Badge text={d.boomScore >= 55 ? '타이트' : '균형 (Healthy)'} type="badge-blue" /></td><td>BoomScore {d.boomScore}/100</td><td>{d.boomScore >= 55 ? '가격 상승 압력' : '안정적 시장'}</td></tr>
            <tr><td>평균 거래 소요</td><td>{d.daysOnMarket}일</td><td>{d.daysOnMarket < 25 ? '빠른 거래' : '보통 수준'}</td><td>{d.daysOnMarket < 25 ? '높은 수요 반영' : '적정 시장'}</td></tr>
            <tr><td>연간 거래량</td><td>{d.annualSales}건</td><td>{d.annualSales > 150 ? '활발한 거래' : '적정 거래'}</td><td>{d.annualSales > 150 ? '유동성 양호' : '유동성 적정'}</td></tr>
            <tr><td>조닝</td><td>{d.zoning}</td><td>{d.zoning?.includes('R2') ? '단독주택, 듀얼 오큐펀시 허용' : '중밀도 이상 개발 가능'}</td><td>개발 유연성</td></tr>
          </tbody>
        </table>
        {d.zoning?.includes('R2') && (
          <div className="highlight">
            <strong>개발 잠재력:</strong> R2 Low Density 구역에서 2024년 7월 NSW Stage 1 정책으로 Dual Occupancy / Granny Flat 개발이 가능합니다. 최소 요건: 450m&sup2;, 폭 12m, FSR 0.65:1, 최대 높이 9.5m.
          </div>
        )}
      </div>

      {/* ── 4. Location & Infrastructure ── */}
      <div className="section">
        <h2>4. 입지 및 인프라 (Location & Infrastructure)</h2>
        <table>
          <thead><tr><th>카테고리</th><th>항목</th><th>거리/접근성</th><th>평가</th></tr></thead>
          <tbody>
            <tr><td><strong>기차역</strong></td><td>최근접역</td><td>약 {d.nearestStationKm}km</td><td><Badge text={d.nearestStationKm < 1 ? '양호' : d.nearestStationKm < 3 ? '보통' : '보통'} /></td></tr>
            <tr><td><strong>조닝</strong></td><td>{d.zoning}</td><td>-</td><td><Badge text="확인됨" type="badge-blue" /></td></tr>
            <tr><td><strong>인구</strong></td><td>{d.population?.toLocaleString()}명</td><td>성장률 +{pct(d.popGrowth)}</td><td><Badge text="성장" /></td></tr>
            <tr><td><strong>중위소득</strong></td><td>${d.medianIncomeWeekly?.toLocaleString()}/주</td><td>성장률 +{pct(d.incomeGrowth)}</td><td><Badge text="양호" /></td></tr>
          </tbody>
        </table>
        <div className="highlight">
          <strong>인프라 참고:</strong> {region} 지역의 지속적인 인프라 투자와 인구 유입이 부동산 가치 상승을 지지합니다.
        </div>
      </div>

      {/* ── 5. TOD / LMR Analysis ── */}
      <div className="section">
        <h2>5. TOD / LMR Housing Policy 해당 여부 분석</h2>
        <p style={{ fontSize: 14, marginBottom: 12 }}>
          NSW 정부의 <strong>Planning System Reforms Act 2025</strong>에 따라, 주택 공급 가속화를 위한 두 가지 핵심 정책이 시행 중입니다.
        </p>

        <h3>5.1 Transport Oriented Development (TOD) Program</h3>
        <table>
          <thead><tr><th>항목</th><th>기준</th><th>매물 현황</th><th>해당 여부</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>TOD 적용 범위</strong></td>
              <td>지정 역으로부터 <strong>400m</strong> 이내</td>
              <td>최근접 역까지 약 {d.nearestStationKm}km</td>
              <td><Badge text={todApplicable ? '해당' : '미해당'} type={todApplicable ? 'badge-green' : 'badge-red'} /></td>
            </tr>
          </tbody>
        </table>

        <h3>5.2 Low and Mid-Rise (LMR) Housing Policy</h3>
        <table>
          <thead><tr><th>항목</th><th>기준</th><th>매물 현황</th><th>해당 여부</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>LMR 적용 범위</strong></td>
              <td>지정 센터/역으로부터 <strong>800m</strong> 이내</td>
              <td>최근접 역까지 약 {d.nearestStationKm}km</td>
              <td><Badge text={lmrApplicable ? '해당' : '미해당'} type={lmrApplicable ? 'badge-green' : 'badge-red'} /></td>
            </tr>
          </tbody>
        </table>

        <div style={{
          background: todApplicable || lmrApplicable
            ? 'linear-gradient(135deg, #e8f5e9, #e3f2fd)'
            : 'linear-gradient(135deg, #fff3e0, #fce4ec)',
          padding: 16, borderRadius: 10, margin: '16px 0',
          borderLeft: `4px solid ${todApplicable || lmrApplicable ? '#2e7d32' : '#e65100'}`
        }}>
          <strong style={{ color: todApplicable || lmrApplicable ? '#2e7d32' : '#c62828' }}>
            {todApplicable && lmrApplicable ? '✅ TOD & LMR 모두 해당' :
             todApplicable ? '✅ TOD 해당 / LMR 미해당' :
             lmrApplicable ? '✅ LMR 해당 / TOD 미해당' :
             '⚠️ TOD / LMR 모두 미해당'}
          </strong>
          <p style={{ fontSize: 13, marginTop: 6 }}>
            {!todApplicable && !lmrApplicable
              ? `${parsed?.street || ''}, ${d.suburb}는 최근접 역까지 약 ${d.nearestStationKm}km 떨어져 있어 TOD(400m) 및 LMR(800m) 기준 모두 충족하지 못합니다. 단, ${d.zoning?.includes('R2') ? 'NSW Stage 1 정책에 따라 R2 구역 Dual Occ/Granny Flat은 LMR과 무관하게 허용됩니다.' : '기존 조닝 규정이 적용됩니다.'}`
              : todApplicable
              ? `TOD 400m 반경 내 위치로 고밀도 개발 가능! 자동적 밀도 상향 및 평가 기간 단축 혜택이 적용됩니다.`
              : `LMR 800m 반경 내 위치로 Low-Mid Rise 개발이 가능합니다. R2 구역의 경우 Dual Occ, Terraces, Townhouses 허용.`}
          </p>
        </div>

        {region === 'Central Coast' && (
          <>
            <h3>5.3 Central Coast TOD/LMR 지정 현황</h3>
            <table>
              <thead><tr><th>지정 유형</th><th>지정 위치</th><th>비고</th></tr></thead>
              <tbody>
                {TOD_STATIONS.map(s => (
                  <tr key={s.name}><td><Badge text="TOD" type="badge-blue" /></td><td>{s.name}</td><td>TOD 지정역</td></tr>
                ))}
                {LMR_CENTRES.map(c => (
                  <tr key={c.name}><td><Badge text="LMR" type="badge-orange" /></td><td>{c.name}</td><td>LMR 지정지</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ── 6. Cash Flow Analysis (INTERACTIVE) ── */}
      <div className="section">
        <h2>6. 현금흐름 분석 (Cash Flow Analysis)</h2>

        {/* Parameter Controls */}
        <div style={{ background: '#f0f4ff', padding: 16, borderRadius: 10, marginBottom: 16, border: '1px solid #2E75B6' }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Financial Parameters (조정 가능)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#1B3A5C' }}>매입가격</label>
              <input type="text" inputMode="numeric" value={priceStr} onChange={e => setPriceStr(e.target.value.replace(/[^0-9]/g, ''))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14 }} placeholder="935000" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#1B3A5C' }}>주간 렌트 ($)</label>
              <input type="text" inputMode="numeric" value={rentStr} onChange={e => setRentStr(e.target.value.replace(/[^0-9]/g, ''))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14 }} placeholder="680" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#1B3A5C' }}>LVR (%)</label>
              <input type="range" min={50} max={95} value={lvr} onChange={e => setLvr(Number(e.target.value))}
                style={{ width: '100%' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1B3A5C' }}>{lvr}%</span>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#1B3A5C' }}>이자율 (%)</label>
              <input type="text" inputMode="decimal" value={rateStr} onChange={e => setRateStr(e.target.value.replace(/[^0-9.]/g, ''))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14 }} placeholder="6.0" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#1B3A5C' }}>상환 방식</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setIsIO(true)}
                  style={{ flex: 1, padding: '8px', border: `2px solid ${isIO ? '#2E75B6' : '#ccc'}`, borderRadius: 6, background: isIO ? '#e3f2fd' : 'white', fontWeight: isIO ? 700 : 400, cursor: 'pointer', fontSize: 13 }}>
                  IO (이자만)
                </button>
                <button onClick={() => setIsIO(false)}
                  style={{ flex: 1, padding: '8px', border: `2px solid ${!isIO ? '#2E75B6' : '#ccc'}`, borderRadius: 6, background: !isIO ? '#e3f2fd' : 'white', fontWeight: !isIO ? 700 : 400, cursor: 'pointer', fontSize: 13 }}>
                  P&I (원리금)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Cash Flow Table */}
        <h3>6.1 연간 예상 현금흐름 (매입가 {fmtK(f.price)}, 렌트 ${f.rent}/주 기준)</h3>
        <table>
          <thead><tr><th>항목</th><th>연간 금액</th><th>비고</th></tr></thead>
          <tbody>
            <tr><td>총 렌탈 수입</td><td style={{ color: '#2e7d32', fontWeight: 700 }}>+{fmt(f.grossRental)}</td><td>${f.rent} x 52주</td></tr>
            <tr><td>공실 손실 (2주)</td><td style={{ color: '#c62828' }}>-{fmt(f.vacancyLoss)}</td><td>공실률 반영</td></tr>
            <tr><td>관리비 (7%)</td><td style={{ color: '#c62828' }}>-{fmt(f.mgmtFee)}</td><td>프로퍼티 매니저</td></tr>
            <tr><td>Council Rates</td><td style={{ color: '#c62828' }}>-{fmt(f.councilRates)}</td><td>추정</td></tr>
            <tr><td>Water Rates</td><td style={{ color: '#c62828' }}>-{fmt(f.waterRates)}</td><td>추정</td></tr>
            <tr><td>보험료</td><td style={{ color: '#c62828' }}>-{fmt(f.insurance)}</td><td>추정</td></tr>
            <tr><td>유지보수</td><td style={{ color: '#c62828' }}>-{fmt(f.maintenance)}</td><td>추정</td></tr>
            <tr style={{ background: '#e3f2fd', fontWeight: 700 }}>
              <td>순 렌탈 수입</td>
              <td style={{ color: '#2e7d32' }}>{fmt(f.netRental)}</td>
              <td>Net Yield ~{pct(f.netYield, 2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Mortgage Table */}
        <h3>6.2 모기지 시나리오 ({lvr}% LVR, {isIO ? 'Interest Only' : 'P&I'})</h3>
        <table>
          <tbody>
            <tr><td>매입 가격</td><td><strong>{fmt(f.price)}</strong></td></tr>
            <tr><td>예치금 ({100 - lvr}%)</td><td>{fmt(f.deposit)}</td></tr>
            <tr><td>대출 금액</td><td>{fmt(f.loanAmount)}</td></tr>
            <tr><td>인지세 (Stamp Duty)</td><td>~{fmt(f.stampDuty)}</td></tr>
            <tr style={{ background: '#e3f2fd' }}><td><strong>총 초기 투자금</strong></td><td><strong>~{fmt(f.totalInitial)}</strong></td></tr>
            <tr><td>연간 상환액 ({pct(interestRate)}, {isIO ? 'IO' : 'P&I'})</td><td style={{ color: '#c62828' }}>{fmt(Math.round(f.annualMortgage))}</td></tr>
            <tr style={{ background: f.annualCashflow >= 0 ? '#e8f5e9' : '#fce4ec' }}>
              <td><strong>연간 현금흐름</strong></td>
              <td style={{ color: f.annualCashflow >= 0 ? '#2e7d32' : '#c62828', fontWeight: 700 }}>
                {fmt(Math.round(f.annualCashflow))} {f.annualCashflow < 0 ? '(네거티브 기어링)' : '(포지티브 기어링)'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Scenario Comparison */}
        <h3>6.3 시나리오 비교</h3>
        <table>
          <thead><tr><th>시나리오</th><th>이자율</th><th>방식</th><th>연간 상환</th><th>현금흐름</th></tr></thead>
          <tbody>
            {[
              { label: '현재 설정', rate: interestRate, io: isIO },
              { label: '금리 -1%', rate: Math.max(0, interestRate - 1), io: isIO },
              { label: '금리 +1%', rate: interestRate + 1, io: isIO },
              { label: isIO ? 'P&I 전환' : 'IO 전환', rate: interestRate, io: !isIO },
              { label: '금리 -1% + ' + (isIO ? 'P&I' : 'IO'), rate: Math.max(0, interestRate - 1), io: !isIO },
              { label: '금리 +1% + ' + (isIO ? 'P&I' : 'IO'), rate: interestRate + 1, io: !isIO },
            ].map((sc, i) => {
              const mp = calcMortgage(f.loanAmount, sc.rate, 30, sc.io);
              const am = mp * 12;
              const cf = f.netRental - am;
              return (
                <tr key={i} style={i === 0 ? { background: '#e3f2fd', fontWeight: 600 } : {}}>
                  <td>{sc.label}</td>
                  <td>{pct(sc.rate)}</td>
                  <td>{sc.io ? 'IO' : 'P&I'}</td>
                  <td>{fmt(Math.round(am))}</td>
                  <td style={{ color: cf >= 0 ? '#2e7d32' : '#c62828', fontWeight: 600 }}>{fmt(Math.round(cf))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="highlight">
          <strong>참고:</strong> 네거티브 기어링이라도, 호주 세법상 이자/감가상각 등 과세소득 공제 가능. 자본 성장률 {pct(d.annualGrowth)} 적용 시 연간 약 {fmtK(Math.round(f.price * d.annualGrowth / 100))} 자산가치 상승 기대 → 총수익 관점에서 {f.annualCashflow + f.price * d.annualGrowth / 100 > 0 ? '긍정적' : '보수적 접근 필요'}.
        </div>
      </div>

      {/* ── 7. Risk Assessment ── */}
      <div className="section">
        <h2>7. 리스크 분석 (Risk Assessment)</h2>
        <table>
          <thead><tr><th>리스크</th><th>수준</th><th>상세 내용</th><th>대응 방안</th></tr></thead>
          <tbody>
            <tr><td><strong>금리 리스크</strong></td><td><Badge text="중간" /></td><td>{f.annualCashflow < 0 ? '현 금리에서 네거티브 기어링 발생' : '현 금리에서 포지티브 기어링'}</td><td>고정금리 검토</td></tr>
            <tr><td><strong>시장 조정</strong></td><td><Badge text={d.annualGrowth > 5 ? '낮음' : '중간'} /></td><td>{region} 시장 동향 모니터링</td><td>장기 보유 전략</td></tr>
            <tr><td><strong>유동성</strong></td><td><Badge text={d.daysOnMarket < 30 ? '낮음' : '중간'} /></td><td>평균 {d.daysOnMarket}일 거래, 연 {d.annualSales}건</td><td>{d.daysOnMarket < 30 ? '활발한 시장' : '적정 시장'}</td></tr>
            <tr><td><strong>공실 리스크</strong></td><td><Badge text={d.vacancyRate < 1.5 ? '낮음' : '중간'} /></td><td>공실률 {d.vacancyRate < 1 ? '< 1%' : pct(d.vacancyRate)}</td><td>프로퍼티 매니저 활용</td></tr>
            <tr><td><strong>홍수/부시파이어</strong></td>
              <td><Badge text={d.floodZone ? '확인됨' : d.bushfireRisk ? '확인됨' : '확인 필요'} /></td>
              <td>{d.floodZone || d.bushfireRisk || 'NSW Flood Data Portal 및 RFS Map 확인 필수'}</td>
              <td>보험 가입 및 정밀 조사</td></tr>
          </tbody>
        </table>

        {/* Extra data from Microburbs / OpenStats */}
        {(d.affluenceScore || d.crimeRate || d.seifaIndex) && (
          <>
            <h3 style={{ marginTop: 16 }}>7.1 사회경제적 지표 (Socio-Economic)</h3>
            <table>
              <thead><tr><th>지표</th><th>수치</th><th>출처</th></tr></thead>
              <tbody>
                {d.affluenceScore && <tr><td>Affluence Score</td><td>{d.affluenceScore}</td><td>Microburbs</td></tr>}
                {d.crimeRate && <tr><td>범죄율 (per 100K)</td><td>{d.crimeRate}</td><td>OpenStats</td></tr>}
                {d.crimeScore && <tr><td>Crime Score</td><td>{d.crimeScore}</td><td>Microburbs</td></tr>}
                {d.seifaIndex && <tr><td>SEIFA Index</td><td>{d.seifaIndex}</td><td>OpenStats/ABS</td></tr>}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ── 8. Market Outlook ── */}
      <div className="section">
        <h2>8. 시장 전망 (Market Outlook 2026)</h2>
        <table>
          <thead><tr><th>항목</th><th>전망</th><th>영향</th></tr></thead>
          <tbody>
            <tr><td>{region} 가격 성장</td><td>+{pct(d.annualGrowth)} 연간</td><td><Badge text="긍정" /></td></tr>
            <tr><td>렌탈 시장</td><td>공실률 {d.vacancyRate < 1 ? '1% 미만' : pct(d.vacancyRate)} 지속</td><td><Badge text={d.vacancyRate < 1.5 ? '렌트 상승 압력' : '안정'} /></td></tr>
            <tr><td>수요 동인</td><td>시드니 대비 저평가 + 원격근무 확산</td><td><Badge text="유입 수요 지속" /></td></tr>
            <tr><td>규제 변화</td><td>NSW Low-Mid Rise Housing Policy</td><td><Badge text="개발 기회 확대" /></td></tr>
          </tbody>
        </table>
      </div>

      {/* ── 9. Overall Assessment ── */}
      <div className="section">
        <h2>9. 종합 투자 평가 (Overall Assessment)</h2>
        <table>
          <thead><tr><th>평가 항목</th><th>점수</th><th>근거</th></tr></thead>
          <tbody>
            {sc.items.map((item, i) => (
              <tr key={i}>
                <td>{item.label}</td>
                <td><Badge text={`${item.score}/10`} type={item.score >= 7 ? 'badge-green' : item.score >= 5 ? 'badge-orange' : 'badge-red'} /></td>
                <td>{
                  item.label === '수요 강도' ? `인구 +${pct(d.popGrowth)}, 소득 +${pct(d.incomeGrowth)}, 공실률 ${d.vacancyRate < 1 ? '<1%' : pct(d.vacancyRate)}` :
                  item.label === '공급 환경' ? `BoomScore ${d.boomScore}/100, ${d.daysOnMarket}일 거래` :
                  item.label === '입지 / 인프라' ? `최근접역 ${d.nearestStationKm}km, ${d.zoning}` :
                  item.label === '자본 성장 잠재력' ? `연 ${pct(d.annualGrowth)} 성장` :
                  item.label === '현금흐름' ? `Gross Yield ${pct(f.grossYield, 2)}, ${f.annualCashflow < 0 ? '네거티브' : '포지티브'} 기어링` :
                  item.label === '개발 잠재력' ? `${d.zoning} → ${d.zoning?.includes('R2') ? 'Dual Occ 가능' : '개발 가능'}` :
                  item.label === 'TOD/LMR 수혜' ? `최근접역 ${d.nearestStationKm}km, ${todApplicable ? 'TOD 해당' : 'TOD 미해당'} / ${lmrApplicable ? 'LMR 해당' : 'LMR 미해당'}` :
                  `${d.daysOnMarket}일 거래, 공실률 ${d.vacancyRate < 1 ? '<1%' : pct(d.vacancyRate)}`
                }</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="verdict">
          <div className="label">종합 투자 점수</div>
          <div className="score">{sc.avg.toFixed(1)} / 10</div>
          <div className="text">{verdictText}</div>
        </div>

        <div className="pro-con">
          <div className="pros">
            <h4 style={{ color: '#2e7d32' }}>긍정적 요소</h4>
            <ul>
              {d.popGrowth > 5 && <li>인구 +{pct(d.popGrowth)} 성장</li>}
              {d.incomeGrowth > 20 && <li>소득 +{pct(d.incomeGrowth)} 증가</li>}
              {d.vacancyRate < 1.5 && <li>공실률 {d.vacancyRate < 1 ? '<1%' : pct(d.vacancyRate)} → 강한 렌탈 수요</li>}
              {d.annualGrowth > 5 && <li>연 {pct(d.annualGrowth)} 자본 성장</li>}
              {d.daysOnMarket < 30 && <li>{d.daysOnMarket}일 평균 거래 → 높은 유동성</li>}
              {d.zoning?.includes('R2') && <li>R2 + NSW Stage 1 → 개발 유연성</li>}
              {(todApplicable || lmrApplicable) && <li>TOD/LMR 수혜 지역</li>}
            </ul>
          </div>
          <div className="cons">
            <h4 style={{ color: '#c62828' }}>주의 사항</h4>
            <ul>
              {f.annualCashflow < 0 && <li>네거티브 기어링 → 현금흐름 여력 필요</li>}
              {!todApplicable && !lmrApplicable && <li>TOD/LMR 미해당 → 밀도 상향 프리미엄 없음</li>}
              {f.grossYield < 4 && <li>Gross Yield {pct(f.grossYield, 2)} → 현금흐름 투자자에겐 부적합</li>}
              <li>홍수/부시파이어 등급 확인 필요</li>
              <li>Building & Pest Inspection 필수</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── 10. Due Diligence Checklist ── */}
      <div className="section">
        <h2>10. 매입 전 체크리스트 (Due Diligence)</h2>
        <ul className="checklist">
          <li><strong>NSW Flood Data Portal</strong> — 홍수 구역 정밀 확인 (flooddata.ses.nsw.gov.au)</li>
          <li><strong>NSW RFS BFPL Map</strong> — 부시파이어 위험 등급 확인 (rfs.nsw.gov.au)</li>
          <li><strong>Building & Pest Inspection</strong> — 건물 상태 점검</li>
          <li><strong>{region === 'Central Coast' ? 'Central Coast' : 'Local'} Council</strong> — 조닝 확인, 개발 가능 범위 문의</li>
          <li><strong>NSW Planning Portal</strong> — Spatial Viewer에서 DA/CDC 이력 확인</li>
          <li><strong>Before You Dig (BYDA)</strong> — 지하 인프라 확인 (byda.com.au)</li>
          <li><strong>SuburbsFinder Calculator</strong> — 정밀 현금흐름 시뮬레이션</li>
          <li><strong>SQM Research</strong> — 실시간 렌트 동향 조회 (postcode {d.postcode})</li>
          <li><strong>RateMyAgent</strong> — 지역 최우수 에이전트 검색</li>
          <li><strong>Strata/Title 확인</strong> — Torrens Title 여부, 이지먼트 확인</li>
          <li><strong>Comparable Sales</strong> — 인근 최근 매매 가격 비교</li>
        </ul>

        <div className="source">
          <strong>데이터 출처:</strong> ABS Census 2021, BoomScore, SQM Research, PropertyValue, Domain{d.sources?.length > 0 ? `, ${d.sources.join(', ')}` : ''}<br/>
          <strong>면책:</strong> 본 분석은 공개 데이터 기반이며, 전문적 재정/법률 자문을 대체하지 않습니다. 투자 결정 전 전문가 상담을 권장합니다.
        </div>
      </div>

    </div>
  );
}

import { useState, useMemo, useCallback, useRef } from "react";

// Embedded Suburb Database
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
};

// Parse Address
function parseAddress(address) {
    const parts = address.trim().split(',').map(p => p.trim());
    if (parts.length >= 2) {
        const street = parts[0];
        const suburb = parts[1]?.toUpperCase();
        const rest = parts.slice(2).join(' ');
        const stateMatch = rest.match(/([A-Z]{2})/);
        const postcodeMatch = rest.match(/(\d{4})/);

        return {
            street,
            suburb,
            state: stateMatch ? stateMatch[1] : '',
            postcode: postcodeMatch ? postcodeMatch[1] : ''
        };
    }
    return null;
}

// Format Currency
function formatCurrency(value) {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

// Format Number
function formatNumber(value) {
    return new Intl.NumberFormat('en-AU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

// Calculate NSW Stamp Duty
function calculateStampDuty(price) {
    if (price <= 14500) return 1.25 * price / 100;
    if (price <= 30600) return 181.25 + 2.5 * (price - 14500) / 100;
    if (price <= 86000) return 585.62 + 3.5 * (price - 30600) / 100;
    if (price <= 540000) return 2521.62 + 4.25 * (price - 86000) / 100;
    return 19961.62 + 5.25 * (price - 540000) / 100;
}

// Research Hub Component
function ResearchHub({ parsedAddress }) {
    const [completed, setCompleted] = useState({});

    if (!parsedAddress) {
        return null;
    }

    const { suburb, postcode, state } = parsedAddress;
    const suburbLower = suburb.toLowerCase();
    const stateLower = state.toLowerCase();
    const suburbTitle = suburb.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

    const toggleComplete = (key) => {
        setCompleted(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const openLink = (url) => {
        window.open(url, '_blank');
    };

    const categories = [
        {
            key: 'cat1',
            num: '1',
            korean: '지역 정보',
            en: 'Demand, Supply',
            desc: 'Market demand, supply trends',
            links: [
                { name: 'BoomScore', url: `https://app.boomscore.com.au/suburb-profile?locality=${suburb}&dwellingType=H&postcode=${postcode}` },
                { name: 'HTag', url: 'https://www.htag.com.au/' }
            ]
        },
        {
            key: 'cat2',
            num: '2',
            korean: '지역 정보',
            en: 'Property Type, Income',
            desc: 'Land usage, income patterns',
            links: [
                { name: 'Landchecker', url: `https://landchecker.com.au/suburb/${suburbLower}-${stateLower}-${postcode}/` }
            ]
        },
        {
            key: 'cat3',
            num: '3',
            korean: '지역 정보',
            en: 'Economy, Community',
            desc: 'Economic indicators, community',
            links: [
                { name: 'Remplan', url: 'https://app.remplan.com.au/' }
            ]
        },
        {
            key: 'cat4',
            num: '4',
            korean: '포켓 정보',
            en: 'Affluence, Income',
            desc: 'Income levels, affluence metrics',
            links: [
                { name: 'Microburbs', url: `https://www.microburbs.com.au/${state}/${suburbTitle}+${postcode}` }
            ]
        },
        {
            key: 'cat5',
            num: '5',
            korean: '포켓 정보',
            en: 'Crime, Socio-economic',
            desc: 'Safety data, SEIFA scores',
            links: [
                { name: 'OpenStats', url: 'https://openstats.com.au/' }
            ]
        },
        {
            key: 'cat6',
            num: '6',
            korean: '매물 정보',
            en: 'Pricing, Risk Factors',
            desc: 'Property listings, flood/bushfire',
            links: [
                { name: 'Property.com.au', url: 'https://www.property.com.au/' },
                { name: 'Domain', url: `https://www.domain.com.au/sale/?suburb=${suburbLower}-${stateLower}-${postcode}` },
                { name: 'REA', url: `https://www.realestate.com.au/sold/in-${suburbTitle},+${state}+${postcode}/list-1` }
            ]
        },
        {
            key: 'cat7',
            num: '7',
            korean: '현금 흐름',
            en: 'Cash Flow Analysis',
            desc: 'ROI, yield calculations',
            links: [
                { name: 'SuburbsFinder', url: 'https://www.suburbsfinder.com.au/investment-property-cash-flow-calculator/' }
            ]
        }
    ];

    return (
        <div className="research-hub">
            <div className="card-title">📚 Research Hub</div>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
                Click to open research websites for {suburb} {postcode}, {state}. Toggle ✅ when data collected.
            </p>
            <div className="research-grid">
                {categories.map(cat => (
                    <div key={cat.key} className="research-card">
                        <div className="research-header">
                            <span className="research-category">Cat {cat.num}</span>
                            <span className="research-korean">{cat.korean}</span>
                        </div>
                        <div className="research-korean" style={{ marginBottom: '6px' }}>{cat.en}</div>
                        <div className="research-description">{cat.desc}</div>
                        <div className="research-links">
                            {cat.links.map((link, idx) => (
                                <button
                                    key={idx}
                                    className="research-link-btn"
                                    onClick={() => openLink(link.url)}
                                >
                                    🔗 {link.name}
                                </button>
                            ))}
                        </div>
                        <div
                            className="research-status"
                            onClick={() => toggleComplete(cat.key)}
                        >
                            <span className="status-toggle">{completed[cat.key] ? '✅' : '⬜'}</span>
                            <span>{completed[cat.key] ? 'Done' : 'Pending'}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '16px', padding: '12px', background: '#F0F5FB', borderRadius: '8px', fontSize: '12px', color: '#666' }}>
                <strong>Additional Resources:</strong>
                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {state === 'NSW' && <a href="https://www.planningportal.nsw.gov.au/spatialviewer/#/find-a-property/address" target="_blank" rel="noopener" className="research-link-btn" style={{ flex: 1 }}>NSW Planning</a>}
                    <a href={`https://sqmresearch.com.au/weekly-rents.php?postcode=${postcode}&t=1`} target="_blank" rel="noopener" className="research-link-btn" style={{ flex: 1 }}>SQM Rents</a>
                    <a href="https://www.ratemyagent.com.au/" target="_blank" rel="noopener" className="research-link-btn" style={{ flex: 1 }}>RateMyAgent</a>
                    <a href="https://www.myschool.edu.au/" target="_blank" rel="noopener" className="research-link-btn" style={{ flex: 1 }}>MySchool</a>
                    <a href="https://www.byda.com.au/" target="_blank" rel="noopener" className="research-link-btn" style={{ flex: 1 }}>Before You Dig</a>
                </div>
            </div>
        </div>
    );
}

// Main App
export default function PropertyAnalyzer() {
    const [address, setAddress] = useState('');
    const [parsedAddress, setParsedAddress] = useState(null);
    const [suburbData, setSuburbData] = useState(null);

    const [beds, setBeds] = useState(3);
    const [baths, setBaths] = useState(2);
    const [cars, setCars] = useState(2);
    const [landSize, setLandSize] = useState(450);
    const [propertyType, setPropertyType] = useState('House');
    const [listedPrice, setListedPrice] = useState(0);

    const [purchasePrice, setPurchasePrice] = useState(800000);
    const [weeklyRent, setWeeklyRent] = useState(600);
    const [lvr, setLvr] = useState(80);
    const [interestRate, setInterestRate] = useState(6.5);
    const [repaymentType, setRepaymentType] = useState('P&I');

    const [medianPrice, setMedianPrice] = useState(0);
    const [medianRent, setMedianRent] = useState(0);
    const [population, setPopulation] = useState(0);
    const [popGrowth, setPopGrowth] = useState(0);
    const [medianIncome, setMedianIncome] = useState(0);
    const [incomeGrowth, setIncomeGrowth] = useState(0);
    const [seifaScore, setSeifaScore] = useState(0);

    const [floodZone, setFloodZone] = useState(false);
    const [bushfireZone, setBushfireZone] = useState('No');
    const [heritage, setHeritage] = useState(false);

    const [showReport, setShowReport] = useState(false);
    const fileInputRef = useRef(null);

    // Handle Address Change
    const handleAddressChange = (e) => {
        const val = e.target.value;
        setAddress(val);

        if (val.length > 5) {
            const parsed = parseAddress(val);
            if (parsed) {
                setParsedAddress(parsed);

                const suburbKey = parsed.suburb?.toUpperCase();
                if (SUBURB_DATA[suburbKey]) {
                    const data = SUBURB_DATA[suburbKey];
                    setSuburbData(data);
                    setPurchasePrice(data.medianPrice);
                    setWeeklyRent(data.weeklyRent);
                    setMedianPrice(data.medianPrice);
                    setMedianRent(data.weeklyRent);
                    setPopulation(data.population);
                    setPopGrowth(data.popGrowth);
                    setMedianIncome(data.medianIncomeWeekly * 52);
                    setIncomeGrowth(data.incomeGrowth);
                } else {
                    setSuburbData(null);
                    resetData();
                }
            }
        }
    };

    const resetData = () => {
        setMedianPrice(0);
        setMedianRent(0);
        setPopulation(0);
        setPopGrowth(0);
        setMedianIncome(0);
        setIncomeGrowth(0);
        setSeifaScore(0);
    };

    const handleQuickFill = () => {
        if (suburbData) {
            setPurchasePrice(suburbData.medianPrice);
            setWeeklyRent(suburbData.weeklyRent);
            setMedianPrice(suburbData.medianPrice);
            setMedianRent(suburbData.weeklyRent);
            setPopulation(suburbData.population);
            setPopGrowth(suburbData.popGrowth);
            setMedianIncome(suburbData.medianIncomeWeekly * 52);
            setIncomeGrowth(suburbData.incomeGrowth);
        }
    };

    // CSV Download
    const downloadCSV = () => {
        const headers = ['suburb', 'postcode', 'state', 'medianPrice', 'weeklyRent', 'population', 'popGrowth', 'medianIncomeWeekly', 'incomeGrowth', 'vacancyRate', 'ownerOccRate', 'annualGrowth', 'daysOnMarket', 'annualSales', 'boomScore', 'zoning', 'nearestStationKm'];
        const csv = [headers.join(',')].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'property_template.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    // Export Current Data
    const exportCurrent = () => {
        if (!parsedAddress) return;
        const row = [parsedAddress.suburb, parsedAddress.postcode, parsedAddress.state, purchasePrice, weeklyRent, population, popGrowth, medianIncome / 52, incomeGrowth, '', '', '', '', '', '', '', ''];
        const csv = 'suburb,postcode,state,medianPrice,weeklyRent,population,popGrowth,medianIncomeWeekly,incomeGrowth,vacancyRate,ownerOccRate,annualGrowth,daysOnMarket,annualSales,boomScore,zoning,nearestStationKm\n' + row.join(',');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${parsedAddress.suburb}_data.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    // Calculate Financial Metrics
    const loanAmount = (purchasePrice * lvr) / 100;
    const stampDuty = calculateStampDuty(purchasePrice);
    const totalInvestment = purchasePrice + stampDuty;
    const equity = purchasePrice - loanAmount;

    const annualRent = weeklyRent * 52;
    const monthlyRent = annualRent / 12;

    let monthlyRepayment = 0;
    if (loanAmount > 0) {
        const monthlyRate = interestRate / 100 / 12;
        const numPayments = 30 * 12;

        if (repaymentType === 'IO') {
            monthlyRepayment = loanAmount * monthlyRate;
        } else {
            monthlyRepayment = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
        }
    }

    const annualRepayment = monthlyRepayment * 12;

    // Expenses
    const councilRates = (purchasePrice * 0.006) / 12;
    const waterRates = 30;
    const insurance = (purchasePrice * 0.004) / 12;
    const maintenanceFund = purchasePrice > 1000000 ? 100 : purchasePrice > 500000 ? 75 : 50;
    const vacancyLoss = monthlyRent * 0.08;
    const bodyCorpFees = propertyType === 'Unit' ? 200 : 0;

    const totalMonthlyExpenses = councilRates + waterRates + insurance + maintenanceFund + monthlyRepayment + vacancyLoss + bodyCorpFees;
    const totalAnnualExpenses = totalMonthlyExpenses * 12;

    const monthlyNetCashflow = monthlyRent - totalMonthlyExpenses;
    const annualNetCashflow = annualRent - totalAnnualExpenses;
    const netYield = (annualNetCashflow / purchasePrice) * 100;
    const grossYield = (annualRent / purchasePrice) * 100;

    // Scenarios
    const scenarios = useMemo(() => {
        const calcScenario = (price, rent, rate, lvr_, type) => {
            const loan = (price * lvr_) / 100;
            const monthlyRate = rate / 100 / 12;
            const numPayments = 30 * 12;

            let monthlyPay = 0;
            if (loan > 0) {
                if (type === 'IO') {
                    monthlyPay = loan * monthlyRate;
                } else {
                    monthlyPay = (loan * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
                }
            }

            const monthlyR = rent * 4.33;
            const councilR = (price * 0.006) / 12;
            const water = 30;
            const insur = (price * 0.004) / 12;
            const maint = price > 1000000 ? 100 : price > 500000 ? 75 : 50;
            const vacancy = monthlyR * 0.08;

            const totalExp = councilR + water + insur + maint + monthlyPay + vacancy;
            const monthlyNet = monthlyR - totalExp;
            const annualNet = monthlyNet * 12;
            const yield_ = (annualNet / price) * 100;

            return { monthlyNet, annualNet, yield: yield_ };
        };

        return [
            { name: 'Current', rate: interestRate, lvr: lvr, type: repaymentType, ...calcScenario(purchasePrice, weeklyRent, interestRate, lvr, repaymentType) },
            { name: 'Rate -1%', rate: Math.max(2, interestRate - 1), lvr: lvr, type: repaymentType, ...calcScenario(purchasePrice, weeklyRent, Math.max(2, interestRate - 1), lvr, repaymentType) },
            { name: 'Rate +1%', rate: interestRate + 1, lvr: lvr, type: repaymentType, ...calcScenario(purchasePrice, weeklyRent, interestRate + 1, lvr, repaymentType) },
            { name: repaymentType === 'IO' ? 'P&I' : 'IO', rate: interestRate, lvr: lvr, type: repaymentType === 'IO' ? 'P&I' : 'IO', ...calcScenario(purchasePrice, weeklyRent, interestRate, lvr, repaymentType === 'IO' ? 'P&I' : 'IO') },
            { name: 'LVR 90%', rate: interestRate, lvr: 90, type: repaymentType, ...calcScenario(purchasePrice, weeklyRent, interestRate, 90, repaymentType) },
            { name: 'Rent +10%', rate: interestRate, lvr: lvr, type: repaymentType, ...calcScenario(purchasePrice, weeklyRent * 1.1, interestRate, lvr, repaymentType) },
        ];
    }, [purchasePrice, weeklyRent, interestRate, lvr, repaymentType]);

    // Calculate Scoring
    const scores = useMemo(() => {
        let demand = 3;
        if (suburbData) {
            if (suburbData.popGrowth > 5) demand += 2;
            if (suburbData.incomeGrowth > 20) demand += 2;
            if (suburbData.vacancyRate < 1.5) demand += 2;
            if (suburbData.daysOnMarket < 30) demand += 2;
            if (suburbData.annualSales > 100) demand += 2;
        }
        demand = Math.min(10, demand);

        let supply = 3;
        if (suburbData) {
            if (suburbData.boomScore >= 40 && suburbData.boomScore <= 65) supply += 2;
            if (landSize >= 450) supply += 3;
        }
        supply = Math.min(10, supply);

        let location = 4;
        if (suburbData) {
            if (suburbData.nearestStationKm < 0.4) location = 10;
            else if (suburbData.nearestStationKm < 2) location = 8;
            else if (suburbData.nearestStationKm < 5) location = 6;
        }

        let growth = 4;
        if (suburbData) {
            if (suburbData.annualGrowth > 7) growth = 9;
            else if (suburbData.annualGrowth > 4) growth = 7;
        }

        let cashflow = 3;
        if (grossYield > 5) cashflow = 8;
        else if (grossYield > 4) cashflow = 6;
        else if (grossYield > 3) cashflow = 4;

        let development = landSize >= 450 ? 8 : 4;

        let tod = 3;
        if (suburbData) {
            if (suburbData.nearestStationKm <= 0.4) tod = 9;
            else if (suburbData.nearestStationKm <= 0.8) tod = 7;
        }

        let risk = 6;
        if (floodZone) risk -= 2;
        if (bushfireZone !== 'No') risk -= 1;
        if (heritage) risk -= 1;
        risk = Math.max(1, risk);

        const overall = Math.round((demand + supply + location + growth + cashflow + development + tod + risk) / 8);

        return { demand, supply, location, growth, cashflow, development, tod, risk, overall };
    }, [suburbData, landSize, grossYield, floodZone, bushfireZone, heritage]);

    const todEligible = suburbData && suburbData.nearestStationKm <= 0.4;
    const lmrEligible = suburbData && suburbData.nearestStationKm <= 0.8;

    return (
        <div className="container">
            {/* Header */}
            <div className="header">
                <h1>🏠 Property Investment Analyzer</h1>
                <p>Comprehensive analysis tool for Australian residential property investments</p>
            </div>

            <div className="main-grid">
                <div>
                    {/* Address Lookup */}
                    <div className="card">
                        <div className="card-title">📍 Property Address</div>
                        <div className="address-section">
                            <input
                                type="text"
                                className="address-input"
                                placeholder="e.g., 75 Lakedge Avenue, Berkeley Vale, NSW 2261"
                                value={address}
                                onChange={handleAddressChange}
                            />
                        </div>

                        {parsedAddress && (
                            <>
                                <div className="parsed-address">
                                    <strong>{parsedAddress.street}</strong><br/>
                                    {parsedAddress.suburb} {parsedAddress.state} {parsedAddress.postcode}
                                    {suburbData && <div style={{ marginTop: '6px', color: '#2E75B6', fontSize: '11px' }}>✓ Data found in database</div>}
                                </div>

                                <div className="search-buttons">
                                    <button className="search-btn" onClick={() => window.open(`https://www.domain.com.au/sale/?suburb=${parsedAddress.suburb.toLowerCase()}-${parsedAddress.state.toLowerCase()}-${parsedAddress.postcode}`, '_blank')}>🔍 Domain</button>
                                    <button className="search-btn" onClick={() => window.open(`https://www.realestate.com.au/sold/in-${parsedAddress.suburb},+${parsedAddress.state}+${parsedAddress.postcode}/list-1`, '_blank')}>🔍 REA</button>
                                    <button className="search-btn" onClick={() => window.open(`https://www.propertyvalue.com.au/suburb/${parsedAddress.suburb}-${parsedAddress.postcode}-${parsedAddress.state.toLowerCase()}`, '_blank')}>🔍 PropertyValue</button>
                                </div>

                                {suburbData && (
                                    <button className="quick-fill-btn" onClick={handleQuickFill}>
                                        ⚡ Quick Fill from Database
                                    </button>
                                )}
                                {!suburbData && (
                                    <div style={{ padding: '12px', background: '#FFF3CD', borderRadius: '8px', fontSize: '12px', color: '#856404' }}>
                                        No preset data available. Use Research Hub above to collect data.
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Research Hub */}
                    {parsedAddress && <ResearchHub parsedAddress={parsedAddress} />}

                    {/* Property Details */}
                    <div className="card">
                        <div className="card-title">🏘️ Property Details</div>
                        <div className="details-grid">
                            <div className="form-group">
                                <label className="form-label">Beds <span className="form-label-korean">(침실)</span></label>
                                <input type="number" min="1" max="10" value={beds} onChange={(e) => setBeds(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Baths <span className="form-label-korean">(욕실)</span></label>
                                <input type="number" min="1" max="5" value={baths} onChange={(e) => setBaths(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Cars <span className="form-label-korean">(주차)</span></label>
                                <input type="number" min="0" max="5" value={cars} onChange={(e) => setCars(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Land (m²) <span className="form-label-korean">(토지 면적)</span></label>
                                <input type="number" min="100" step="50" value={landSize} onChange={(e) => setLandSize(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Property Type <span className="form-label-korean">(물건 유형)</span></label>
                                <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
                                    <option>House</option>
                                    <option>Unit</option>
                                    <option>Townhouse</option>
                                    <option>Land</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Listed Price <span className="form-label-korean">(공시 가격)</span></label>
                                <input type="number" step="10000" value={listedPrice} onChange={(e) => setListedPrice(parseInt(e.target.value) || 0)} />
                            </div>
                        </div>
                    </div>

                    {/* Data Entry Sections */}
                    {parsedAddress && (
                        <div className="card">
                            <div className="card-title">📊 Research Data Entry</div>

                            <div className="data-section">
                                <div className="data-section-title">
                                    Category 1: Demand, Supply
                                    <a href="https://app.boomscore.com.au" target="_blank" rel="noopener" className="data-section-link">BoomScore ↗</a>
                                </div>
                                <div className="section-grid">
                                    <div className="form-group">
                                        <label className="form-label">BoomScore</label>
                                        <input type="number" min="0" max="100" value={0} placeholder="0-100" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Days on Market</label>
                                        <input type="number" value={0} placeholder="days" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Annual Sales</label>
                                        <input type="number" value={0} placeholder="count" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Vacancy Rate %</label>
                                        <input type="number" step="0.1" value={0} placeholder="%" />
                                    </div>
                                </div>
                            </div>

                            <div className="data-section">
                                <div className="data-section-title">
                                    Category 2: Property Type, Income
                                    <a href="https://landchecker.com.au" target="_blank" rel="noopener" className="data-section-link">Landchecker ↗</a>
                                </div>
                                <div className="section-grid">
                                    <div className="form-group">
                                        <label className="form-label">Median Price</label>
                                        <input type="number" step="10000" value={medianPrice} onChange={(e) => setMedianPrice(parseInt(e.target.value) || 0)} placeholder="$" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Weekly Rent</label>
                                        <input type="number" step="10" value={medianRent} onChange={(e) => setMedianRent(parseInt(e.target.value) || 0)} placeholder="$" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Owner Occupier %</label>
                                        <input type="number" step="0.1" value={0} placeholder="%" />
                                    </div>
                                </div>
                            </div>

                            <div className="data-section">
                                <div className="data-section-title">
                                    Category 4-5: Population, Income, SEIFA
                                    <a href="https://www.microburbs.com.au" target="_blank" rel="noopener" className="data-section-link">Microburbs ↗</a>
                                </div>
                                <div className="section-grid">
                                    <div className="form-group">
                                        <label className="form-label">Population</label>
                                        <input type="number" value={population} onChange={(e) => setPopulation(parseInt(e.target.value) || 0)} placeholder="people" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Pop Growth %</label>
                                        <input type="number" step="0.1" value={popGrowth} onChange={(e) => setPopGrowth(parseFloat(e.target.value) || 0)} placeholder="%" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Median Income (Annual)</label>
                                        <input type="number" step="1000" value={medianIncome} onChange={(e) => setMedianIncome(parseInt(e.target.value) || 0)} placeholder="$" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Income Growth %</label>
                                        <input type="number" step="0.1" value={incomeGrowth} onChange={(e) => setIncomeGrowth(parseFloat(e.target.value) || 0)} placeholder="%" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">SEIFA Score</label>
                                        <input type="number" step="1" value={seifaScore} onChange={(e) => setSeifaScore(parseInt(e.target.value) || 0)} placeholder="score" />
                                    </div>
                                </div>
                            </div>

                            <div className="data-section">
                                <div className="data-section-title">
                                    Category 6: Risk Factors
                                    <a href="https://www.property.com.au" target="_blank" rel="noopener" className="data-section-link">Property.com.au ↗</a>
                                </div>
                                <div className="section-grid">
                                    <div className="form-group">
                                        <label className="form-label">Flood Zone</label>
                                        <select value={floodZone ? 'Yes' : 'No'} onChange={(e) => setFloodZone(e.target.value === 'Yes')}>
                                            <option>No</option>
                                            <option>Yes</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Bushfire Zone</label>
                                        <select value={bushfireZone} onChange={(e) => setBushfireZone(e.target.value)}>
                                            <option>No</option>
                                            <option>BAL-12.5</option>
                                            <option>BAL-19</option>
                                            <option>BAL-29</option>
                                            <option>BAL-40</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Heritage Listed</label>
                                        <select value={heritage ? 'Yes' : 'No'} onChange={(e) => setHeritage(e.target.value === 'Yes')}>
                                            <option>No</option>
                                            <option>Yes</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Key Parameters */}
                    <div className="key-parameters">
                        <div className="card-title" style={{ marginBottom: '16px', marginTop: 0, fontSize: '16px' }}>⚙️ Key Parameters</div>

                        <div className="param-row">
                            <div className="param-item">
                                <label className="param-label">① 매입 가격 <div className="param-korean">Purchase Price</div></label>
                                <input type="number" step="10000" value={purchasePrice} onChange={(e) => setPurchasePrice(parseInt(e.target.value) || 0)} className="param-input" />
                            </div>
                            <div className="param-item">
                                <label className="param-label">② 주간 렌트 <div className="param-korean">Weekly Rent</div></label>
                                <input type="number" step="10" value={weeklyRent} onChange={(e) => setWeeklyRent(parseInt(e.target.value) || 0)} className="param-input" />
                            </div>
                        </div>

                        <div className="param-row">
                            <div className="param-item">
                                <label className="param-label">③ LVR % <div className="param-korean">Loan to Value</div></label>
                                <div className="slider-container">
                                    <input type="range" min="50" max="95" value={lvr} onChange={(e) => setLvr(parseInt(e.target.value))} style={{ width: '100%' }} />
                                    <span className="slider-value">{lvr}%</span>
                                </div>
                            </div>
                            <div className="param-item">
                                <label className="param-label">④ 이자율 <div className="param-korean">Interest Rate %</div></label>
                                <input type="number" step="0.01" min="2" max="12" value={interestRate} onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)} className="param-input" />
                            </div>
                        </div>

                        <div className="param-row" style={{ gridTemplateColumns: '1fr' }}>
                            <div className="param-item">
                                <label className="param-label">⑤ 상환 방식 <div className="param-korean">Repayment Type</div></label>
                                <div className="toggle-group">
                                    <button className={`toggle-btn ${repaymentType === 'IO' ? 'active' : ''}`} onClick={() => setRepaymentType('IO')}>Interest Only (IO)</button>
                                    <button className={`toggle-btn ${repaymentType === 'P&I' ? 'active' : ''}`} onClick={() => setRepaymentType('P&I')}>Principal & Interest (P&I)</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Data Management */}
                    <div className="data-management">
                        <div className="card-title" style={{ marginBottom: '12px', fontSize: '14px' }}>📁 Data Management</div>
                        <div className="data-buttons">
                            <button className="data-btn" onClick={downloadCSV}>📥 Download Template</button>
                            <button className="data-btn" onClick={exportCurrent}>📤 Export Current</button>
                        </div>
                    </div>

                    {/* Scenarios */}
                    <div className="card">
                        <div className="card-title">📈 6 Scenario Comparison</div>
                        <table className="scenario-table">
                            <thead>
                                <tr>
                                    <th>Scenario</th>
                                    <th>Rate</th>
                                    <th>LVR</th>
                                    <th>Type</th>
                                    <th>Monthly</th>
                                    <th>Annual</th>
                                    <th>Yield</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scenarios.map((s, i) => (
                                    <tr key={i}>
                                        <td><strong>{s.name}</strong></td>
                                        <td>{s.rate.toFixed(2)}%</td>
                                        <td>{s.lvr}%</td>
                                        <td>{s.type}</td>
                                        <td style={{ color: s.monthlyNet >= 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(s.monthlyNet)}</td>
                                        <td style={{ color: s.annualNet >= 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(s.annualNet)}</td>
                                        <td>{s.yield.toFixed(2)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* TOD & LMR Analysis */}
                    {(todEligible || lmrEligible) && (
                        <div className="card">
                            <div className="card-title">🚄 Transit-Oriented Development & LMR</div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                {todEligible && <span className="badge badge-green">✓ TOD Eligible</span>}
                                {lmrEligible && <span className="badge badge-blue">✓ LMR Eligible</span>}
                            </div>
                        </div>
                    )}

                    {/* Investment Scorecard */}
                    <div className="card">
                        <div className="card-title">🎯 Investment Scorecard</div>
                        <div className="scorecard-grid">
                            <div className="score-item">
                                <div className="score-label">Demand</div>
                                <div className="score-value">{scores.demand}/10</div>
                            </div>
                            <div className="score-item">
                                <div className="score-label">Supply</div>
                                <div className="score-value">{scores.supply}/10</div>
                            </div>
                            <div className="score-item">
                                <div className="score-label">Location</div>
                                <div className="score-value">{scores.location}/10</div>
                            </div>
                            <div className="score-item">
                                <div className="score-label">Growth</div>
                                <div className="score-value">{scores.growth}/10</div>
                            </div>
                            <div className="score-item">
                                <div className="score-label">Cashflow</div>
                                <div className="score-value">{scores.cashflow}/10</div>
                            </div>
                            <div className="score-item">
                                <div className="score-label">Development</div>
                                <div className="score-value">{scores.development}/10</div>
                            </div>
                            <div className="score-item">
                                <div className="score-label">TOD</div>
                                <div className="score-value">{scores.tod}/10</div>
                            </div>
                            <div className="score-item">
                                <div className="score-label">Risk</div>
                                <div className="score-value">{scores.risk}/10</div>
                            </div>
                        </div>
                        <div className="score-item" style={{ background: '#2E75B6', color: 'white', padding: '16px', textAlign: 'center', borderRadius: '8px', marginTop: '12px' }}>
                            <div className="score-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Overall Score</div>
                            <div style={{ fontSize: '32px', fontWeight: '700' }}>{scores.overall}/10</div>
                        </div>
                    </div>

                    {/* Full Report */}
                    <div className="card">
                        <button style={{ padding: '12px 20px', width: '100%', background: '#2E75B6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px' }} onClick={() => setShowReport(!showReport)}>
                            {showReport ? '📄 Hide Full Report' : '📄 Show Full Report'}
                        </button>

                        {showReport && (
                            <div className="report-section">
                                <div className="report-section-title">Investment Analysis Report</div>

                                <div className="report-section-title" style={{ fontSize: '14px', marginTop: '20px' }}>Financial Summary</div>
                                <div className="report-grid">
                                    <div className="report-item">
                                        <div className="report-item-label">Purchase Price</div>
                                        <div className="report-item-value">{formatCurrency(purchasePrice)}</div>
                                    </div>
                                    <div className="report-item">
                                        <div className="report-item-label">Stamp Duty</div>
                                        <div className="report-item-value">{formatCurrency(stampDuty)}</div>
                                    </div>
                                    <div className="report-item">
                                        <div className="report-item-label">Total Investment</div>
                                        <div className="report-item-value">{formatCurrency(totalInvestment)}</div>
                                    </div>
                                    <div className="report-item">
                                        <div className="report-item-label">Loan Amount</div>
                                        <div className="report-item-value">{formatCurrency(loanAmount)}</div>
                                    </div>
                                    <div className="report-item">
                                        <div className="report-item-label">Equity Required</div>
                                        <div className="report-item-value">{formatCurrency(equity)}</div>
                                    </div>
                                    <div className="report-item">
                                        <div className="report-item-label">Annual Rent</div>
                                        <div className="report-item-value">{formatCurrency(annualRent)}</div>
                                    </div>
                                    <div className="report-item">
                                        <div className="report-item-label">Gross Yield</div>
                                        <div className="report-item-value">{grossYield.toFixed(2)}%</div>
                                    </div>
                                    <div className="report-item">
                                        <div className="report-item-label">Net Yield</div>
                                        <div className="report-item-value" style={{ color: netYield >= 0 ? '#22c55e' : '#ef4444' }}>{netYield.toFixed(2)}%</div>
                                    </div>
                                </div>

                                <div className="report-section-title" style={{ fontSize: '14px', marginTop: '20px' }}>Monthly Cashflow</div>
                                <div className="report-grid">
                                    <div className="report-item">
                                        <div className="report-item-label">Monthly Rent</div>
                                        <div className="report-item-value">{formatCurrency(monthlyRent)}</div>
                                    </div>
                                    <div className="report-item">
                                        <div className="report-item-label">Mortgage Payment</div>
                                        <div className="report-item-value">{formatCurrency(monthlyRepayment)}</div>
                                    </div>
                                    <div className="report-item">
                                        <div className="report-item-label">Council Rates</div>
                                        <div className="report-item-value">{formatCurrency(councilRates)}</div>
                                    </div>
                                    <div className="report-item">
                                        <div className="report-item-label">Insurance</div>
                                        <div className="report-item-value">{formatCurrency(insurance)}</div>
                                    </div>
                                    <div className="report-item">
                                        <div className="report-item-label">Maintenance</div>
                                        <div className="report-item-value">{formatCurrency(maintenanceFund)}</div>
                                    </div>
                                    <div className="report-item">
                                        <div className="report-item-label">Vacancy Loss (8%)</div>
                                        <div className="report-item-value">{formatCurrency(vacancyLoss)}</div>
                                    </div>
                                    <div className="report-item">
                                        <div className="report-item-label">Total Expenses</div>
                                        <div className="report-item-value">{formatCurrency(totalMonthlyExpenses)}</div>
                                    </div>
                                    <div className="report-item" style={{ background: '#2E75B6', borderLeftColor: '#2E75B6', color: 'white' }}>
                                        <div className="report-item-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Net Cashflow</div>
                                        <div className="report-item-value" style={{ color: 'white' }}>{formatCurrency(monthlyNetCashflow)}</div>
                                    </div>
                                </div>

                                <div className="report-section-title" style={{ fontSize: '14px', marginTop: '20px' }}>Risk Factors</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div className="risk-item">
                                        <span className="risk-indicator">{floodZone ? '⚠️' : '✅'}</span>
                                        <span>Flood Zone: {floodZone ? 'YES - Risk present' : 'No risk'}</span>
                                    </div>
                                    <div className="risk-item">
                                        <span className="risk-indicator">{bushfireZone !== 'No' ? '⚠️' : '✅'}</span>
                                        <span>Bushfire Zone: {bushfireZone !== 'No' ? `${bushfireZone} - Risk present` : 'No risk'}</span>
                                    </div>
                                    <div className="risk-item">
                                        <span className="risk-indicator">{heritage ? '⚠️' : '✅'}</span>
                                        <span>Heritage Listed: {heritage ? 'YES - Restrictions apply' : 'No restrictions'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sticky Cashflow Panel */}
                <div className="cashflow-panel">
                    <div style={{ textAlign: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '2px solid #2E75B6' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>Quick Overview</div>
                    </div>

                    <div className="metric">
                        <div className="metric-label">Weekly Rent</div>
                        <div className="metric-value">{formatCurrency(weeklyRent)}</div>
                        <div className="metric-secondary">Annual: {formatCurrency(annualRent)}</div>
                    </div>

                    <div className="metric">
                        <div className="metric-label">Gross Yield</div>
                        <div className="metric-value">{grossYield.toFixed(2)}%</div>
                        <div className="metric-secondary">Income only</div>
                    </div>

                    <div className="metric">
                        <div className="metric-label">Monthly Mortgage</div>
                        <div className="metric-value">{formatCurrency(monthlyRepayment)}</div>
                        <div className="metric-secondary">{repaymentType} @ {interestRate}%</div>
                    </div>

                    <div className="metric">
                        <div className="metric-label">Monthly Expenses</div>
                        <div className="metric-value">{formatCurrency(totalMonthlyExpenses)}</div>
                        <div className="metric-secondary">All costs</div>
                    </div>

                    <div className="metric">
                        <div className="metric-label">Monthly Cashflow</div>
                        <div className={`metric-value ${monthlyNetCashflow >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(monthlyNetCashflow)}</div>
                        <div className="metric-secondary">Net after expenses</div>
                    </div>

                    <div className="metric">
                        <div className="metric-label">Net Yield</div>
                        <div className={`metric-value ${netYield >= 0 ? 'positive' : 'negative'}`}>{netYield.toFixed(2)}%</div>
                        <div className="metric-secondary">After all costs</div>
                    </div>

                    <div className="metric">
                        <div className="metric-label">LVR</div>
                        <div className="metric-value">{lvr}%</div>
                        <div className="metric-secondary">Equity: {(100-lvr)}%</div>
                    </div>

                    <div className="metric">
                        <div className="metric-label">Overall Score</div>
                        <div className="metric-value">{scores.overall}/10</div>
                        <div className="metric-secondary">Investment quality</div>
                    </div>
                </div>
            </div>
        </div>
    );
}


/**
 * Pure data-normalization utilities for the Sambet registry.
 *
 * These functions have NO Cloudflare dependencies so they can be reused by the
 * seed generator (run under plain Node) and unit-tested without workerd.
 *
 * The registry was migrated from a manually maintained Excel file where the
 * same state, bank or project was spelled dozens of different ways. We keep
 * the *raw* value the user entered, and additionally store a normalized value
 * used for filtering, statistics and duplicate detection.
 */

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

/** Trim, collapse internal whitespace, strip stray control characters. */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Case-folded, whitespace-collapsed key used for duplicate detection. */
export function normKey(value: string): string {
  return cleanText(value).toLowerCase().replace(/\s+/g, ' ');
}

/* ------------------------------------------------------------------ */
/* Phone numbers (Nigeria)                                             */
/* ------------------------------------------------------------------ */

/**
 * Normalize a Nigerian phone number to E.164 (+234XXXXXXXXX) where possible.
 *
 * Handles the variants present in the legacy workbook: missing leading 0,
 * letters instead of digits ("O" for 0), commas, asterisks, apostrophes,
 * spaces, "+234" prefixes and full international formatting.
 *
 * Returns '' when the value cannot be interpreted as a phone number.
 */
export function normalizePhone(value: string): string {
  let v = cleanText(value);
  if (!v) return '';
  // Letter O is frequently typed where 0 is meant (both ways).
  v = v.replace(/[Oo]/g, '0');
  const digits = v.replace(/\D/g, '');
  if (!digits) return '';

  const d = digits.startsWith('234') ? digits.slice(3) : digits;
  if (d.length === 11 && d.startsWith('0')) return `+234${d.slice(1)}`;
  if (d.length === 10) {
    if (d[0] === '7' || d[0] === '8' || d[0] === '9') return `+234${d}`;
    if (d[0] === '0') return `+234${d.slice(1)}`;
  }
  if (d.length === 11 && d[0] !== '0') return `+234${d.slice(-10)}`;
  // Unrecognized: keep digits only (still better than raw junk), empty if none.
  return d;
}

/** Human friendly display for a stored (E.164) phone. */
export function displayPhone(value: string): string {
  const n = cleanText(value);
  if (!n) return '';
  const m = n.replace(/\D/g, '');
  if (m.length === 13 && m.startsWith('234')) return `+234 ${m.slice(3, 6)} ${m.slice(6, 9)} ${m.slice(9)}`;
  return n;
}

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(value: string): string {
  const v = cleanText(value).toLowerCase();
  if (!v) return '';
  return EMAIL_RE.test(v) ? v : '';
}

/* ------------------------------------------------------------------ */
/* Nigerian states                                                     */
/* ------------------------------------------------------------------ */

export const NIGERIAN_STATES = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
  'FCT (Abuja)',
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

function keyOf(raw: string): string {
  // Strip diacritics first ("UNIÓN" → "UNION") so accented letters don't
  // vanish from the key.
  const stripped = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return stripped.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Mapping of the many spellings found in the legacy workbook (plus likely
 * future variants) to canonical state names. Keys are A-Z0-9 only, upper case.
 */
const STATE_ALIASES: Record<string, NigerianState> = {
  // Abia
  ABIA: 'Abia',
  // Adamawa
  ADAMAWA: 'Adamawa',
  // Akwa Ibom
  AKWAIBOM: 'Akwa Ibom',
  // Anambra
  ANAMBRA: 'Anambra',
  ANAMBARA: 'Anambra',
  // Bauchi
  BAUCHI: 'Bauchi',
  // Bayelsa
  BAYELSA: 'Bayelsa',
  // Benue
  BENUE: 'Benue',
  // Borno
  BORNO: 'Borno',
  // Cross River
  CROSSRIVER: 'Cross River',
  CRS: 'Cross River',
  // Delta
  DELTA: 'Delta',
  ZDELTA: 'Delta',
  // Ebonyi
  EBONYI: 'Ebonyi',
  // Edo
  EDO: 'Edo',
  // Ekiti
  EKITI: 'Ekiti',
  // Enugu
  ENUGU: 'Enugu',
  // Gombe
  GOMBE: 'Gombe',
  // Imo
  IMO: 'Imo',
  IMOSTARE: 'Imo', // "IMO STARE" typo
  // Jigawa
  JIGAWA: 'Jigawa',
  // Kaduna
  KADUNA: 'Kaduna',
  // Kano
  KANO: 'Kano',
  // Katsina
  KATSINA: 'Katsina',
  // Kebbi
  KEBBI: 'Kebbi',
  // Kogi
  KOGI: 'Kogi',
  KOGII: 'Kogi',
  KUJE: 'Kogi', // mis-spelling seen in legacy data
  // Kwara
  KWARA: 'Kwara',
  // Lagos
  LAGOS: 'Lagos',
  LAGOD: 'Lagos',
  // Nasarawa
  NASARAWA: 'Nasarawa',
  NASSARAWA: 'Nasarawa',
  // Niger (state) — note: "NIGERIA" is deliberately NOT mapped here.
  NIGER: 'Niger',
  // Ogun
  OGUN: 'Ogun',
  IGUN: 'Ogun', // mis-spelling seen in legacy data
  ABEOKUTASOUTH: 'Ogun', // city/LGA entered in the state column
  // Ondo
  ONDO: 'Ondo',
  // Osun
  OSUN: 'Osun',
  // Oyo
  OYO: 'Oyo',
  '0YO': 'Oyo', // zero typed where letter O was meant
  IBADAN: 'Oyo', // city entered in the state column
  // Plateau
  PLATEAU: 'Plateau',
  PLATEU: 'Plateau',
  PLATEUE: 'Plateau',
  // Rivers
  RIVERS: 'Rivers',
  RIVER: 'Rivers',
  RIVRES: 'Rivers',
  // Sokoto
  SOKOTO: 'Sokoto',
  // Taraba
  TARABA: 'Taraba',
  // Yobe
  YOBE: 'Yobe',
  // Zamfara
  ZAMFARA: 'Zamfara',
  // FCT
  FCT: 'FCT (Abuja)',
  ABUJA: 'FCT (Abuja)',
  FCTABUJA: 'FCT (Abuja)',
  ABUJAFCT: 'FCT (Abuja)',
  FCTAMAC: 'FCT (Abuja)',
  LAGOSMAINLAND: 'Lagos',
  IDEATOSOUTH: 'Imo', // LGA entered in the state column
};

/**
 * Map a free-text state value to a canonical Nigerian state.
 * Returns null when the value is empty or not recognizably a state
 * (callers keep the raw text for display and treat it as "unknown").
 */
export function normalizeState(value: string): NigerianState | null {
  const raw = cleanText(value);
  if (!raw) return null;
  const k = keyOf(raw);
  if (!k) return null;
  if (STATE_ALIASES[k]) return STATE_ALIASES[k] ?? null;
  // Strip a trailing "STATE" / "STATES" and retry (e.g. "OSUN STATE").
  const stripped = k.replace(/STATE[S]?$/, '');
  if (stripped && STATE_ALIASES[stripped]) return STATE_ALIASES[stripped] ?? null;
  return null;
}

/* ------------------------------------------------------------------ */
/* Banks                                                               */
/* ------------------------------------------------------------------ */

export const BANK_LIST = [
  'Access Bank',
  'Bank of Agriculture',
  'Ecobank',
  'FCMB',
  'Fidelity Bank',
  'First Bank of Nigeria',
  'FBNQuest',
  'Globus Bank',
  'Guaranty Trust Bank (GTBank)',
  'Jaiz Bank',
  'Keystone Bank',
  'Moniepoint',
  'PalmPay',
  'Polaris Bank',
  'Providus Bank',
  'Signature Bank',
  'Stanbic IBTC',
  'Sterling Bank',
  'SunTrust Bank',
  'Taj Bank',
  'Union Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Unity Bank',
  'Wema Bank',
  'Zenith Bank',
  'Other bank',
  'Fintech & MFB',
] as const;

export type BankName = (typeof BANK_LIST)[number];

/**
 * Alias keys are the value with every non A-Z0-9 character removed (see
 * keyOf), so e.g. "U B A", "U,B,A" and "UBA" all map to the key "UBA".
 */
const BANK_ALIASES: Record<string, BankName> = {
  ACCESS: 'Access Bank',
  ACCESSBANK: 'Access Bank',
  ACCESSBANKPLC: 'Access Bank',
  ACCES: 'Access Bank',
  ACCESBANK: 'Access Bank',
  ACCCESS: 'Access Bank',
  BANKOFAGRICULTURE: 'Bank of Agriculture',
  ECO: 'Ecobank',
  ECOBANK: 'Ecobank',
  ECOBANKPLC: 'Ecobank',
  FCMB: 'FCMB',
  FCMBBANK: 'FCMB',
  FCMBPLC: 'FCMB',
  FIRSTCITYMONUMENT: 'FCMB',
  FIRSTCITYMONUMENTBANK: 'FCMB',
  FIRSTCITYMONUMENTBANKFCMB: 'FCMB',
  FIDELITY: 'Fidelity Bank',
  FIDELITYBANK: 'Fidelity Bank',
  FIDELITYBANKPLC: 'Fidelity Bank',
  FELIDITYBANK: 'Fidelity Bank',
  FIDELLITY: 'Fidelity Bank',
  FIRST: 'First Bank of Nigeria',
  FIRSTBANK: 'First Bank of Nigeria',
  FIRSTBANKOFNIGERIA: 'First Bank of Nigeria',
  FIRSTBANKOFNIGERIALIMITED: 'First Bank of Nigeria',
  FIRSTBANKPLC: 'First Bank of Nigeria',
  FBNQUEST: 'FBNQuest',
  GLOBUS: 'Globus Bank',
  GLOBUSBANK: 'Globus Bank',
  GT: 'Guaranty Trust Bank (GTBank)',
  GTB: 'Guaranty Trust Bank (GTBank)',
  GTBANK: 'Guaranty Trust Bank (GTBank)',
  GTBBANK: 'Guaranty Trust Bank (GTBank)',
  GTBANKPLC: 'Guaranty Trust Bank (GTBank)',
  GUARANTYTRUSTBANK: 'Guaranty Trust Bank (GTBank)',
  GUARANTYTRUST: 'Guaranty Trust Bank (GTBank)',
  JAIZ: 'Jaiz Bank',
  JAIZBANK: 'Jaiz Bank',
  KEYSTONE: 'Keystone Bank',
  KEYSTONES: 'Keystone Bank',
  KEYSTONESBANK: 'Keystone Bank',
  KEYSTONEBANK: 'Keystone Bank',
  MONIEPOINT: 'Moniepoint',
  MONIEPOINTMICRO: 'Moniepoint',
  PALMPAY: 'PalmPay',
  POLARIS: 'Polaris Bank',
  POLARISBANK: 'Polaris Bank',
  POLARISBAMK: 'Polaris Bank',
  POLARISBANKPLC: 'Polaris Bank',
  PROVIDUS: 'Providus Bank',
  PROVIDUSBANK: 'Providus Bank',
  PROVIDUSUNITY: 'Providus Bank',
  UNITYPROVIDUS: 'Providus Bank',
  PROVIDUSUNITYBANK: 'Providus Bank',
  SIGNATURE: 'Signature Bank',
  SIGNATUREBANK: 'Signature Bank',
  STANBIC: 'Stanbic IBTC',
  STANBICBANK: 'Stanbic IBTC',
  STANBICIBTC: 'Stanbic IBTC',
  STANBICIBTCBANK: 'Stanbic IBTC',
  STANBICIBTCBANKPLC: 'Stanbic IBTC',
  IBTC: 'Stanbic IBTC',
  STERLING: 'Sterling Bank',
  STERLINGBANK: 'Sterling Bank',
  STERLY: 'Sterling Bank',
  SUNTRUST: 'SunTrust Bank',
  SUNTRUSTBANK: 'SunTrust Bank',
  TAJ: 'Taj Bank',
  TAJBANK: 'Taj Bank',
  UNION: 'Union Bank of Nigeria',
  UNIONBANK: 'Union Bank of Nigeria',
  UNIONBANKOFNIGERIA: 'Union Bank of Nigeria',
  UNIONBANKPLC: 'Union Bank of Nigeria',
  GUARANTYTRUSTBANKGTBANK: 'Guaranty Trust Bank (GTBank)',
  PREMIUMSTRUT: 'Other bank',
  UBA: 'United Bank for Africa (UBA)',
  UBABANK: 'United Bank for Africa (UBA)',
  UBAPLC: 'United Bank for Africa (UBA)',
  UNITEDBANKFORAFRICA: 'United Bank for Africa (UBA)',
  UNITEDBANKFORAFRICAUBA: 'United Bank for Africa (UBA)',
  UNITEDBANKFORAFRICAPLCUBA: 'United Bank for Africa (UBA)',
  UNITY: 'Unity Bank',
  UNITYBANK: 'Unity Bank',
  WEMA: 'Wema Bank',
  WEMABANK: 'Wema Bank',
  WEMABANKPLC: 'Wema Bank',
  ZENITH: 'Zenith Bank',
  ZENITHBANK: 'Zenith Bank',
  ZENITHBANKPLC: 'Zenith Bank',
  // Microfinance / niche banks outside the main list
  ACCION: 'Fintech & MFB',
  ACCIONMFB: 'Fintech & MFB',
  KUDA: 'Fintech & MFB',
  KUDAMFB: 'Fintech & MFB',
  NIRSAL: 'Fintech & MFB',
  AFEMAIMICROFINANCE: 'Other bank',
  ALBARAKAHMICROFINANCEBANK: 'Other bank',
  ALBARAKAHMFCB: 'Other bank',
  MINTMICROFINANCE: 'Other bank',
  SEAPMFB: 'Other bank',
  ALTERNATIVE: 'Other bank',
  ALTERNATIVEBANK: 'Other bank',
  GATEWAYMORTGAGE: 'Other bank',
  PREMIUMTRUST: 'Other bank',
  PREMIUMTRUSTBANK: 'Other bank',
  PARALLEX: 'Other bank',
  PARALLEXBANK: 'Other bank',
  CALBANK: 'Other bank',
  CCBANK: 'Other bank',
  REPUBLICBANK: 'Other bank',
  TITAN: 'Other bank',
  TITANTRUST: 'Other bank',
  TITANTRUSTBANK: 'Other bank',
  TFC: 'Other bank',
  TFCBANK: 'Other bank',
  PALLADIUM: 'Other bank',
  PALLADIUMBANK: 'Other bank',
  CORONATION: 'Other bank',
  CORONATIONMERCHANTBANK: 'Other bank',
  MERIDIAN: 'Other bank',
  MERIDIANS: 'Other bank',
  MERIDIANSBANK: 'Other bank',
  ENTERPRISE: 'Other bank',
  ENTERPRISEBANK: 'Other bank',
};

/**
 * Map a free-text bank value to a canonical bank name.
 * Returns null for empty values and for values that are clearly not a bank
 * name (e.g. an account number or an e-mail typed into the bank column —
 * both present in the legacy workbook).
 */
export function normalizeBank(value: string): BankName | null {
  const raw = cleanText(value);
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return null; // account number
  if (raw.includes('@')) return null; // e-mail address
  const k = keyOf(raw);
  if (!k) return null;
  if (BANK_ALIASES[k]) return BANK_ALIASES[k] ?? null;
  const noPlc = k.replace(/PLC$/, '');
  if (noPlc !== k && BANK_ALIASES[noPlc]) return BANK_ALIASES[noPlc] ?? null;
  const noBank = k.replace(/BANK$/, '');
  if (noBank !== k && BANK_ALIASES[noBank]) return BANK_ALIASES[noBank] ?? null;
  return null;
}

/* ------------------------------------------------------------------ */
/* Account numbers                                                     */
/* ------------------------------------------------------------------ */

/** Keep digits only; Nigerian account numbers are 6–10 digits (some 12). */
export function normalizeAccountNumber(value: string): string {
  const d = cleanText(value).replace(/\D/g, '');
  if (d.length >= 6 && d.length <= 12) return d;
  return d; // keep what we can; validation layer decides acceptability
}

/* ------------------------------------------------------------------ */
/* Project categories                                                  */
/* ------------------------------------------------------------------ */

export const PROJECT_CATEGORIES = [
  'Roads & Infrastructure',
  'Water & Sanitation',
  'Energy & Lighting',
  'Education',
  'Health',
  'Housing & Real Estate',
  'Agriculture & Food',
  'Commerce & Industry',
  'ICT & Technology',
  'Security & Defence',
  'Environment & Cleanup',
  'Faith & Social',
  'Other',
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

interface CategoryRule {
  category: ProjectCategory;
  keywords: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Roads & Infrastructure',
    keywords: [
      'road', 'drainage', 'drain', 'bridge', 'infrastructure', 'asphalt',
      'tarring', 'culvert', 'flyover', 'stabilisation', 'stabilization',
    ],
  },
  {
    category: 'Water & Sanitation',
    keywords: [
      'borehole', 'bore hole', 'borehole', 'bore', 'water', 'pipeline',
      'sanitation', 'sewer', 'water treatment', 'aquifer',
    ],
  },
  {
    category: 'Energy & Lighting',
    keywords: [
      'solar', 'electricity', 'electrification', 'electric', 'power',
      'street light', 'light', 'grid', 'generator',
    ],
  },
  {
    category: 'Education',
    keywords: [
      'school', 'classroom', 'education', 'educational', 'library',
      'university', 'college', 'academy', 'student', 'teaching',
    ],
  },
  {
    category: 'Health',
    keywords: [
      'hospital', 'health', 'clinic', 'medical', 'drug', 'pharmacy',
      'ambulance', 'maternity',
    ],
  },
  {
    category: 'Housing & Real Estate',
    keywords: [
      'housing', 'estate', 'real estate', 'building', 'buildings',
      'residential', 'apartment', 'condominium', 'dwelling',
    ],
  },
  {
    category: 'Agriculture & Food',
    keywords: [
      'farm', 'farming', 'agro', 'poultry', 'cassava', 'rice', 'vegetable',
      'fishery', 'fish', 'animal', 'livestock', 'crop', 'feed', 'food',
      'bread', 'bakery', 'husbandry',
    ],
  },
  {
    category: 'Commerce & Industry',
    keywords: [
      'mall', 'market', 'shop', 'store', 'industry', 'processing',
      'factory', 'trading', 'trade', 'commerce', 'supermarket', 'depot',
    ],
  },
  {
    category: 'ICT & Technology',
    keywords: [
      'ict', 'computer', 'technology', 'digital', 'telecom', 'internet',
      'software', 'data centre', 'data center',
    ],
  },
  {
    category: 'Security & Defence',
    keywords: ['police', 'security', 'civil defence', 'cctv', 'guard'],
  },
  {
    category: 'Environment & Cleanup',
    keywords: ['environment', 'environmental', 'cleanup', 'clean-up', 'waste'],
  },
  {
    category: 'Faith & Social',
    keywords: [
      'church', 'ministry', 'ministries', 'minister', 'mosque', 'temple',
      'faith', 'worship', 'welfare', 'orphanage', 'humanitarian', 'charity',
    ],
  },
];

/**
 * Classify free-text project descriptions into one canonical category.
 * Deterministic: the earliest keyword occurrence in the (lower-cased) text
 * wins, ties broken by rule order above.
 */
export function categorizeProject(value: string): ProjectCategory {
  const text = ` ${cleanText(value).toLowerCase()} `;
  if (!text.trim()) return 'Other';
  let best: { pos: number; ruleIndex: number; category: ProjectCategory } | null = null;
  CATEGORY_RULES.forEach((rule, ruleIndex) => {
    for (const kw of rule.keywords) {
      // Word-ish boundary match to avoid "water" inside "watermelon"? keep simple substring.
      const pos = text.indexOf(kw);
      if (pos !== -1 && (!best || pos < best.pos || (pos === best.pos && ruleIndex < best.ruleIndex))) {
        best = { pos, ruleIndex, category: rule.category };
      }
    }
  });
  return best ? (best as { category: ProjectCategory }).category : 'Other';
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export const ORG_STATUSES = [
  'registered',
  'in_review',
  'approved',
  'rejected',
  'inactive',
] as const;

export type OrgStatus = (typeof ORG_STATUSES)[number];

// Single source of truth for hotspots, choices and scoring.
// Imported by the React app (to render) and by the Lambda (to score), so the
// browser never decides how many points an action is worth.

export type ZoneId = 'campus' | 'temple';
export type MetricKey = 'gridCut' | 'kwh' | 'metals' | 'co2' | 'compost' | 'income' | 'plastic';
export type Delta = Partial<Record<MetricKey, number>>;
export type BinId = 'compost' | 'recycle' | 'reject';

export interface Choice {
  id: string;
  label: string;
  sub: string;
  points: number;
  sustainable?: boolean;
  delta: Delta;
  outcome: string;
}

export interface Hotspot {
  id: string;
  zone: ZoneId;
  /** Tile rectangle on the zone map (40 x 24 grid). */
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  eyebrow: string;
  desc: string;
  facts: string[];
  kind: 'choice' | 'sort';
  choices?: Choice[];
}

export interface SortItem {
  id: string;
  name: string;
  bin: BinId;
  color: string;
}

export interface ActionInput {
  hotspotId: string;
  choiceId?: string;
  placements?: Record<string, string>;
}

export interface ActionResult {
  hotspotId: string;
  zone: ZoneId;
  choiceId?: string;
  points: number;
  delta: Delta;
  outcome: string;
  correct?: number;
  total?: number;
}

export class ScoringError extends Error {}

export const ZONES: Record<ZoneId, { name: string; blurb: string; tags: string[] }> = {
  campus: {
    name: 'College Campus',
    blurb: 'Rooftop solar, e-waste routing and an EV bus nudge across an engineering campus in Pune.',
    tags: ['Energy', 'E-waste', 'EV bus'],
  },
  temple: {
    name: 'Omkareshwar Temple',
    blurb: 'Ganeshotsav visarjan day on the Mutha ghats. Keep Nirmalya out of the river with SWaCH waste pickers.',
    tags: ['Nirmalya', 'Informal recyclers'],
  },
};

export const METRICS: Record<MetricKey, { label: string; unit: string; zone: ZoneId }> = {
  gridCut: { label: 'Grid dependency', unit: '% of campus demand from the grid', zone: 'campus' },
  kwh: { label: 'Solar offset', unit: 'kWh per year', zone: 'campus' },
  metals: { label: 'Heavy metals diverted', unit: 'kg (lead, mercury, cadmium)', zone: 'campus' },
  co2: { label: 'CO₂ prevented', unit: 'kg CO₂e per year', zone: 'campus' },
  compost: { label: 'Compost generated', unit: 'kg from Nirmalya', zone: 'temple' },
  income: { label: 'Informal recycler income', unit: 'earned by SWaCH members', zone: 'temple' },
  plastic: { label: 'Plastic kept out of river', unit: 'kg', zone: 'temple' },
};

export const HOTSPOTS: Hotspot[] = [
  {
    id: 'solar-eng', zone: 'campus', x: 2, y: 2, w: 8, h: 4, kind: 'choice',
    title: 'Engineering Block roof',
    eyebrow: 'Energy optimizer / rooftop solar',
    desc: 'Flat RCC roof with an 1,800 m² footprint. After water tanks, lift rooms and shading, about 60% is usable for panels.',
    facts: [
      'Usable roof about 1,080 m², so roughly a 108 kWp array at 10 m² per kWp',
      'Pune yield is about 1,500 kWh per kWp per year',
      'Campus uses about 600,000 kWh a year from the grid',
      'India grid emission factor is about 0.716 kg CO₂ per kWh',
    ],
    choices: [
      { id: 'full', label: 'Install on the full usable roof', sub: '108 kWp, about 162,000 kWh a year', points: 1160, sustainable: true,
        delta: { gridCut: 27, kwh: 162000, co2: 116000 }, outcome: 'Campus grid dependency drops 27 points. The array pays for itself in about 4 years.' },
      { id: 'half', label: 'Install on half the roof', sub: '54 kWp, about 81,000 kWh a year', points: 580,
        delta: { gridCut: 13.5, kwh: 81000, co2: 58000 }, outcome: 'A decent start. The other half of the roof stays empty for now.' },
      { id: 'none', label: 'Leave the roof empty', sub: 'Keep buying all power from the grid', points: 0,
        delta: {}, outcome: 'Nothing changes. The roof keeps baking in the sun.' },
    ],
  },
  {
    id: 'solar-admin', zone: 'campus', x: 28, y: 2, w: 8, h: 4, kind: 'choice',
    title: 'Admin building roof',
    eyebrow: 'Energy optimizer / rooftop solar',
    desc: 'A smaller 900 m² roof with a north-facing parapet. About 540 m² is usable.',
    facts: ['About a 54 kWp array, so roughly 81,000 kWh a year', 'Offsets about 58 tonnes of CO₂e each year'],
    choices: [
      { id: 'full', label: 'Install on the full usable roof', sub: '54 kWp, about 81,000 kWh a year', points: 580, sustainable: true,
        delta: { gridCut: 13.5, kwh: 81000, co2: 58000 }, outcome: 'The admin block now runs its daytime load on sunlight.' },
      { id: 'none', label: 'Leave the roof empty', sub: 'Keep buying all power from the grid', points: 0,
        delta: {}, outcome: 'Nothing changes.' },
    ],
  },
  {
    id: 'ewaste-lab', zone: 'campus', x: 16, y: 10, w: 6, h: 4, kind: 'choice',
    title: 'Computer lab clear-out',
    eyebrow: 'Waste router / e-waste',
    desc: '120 desktops and 40 CRT monitors are being retired. Where does the hardware go?',
    facts: [
      'About 2,400 kg of e-waste in this batch',
      'About 2.5% by mass is lead, mercury and cadmium, roughly 60 kg',
      'MPCB-authorised recyclers recover metals in closed systems',
    ],
    choices: [
      { id: 'authorised', label: 'Send to an MPCB-authorised e-waste recycler', sub: 'Formal channel with a certificate of destruction', points: 1200, sustainable: true,
        delta: { metals: 60, co2: 3600 }, outcome: '60 kg of heavy metals never reach soil or groundwater. Copper and gold are recovered.' },
      { id: 'kabadiwala', label: 'Sell to a kabadiwala for scrap', sub: 'Fast cash, but boards get acid-stripped in the open', points: 150,
        delta: { metals: 8, co2: 400 }, outcome: 'Some metal is recovered, but circuit boards are burned in the open downstream.' },
      { id: 'store', label: 'Pile it in the storeroom', sub: 'Deal with it next year', points: 0,
        delta: {}, outcome: 'The lab gets its space back. The problem does not go away.' },
    ],
  },
  {
    id: 'ev-parking', zone: 'campus', x: 2, y: 10, w: 10, h: 3, kind: 'choice',
    title: 'Congested parking lane',
    eyebrow: 'Emissions reducer / EV nudge',
    desc: '40 single-occupancy cars crawl in here every morning. The lane could become a dedicated electric campus bus stop instead.',
    facts: [
      '40 cars × 24 km a day × 200 days is 192,000 car-km a year',
      'A petrol car emits about 0.15 kg CO₂ per km, so 28,800 kg a year',
      'One grid-charged e-bus on the same route emits about 4,100 kg a year',
    ],
    choices: [
      { id: 'ev-stop', label: 'Replace the lane with an EV bus stop', sub: 'One e-bus replaces 40 cars', points: 1235, sustainable: true,
        delta: { co2: 24700 }, outcome: '24.7 tonnes of CO₂e prevented every year, and the lane is quiet by 9 am.' },
      { id: 'more-parking', label: 'Add a second parking lane', sub: 'More cars, more idling', points: 0,
        delta: { co2: -6000 }, outcome: 'More parking invites more cars. Emissions go up by 6 tonnes a year.' },
    ],
  },
  {
    id: 'nirmalya-ghat', zone: 'temple', x: 12, y: 14, w: 14, h: 3, kind: 'sort',
    title: 'Nirmalya segregation at the ghats',
    eyebrow: 'Festival simulation / sort with SWaCH',
    desc: 'Devotees are handing over visarjan offerings. Help the SWaCH waste pickers sort each item before it reaches the water. Tap an item, then tap a bin.',
    facts: [
      'Pune collects hundreds of tonnes of Nirmalya during Ganeshotsav',
      'SWaCH is a Pune cooperative of over 3,000 waste pickers',
      'Every correct sort means compost, recycler income, or a cleaner river',
    ],
  },
  {
    id: 'kalash', zone: 'temple', x: 29, y: 12, w: 4, h: 2, kind: 'choice',
    title: 'Nirmalya Kalash collection point',
    eyebrow: 'Informal recyclers / collection',
    desc: 'How should offerings be collected at the ghat steps today?',
    facts: [
      'A staffed kalash at the steps captures about 2 tonnes per festival day',
      'Unsorted offerings in plastic bags go straight into the Mutha',
    ],
    choices: [
      { id: 'staffed', label: 'Staffed kalash and sorting table at the steps', sub: 'SWaCH members paid per kg sorted', points: 900, sustainable: true,
        delta: { compost: 2000, income: 5000, plastic: 300 }, outcome: '2 tonnes of flowers become compost. SWaCH members earn ₹5,000 for the day.' },
      { id: 'signboard', label: 'Just a signboard asking devotees to sort', sub: 'No staff, no table', points: 150,
        delta: { compost: 300, plastic: 40 }, outcome: 'A few people comply. Most bags still hit the water.' },
      { id: 'none', label: 'No collection point', sub: 'Leave it to the river', points: 0,
        delta: {}, outcome: 'Offerings go into the river in their plastic bags.' },
    ],
  },
  {
    id: 'vendors', zone: 'temple', x: 5, y: 9, w: 5, h: 5, kind: 'choice',
    title: 'Flower and prasad stalls',
    eyebrow: 'Plastic at source / vendors',
    desc: 'Five stalls hand out offerings in thin plastic bags. Switch them to cloth bags and leaf plates?',
    facts: [
      'About 6,000 bags a day leave these stalls on festival days',
      'Thin carry bags are banned in Maharashtra but still common',
    ],
    choices: [
      { id: 'cloth', label: 'Supply cloth bags and leaf plates to all stalls', sub: 'One-time kit, zero plastic', points: 600, sustainable: true,
        delta: { plastic: 120, compost: 150, income: 800 }, outcome: 'No new plastic enters the ghats from the stalls. Leaf plates go to compost.' },
      { id: 'none', label: 'Leave it as is', sub: '', points: 0,
        delta: {}, outcome: 'Nothing changes.' },
    ],
  },
];

export const SORT_ITEMS: SortItem[] = [
  { id: 'marigold', name: 'Marigold garlands', bin: 'compost', color: '#ffb02e' },
  { id: 'banana-leaf', name: 'Banana leaves', bin: 'compost', color: '#5fbf3a' },
  { id: 'coconut', name: 'Coconut shells', bin: 'compost', color: '#9a6b3f' },
  { id: 'carry-bag', name: 'Plastic carry bag', bin: 'recycle', color: '#dbe7ff' },
  { id: 'incense-box', name: 'Incense box (card)', bin: 'recycle', color: '#d9a066' },
  { id: 'plastic-flower', name: 'Plastic flower', bin: 'recycle', color: '#ff5fa0' },
  { id: 'thermocol', name: 'Thermocol decoration', bin: 'reject', color: '#f4f4f4' },
  { id: 'bangles', name: 'Broken glass bangles', bin: 'reject', color: '#c2f0ff' },
];

export const BINS: { id: BinId; title: string; route: string }[] = [
  { id: 'compost', title: 'Compost / Nirmalya', route: 'Goes to a PMC compost or biogas pit' },
  { id: 'recycle', title: 'Recyclable / SWaCH', route: 'A waste picker earns per kg' },
  { id: 'reject', title: 'Reject / dry waste', route: 'Landfill, never the river' },
];

export const SORT_RULES = { pointsPerCorrect: 150, compostKgPerItem: 250, incomePerRecyclable: 400, plasticKgPerRecyclable: 25 };

export function getHotspot(id: string): Hotspot | undefined {
  return HOTSPOTS.find((h) => h.id === id);
}

export function hotspotsFor(zone: ZoneId): Hotspot[] {
  return HOTSPOTS.filter((h) => h.zone === zone);
}

/** Pure scoring. Throws ScoringError for anything malformed. */
export function scoreAction(input: unknown): ActionResult {
  if (!input || typeof input !== 'object') throw new ScoringError('Send a hotspot action.');
  const { hotspotId, choiceId, placements } = input as ActionInput;
  const hotspot = typeof hotspotId === 'string' ? getHotspot(hotspotId) : undefined;
  if (!hotspot) throw new ScoringError('That hotspot does not exist.');

  if (hotspot.kind === 'choice') {
    const choice = hotspot.choices?.find((c) => c.id === choiceId);
    if (!choice) throw new ScoringError('Pick one of the listed options.');
    return { hotspotId: hotspot.id, zone: hotspot.zone, choiceId: choice.id, points: choice.points, delta: { ...choice.delta }, outcome: choice.outcome };
  }

  if (!placements || typeof placements !== 'object') throw new ScoringError('Sort every item into a bin first.');
  const binIds = new Set<string>(BINS.map((b) => b.id));
  let correct = 0, compost = 0, recycle = 0;
  for (const item of SORT_ITEMS) {
    const placed = (placements as Record<string, unknown>)[item.id];
    if (typeof placed !== 'string' || !binIds.has(placed)) throw new ScoringError('Sort every item into a bin first.');
    if (placed === item.bin) {
      correct++;
      if (item.bin === 'compost') compost++;
      if (item.bin === 'recycle') recycle++;
    }
  }
  const total = SORT_ITEMS.length;
  const delta: Delta = {
    compost: compost * SORT_RULES.compostKgPerItem,
    income: recycle * SORT_RULES.incomePerRecyclable,
    plastic: recycle * SORT_RULES.plasticKgPerRecyclable,
  };
  const outcome = correct === total
    ? 'Perfect sort. Nothing from this batch reaches the Mutha.'
    : `${total - correct} item${total - correct === 1 ? '' : 's'} went to the wrong bin. The SWaCH team re-sorted them, but that batch earned less.`;
  return { hotspotId: hotspot.id, zone: hotspot.zone, points: correct * SORT_RULES.pointsPerCorrect, delta, outcome, correct, total };
}

/** Sources and assumptions shown in the app. */
export const ASSUMPTIONS: { topic: string; value: string; basis: string }[] = [
  { topic: 'Rooftop solar yield, Pune', value: 'about 1,500 kWh per kWp per year', basis: 'Typical figure for western Maharashtra irradiance; NREL PVWatts and MNRE guidance give a similar range.' },
  { topic: 'Panel density', value: '10 m² of roof per kWp', basis: 'Common rule of thumb for flat-roof mono-PERC arrays including row spacing.' },
  { topic: 'Grid emission factor', value: '0.716 kg CO₂ per kWh', basis: 'Approximation of the CEA CO₂ Baseline Database weighted average for India.' },
  { topic: 'Campus electricity demand', value: '600,000 kWh per year', basis: 'Assumed for a mid-size engineering college to express solar as a share of demand.' },
  { topic: 'Heavy metals in e-waste', value: 'about 2.5% of mass', basis: 'Approximation for desktops with CRT monitors, where leaded glass dominates.' },
  { topic: 'Petrol car emissions', value: '0.15 kg CO₂ per km', basis: 'Typical small petrol car in city traffic.' },
  { topic: 'Electric bus emissions', value: 'about 4,100 kg CO₂ per year on this route', basis: 'Assumes about 1.2 kWh per km on the grid factor above.' },
  { topic: 'Kalash collection', value: 'about 2 tonnes per festival day', basis: 'Illustrative figure for one staffed collection point on a busy ghat.' },
  { topic: 'SWaCH', value: 'Pune waste picker cooperative', basis: 'Earnings per kg are simplified for gameplay. Real rates vary by material.' },
];

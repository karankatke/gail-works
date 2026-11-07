import { DESCRIPTIONS } from "./descriptions";

export type Contract = "PE" | "LMC";

export type Stage = { label: string; pct: number };

export type RateItem = {
  id: string;
  contract: Contract;
  code: string;
  name: string;
  detail: string;
  category: string;
  uom: string;
  rate: number;
  loaQty: number;
  stages: Stage[];
  official?: string;
  aliases?: string;
};

const S = {
  lmcLay: [
    { label: "Laying", pct: 0.7 },
    { label: "Testing", pct: 0.05 },
    { label: "Commissioning", pct: 0.2 },
    { label: "Documents", pct: 0.05 },
  ],
  lmcInstall: [
    { label: "Install", pct: 0.7 },
    { label: "Testing", pct: 0.05 },
    { label: "Commissioning", pct: 0.2 },
    { label: "Documents", pct: 0.05 },
  ],
  lmcRestore: [
    { label: "Work done", pct: 0.7 },
    { label: "NOC", pct: 0.25 },
    { label: "Closure", pct: 0.05 },
  ],
  lmcSimple: [
    { label: "Work done", pct: 0.95 },
    { label: "Closure", pct: 0.05 },
  ],
  peLay: [
    { label: "Laying", pct: 0.6 },
    { label: "Testing", pct: 0.1 },
    { label: "Commissioning", pct: 0.25 },
    { label: "Documents", pct: 0.05 },
  ],
  peSurvey: [
    { label: "Survey", pct: 0.9 },
    { label: "Documents", pct: 0.1 },
  ],
  peSleeve: [
    { label: "Install", pct: 0.75 },
    { label: "Testing", pct: 0.2 },
    { label: "Closure", pct: 0.05 },
  ],
  peValve: [
    { label: "Supply", pct: 0.5 },
    { label: "Install", pct: 0.2 },
    { label: "Commissioning", pct: 0.25 },
    { label: "Documents", pct: 0.05 },
  ],
  peRestore: [
    { label: "Work done", pct: 0.75 },
    { label: "NOC", pct: 0.2 },
    { label: "Closure", pct: 0.05 },
  ],
  peSimple: [
    { label: "Work done", pct: 0.9 },
    { label: "Documents", pct: 0.1 },
  ],
  peConnect: [
    { label: "Work done", pct: 0.95 },
    { label: "Closure", pct: 0.05 },
  ],
  peBarricade: [
    { label: "Supply", pct: 0.75 },
    { label: "Returned", pct: 0.25 },
  ],
} satisfies Record<string, Stage[]>;

const pe = (
  code: string,
  name: string,
  detail: string,
  category: string,
  uom: string,
  rate: number,
  loaQty: number,
  stages: Stage[],
  aliases = "",
  official = "",
): RateItem => ({
  id: `PE-${code}`,
  contract: "PE",
  code,
  name,
  detail,
  category,
  uom,
  rate,
  loaQty,
  stages,
  aliases,
  official,
});

const lmc = (
  code: string,
  name: string,
  detail: string,
  category: string,
  uom: string,
  rate: number,
  loaQty: number,
  stages: Stage[],
  aliases = "",
  official = "",
): RateItem => ({
  id: `LMC-${code}`,
  contract: "LMC",
  code,
  name,
  detail,
  category,
  uom,
  rate,
  loaQty,
  stages,
  aliases,
  official,
});

const SIZES = [
  { mm: 20, alias: "half inch 1/2 inch 0.5 inch" },
  { mm: 32, alias: "1 inch one inch" },
  { mm: 63, alias: "2 inch two inch" },
  { mm: 90, alias: "3 inch three inch" },
  { mm: 125, alias: "4 inch four inch" },
];

const pipeMethods = [
  { key: "2.1", label: "soil", detail: "Open trench · normal soil" },
  { key: "2.2", label: "rock", detail: "Open trench · rock" },
  { key: "2.3", label: "moling", detail: "Machine moling" },
];

const pePipe: RateItem[] = [];
for (const method of pipeMethods) {
  const rates: Record<string, number[]> = {
    "2.1": [376.92, 391.99, 438.3, 474.92, 523.37],
    "2.2": [875.52, 899.22, 918.61, 969.22, 1109.22],
    "2.3": [427.53, 492.15, 641.84, 699.99, 818.45],
  };
  const qtys: Record<string, number[]> = {
    "2.1": [50, 25, 15, 10, 10],
    "2.2": [20, 15, 10, 7.5, 7.5],
    "2.3": [20, 15, 10, 5, 5],
  };
  SIZES.forEach((size, i) => {
    const code = `${method.key}.${i + 1}`;
    pePipe.push(
      pe(
        code,
        `${size.mm} mm pipe`,
        method.detail,
        "Pipe laying",
        "m",
        rates[method.key][i],
        qtys[method.key][i],
        S.peLay,
        `${size.mm}mm ${size.alias} ${method.label} pipe`,
      ),
    );
  });
}

export const PE_ITEMS: RateItem[] = [
  pe("1.1", "Site survey", "Up to 1 km", "Survey", "LS", 10316.77, 2, S.peSurvey, "survey route ls"),
  pe("1.2", "Survey beyond 1 km", "Extra length", "Survey", "m", 8.62, 200, S.peSurvey, "survey route meter"),

  ...pePipe,

  pe("2.4.A.1", "32 mm pipe", "HDD · normal soil", "Pipe laying", "m", 555.69, 1250, S.peLay, "32mm 1 inch hdd horizontal drilling"),
  pe("2.4.A.2", "63 mm pipe", "HDD · normal soil", "Pipe laying", "m", 674.15, 300, S.peLay, "63mm 2 inch hdd horizontal drilling"),
  pe("2.4.A.3", "90 mm pipe", "HDD · normal soil", "Pipe laying", "m", 818.45, 25, S.peLay, "90mm 3 inch hdd horizontal drilling"),
  pe("2.4.A.4", "125 mm pipe", "HDD · normal soil", "Pipe laying", "m", 926.14, 25, S.peLay, "125mm 4 inch hdd horizontal drilling"),
  pe("2.4.D.1", "32 mm pipe", "HDD · rock", "Pipe laying", "m", 3446.1, 75, S.peLay, "32mm 1 inch hdd rock"),
  pe("2.4.D.2", "63 mm pipe", "HDD · rock", "Pipe laying", "m", 3876.87, 25, S.peLay, "63mm 2 inch hdd rock"),
  pe("2.4.D.3", "90 mm pipe", "HDD · rock", "Pipe laying", "m", 4350.71, 15, S.peLay, "90mm 3 inch hdd rock"),
  pe("2.4.D.4", "125 mm pipe", "HDD · rock", "Pipe laying", "m", 6407.6, 10, S.peLay, "125mm 4 inch hdd rock"),

  pe("3.1.1", "32 mm pipe", "Inside complex · low cover", "Pipe laying", "m", 471.69, 50, S.peLay, "32mm 1 inch complex apartment"),
  pe("3.1.2", "63 mm pipe", "Inside complex · low cover", "Pipe laying", "m", 514.77, 25, S.peLay, "63mm 2 inch complex apartment"),

  pe("3.2.1", 'GI sleeve 2"', "Supply", "GI sleeve & PCC", "m", 318.76, 12.5, S.peSleeve, "gi sleeve 2 inch"),
  pe("3.2.2", 'GI sleeve 4"', "Supply", "GI sleeve & PCC", "m", 666.61, 12.5, S.peSleeve, "gi sleeve 4 inch"),
  pe("3.2.3", 'GI sleeve 6"', "Supply", "GI sleeve & PCC", "m", 866.91, 12.5, S.peSleeve, "gi sleeve 6 inch"),
  pe("3.3", "PCC encasing", "1:2:4 concrete", "GI sleeve & PCC", "m³", 4738.39, 2, S.peSleeve, "pcc concrete encasing cum"),

  pe("4", "Liaisoning", "Authorities & owners", "Restoration", "m", 129.23, 1950, S.peSimple, "liaison permission"),
  pe("6.1", "Asphalt restoration", "Road restore", "Restoration", "m", 1039.21, 225, S.peRestore, "road asphalt bitumen"),
  pe("6.2", "Asphalt cutting", "Road edge cutting", "Restoration", "m", 116.74, 225, S.peRestore, "cutting saw"),
  pe("6.3", "Paver restoration", "Tiles / pavers", "Restoration", "m", 472.76, 25, S.peRestore, "pathway tiles pavers"),
  pe("6.4", "RCC road restoration", "Concrete road", "Restoration", "m", 646.15, 25, S.peRestore, "concrete rcc"),
  pe("7.1", "Bricks", "Supply & lay", "Restoration", "m²", 465.22, 5, S.peSimple, "brick"),

  pe("8.1", "Barricading", "Hard barricade", "Valves & pits", "nos", 10812.15, 3, S.peBarricade, "barricade safety"),

  pe("9.1.1", "PE valve 32 mm", "Supply & install", "Valves & pits", "nos", 4738.39, 2, S.peValve, "valve"),
  pe("9.1.2", "PE valve 63 mm", "Supply & install", "Valves & pits", "nos", 8507.57, 1, S.peValve, "valve"),
  pe("9.1.3", "PE valve 90 mm", "Supply & install", "Valves & pits", "nos", 13999.8, 1, S.peValve, "valve"),
  pe("9.1.4", "PE valve 125 mm", "Supply & install", "Valves & pits", "nos", 20030.49, 1, S.peValve, "valve"),
  pe("10.1", "Valve pit 600 × 600", "CC block + RCC cover", "Valves & pits", "nos", 28430.36, 1, S.peRestore, "chamber pit"),
  pe("10.2", "Valve pit 1000 × 1000", "CC block + RCC cover", "Valves & pits", "nos", 39199.43, 1, S.peRestore, "chamber pit large"),

  pe("11.1", "RCC route marker", "Supply & install", "Markers", "nos", 775.38, 39, S.peRestore, "marker"),
  pe("11.2", "Pole marker", "With foundation", "Markers", "nos", 5922.99, 2, S.peRestore, "marker pole"),

  pe("13.1", "Last-mile connection", "PE to GI", "Connections", "nos", 9476.79, 2, S.peConnect, "connection flat house"),
  pe("13.2", "Connection liaisoning", "Last mile", "Connections", "nos", 3004.57, 2, S.peSimple, "liaison"),
  pe("13.3", "Warning plate", "Supply & fix", "Connections", "nos", 281.08, 2, S.peSimple, "plate"),

  pe("16.1", "Registration camp", "Per camp per day", "Marketing & survey", "nos", 4318.4, 1, S.peSimple, "camp canopy"),
  pe("16.2", "Industrial registration", "PNG customer", "Marketing & survey", "nos", 861.53, 1, S.peSimple, "registration"),
  pe("16.3", "Commercial registration", "PNG customer", "Marketing & survey", "nos", 430.77, 1, S.peSimple, "registration"),
  pe("16.4", "Domestic registration", "PNG customer", "Marketing & survey", "nos", 150.77, 25, S.peSimple, "registration"),
  pe("17.1", "GPR survey", "Up to 100 m", "Marketing & survey", "nos", 8260, 8, S.peSimple, "ground radar"),
  pe("17.2", "GPR beyond 100 m", "Extra length", "Marketing & survey", "m", 81, 50, S.peSimple, "ground radar"),
];

export const LMC_ITEMS: RateItem[] = [
  lmc("1.a", "New connection - from main line", "New line (existing building ₹1,325.06)", "Connections", "nos", 7850.53, 5, S.lmcLay, "connection flat house last mile"),
  lmc("1.b", "Road crossing", "Asphalt road", "Connections", "m", 616.79, 10, S.lmcLay, "road crossing"),
  lmc("1.c.1", "Excavation up to 1.5 m", "Pit digging", "Connections", "m³", 900, 40, S.lmcLay, "dig pit soil"),
  lmc("1.c.2", "Excavation 1.5–2 m", "Pit digging", "Connections", "m³", 1100, 15, S.lmcLay, "dig pit soil"),
  lmc("1.c.3", "Excavation over 2 m", "Pit digging", "Connections", "m³", 1225, 10, S.lmcLay, "dig pit soil"),
  lmc("1.d", "Connection liaisoning", "Individual house", "Connections", "nos", 3200, 5, S.lmcLay, "liaison permission"),

  lmc("2.a", "20/32 mm pipe", "MDPE laying", "Pipe laying", "m", 578, 10, S.lmcLay, "20mm 32mm 1 inch mdpe"),
  lmc("2.b", "63 mm pipe", "MDPE laying", "Pipe laying", "m", 615, 10, S.lmcLay, "63mm 2 inch mdpe"),
  lmc("2.1.a", "32 mm pipe", "Rock trench", "Pipe laying", "m", 985.31, 5, S.lmcLay, "32mm 1 inch rock"),
  lmc("2.1.b", "63 mm pipe", "Rock trench", "Pipe laying", "m", 1033.49, 5, S.lmcLay, "63mm 2 inch rock"),
  lmc("2.2.a", "32 mm pipe + sleeve", 'With 2" GI sleeve', "Pipe laying", "m", 698, 5, S.lmcLay, "32mm 1 inch sleeve complex"),
  lmc("2.2.b", "63 mm pipe + sleeve", 'With 4" GI sleeve', "Pipe laying", "m", 907.4, 5, S.lmcLay, "63mm 2 inch sleeve complex"),

  lmc("4.a", "Asphalt restoration", "Road restore", "Restoration", "m²", 3500, 5, S.lmcRestore, "road asphalt bitumen"),
  lmc("4.b", "Paver restoration", "Tiles / pavers", "Restoration", "m²", 4200, 5, S.lmcRestore, "pathway tiles"),
  lmc("4.c", "RCC road restoration", "Concrete road", "Restoration", "m³", 15000, 2, S.lmcRestore, "concrete rcc"),

  lmc("5.a", "PE valve 32 mm", "Supply & install", "Valves & pits", "nos", 8151, 1, S.lmcRestore, "valve"),
  lmc("5.b", "PE valve 63 mm", "Supply & install", "Valves & pits", "nos", 14032, 1, S.lmcRestore, "valve"),
  lmc("6", "Valve pit 600 × 600", "RCC chamber", "Valves & pits", "nos", 27973.64, 1, S.lmcRestore, "chamber pit"),

  lmc("7.a", "RCC route marker", "Supply & install", "Markers & sleeves", "nos", 1065.8, 5, S.lmcRestore, "marker"),
  lmc("7.b", "Pole marker", "Supply & install", "Markers & sleeves", "nos", 6738.59, 2, S.lmcRestore, "marker pole"),
  lmc("8.a", 'GI sleeve 2"', "Supply", "Markers & sleeves", "m", 527.2, 1, S.lmcRestore, "gi sleeve 2 inch"),
  lmc("8.b", 'GI sleeve 2.5"', "Supply", "Markers & sleeves", "m", 651.21, 1, S.lmcRestore, "gi sleeve 2.5 inch"),
  lmc("8.c", 'GI sleeve 4"', "Supply", "Markers & sleeves", "m", 877.73, 1, S.lmcRestore, "gi sleeve 4 inch"),
  lmc("8.d", 'GI sleeve 6"', "Supply", "Markers & sleeves", "m", 1523.26, 1, S.lmcRestore, "gi sleeve 6 inch"),

  lmc("9", "PCC", "1:2:4 concrete", "Restoration", "m³", 10255, 1, S.lmcSimple, "concrete"),
  lmc("10", "Bricks", "Supply & lay", "Restoration", "m²", 1027, 5, S.lmcSimple, "brick"),

  lmc("11", "Liaisoning (main)", "Other pipeline", "Connections", "m", 144.15, 40, S.lmcLay, "liaison permission"),
  lmc("12.a", 'Transition fitting 1.5" × 63', "TF with guard", "Connections", "nos", 2732.25, 1, S.lmcLay, "tf transition fitting"),
  lmc("12.b", 'Transition fitting 1" × 32', "TF with guard", "Connections", "nos", 917.36, 2, S.lmcLay, "tf transition fitting"),
  lmc("12.c", 'Transition fitting 3/4" × 32', "TF with guard", "Connections", "nos", 925.85, 2, S.lmcLay, "tf transition fitting"),

  lmc("13.1.a", 'GI pipe 1/2"', "With material", "GI & MLC pipes", "m", 546.71, 50, S.lmcInstall, "gi pipe half inch"),
  lmc("13.1.b", 'GI pipe 3/4"', "With material", "GI & MLC pipes", "m", 620.83, 100, S.lmcInstall, "gi pipe"),
  lmc("13.1.c", 'GI pipe 1"', "With material", "GI & MLC pipes", "m", 722.77, 50, S.lmcInstall, "gi pipe one inch"),
  lmc("13.1.d", 'GI pipe 1.5"', "With material", "GI & MLC pipes", "m", 818.52, 25, S.lmcInstall, "gi pipe"),
  lmc("13.2.a", 'GI pipe 1/2"', "Labour only", "GI & MLC pipes", "m", 401.53, 150, S.lmcInstall, "gi pipe half inch free issue"),
  lmc("13.2.b", 'GI pipe 3/4"', "Labour only", "GI & MLC pipes", "m", 405, 500, S.lmcInstall, "gi pipe free issue"),
  lmc("13.2.c", 'GI pipe 1"', "Labour only", "GI & MLC pipes", "m", 488.03, 150, S.lmcInstall, "gi pipe one inch free issue"),
  lmc("13.2.d", 'GI pipe 1.5"', "Labour only", "GI & MLC pipes", "m", 580.68, 100, S.lmcInstall, "gi pipe free issue"),
  lmc("13.3", "GI welding", "Per joint", "GI & MLC pipes", "m", 354.31, 75, S.lmcInstall, "weld"),
  lmc("14", "GI commissioning", "Network commissioning", "GI & MLC pipes", "m", 83, 1070, S.lmcInstall, "commission gas"),
  lmc("15", "Copper pipe 12 mm", "Meter to appliance", "GI & MLC pipes", "m", 629.07, 100, S.lmcInstall, "copper"),
  lmc("16", "MLC pipe 16 mm", "Meter to appliance", "GI & MLC pipes", "m", 463.31, 400, S.lmcInstall, "mlc composite pipe"),

  lmc("17", "Domestic meter", "Fixing", "Meters & regulators", "nos", 725, 250, S.lmcInstall, "meter gas"),
  lmc("18.a", "Regulator 2.5 SCMH", "Domestic", "Meters & regulators", "nos", 182, 300, S.lmcInstall, "regulator"),
  lmc("18.b", "Regulator 2.5/6.5 SCMH", "Domestic", "Meters & regulators", "nos", 405, 25, S.lmcInstall, "regulator"),
  lmc("18.c", "Service regulator", "10–100 SCMH", "Meters & regulators", "nos", 1053, 25, S.lmcInstall, "regulator"),
  lmc("19.a", 'Isolation valve 1/2"', "Kitchen", "Meters & regulators", "nos", 309, 500, S.lmcInstall, "valve"),
  lmc("19.b", 'Isolation valve 3/4"', "Kitchen", "Meters & regulators", "nos", 692, 50, S.lmcInstall, "valve"),
  lmc("19.c", 'Isolation valve 1"', "Kitchen", "Meters & regulators", "nos", 962, 25, S.lmcInstall, "valve"),
  lmc("19.d", 'Isolation valve 1.5"', "Kitchen", "Meters & regulators", "nos", 2190, 10, S.lmcInstall, "valve"),
  lmc("20", "Appliance valve 1/2\"", "At appliance", "Meters & regulators", "nos", 308.88, 250, S.lmcInstall, "valve"),
  lmc("21", "Warning plate", "Supply & fix", "Meters & regulators", "nos", 611, 5, S.lmcInstall, "plate"),

  lmc("23", "Commercial meter", "G4–G25", "Meters & regulators", "nos", 4132.73, 2, S.lmcSimple, "meter commercial"),
  lmc("24", "Commercial regulator", "10–65 SCMH", "Meters & regulators", "nos", 1092.89, 2, S.lmcSimple, "regulator commercial"),

  lmc("26", "LPG → PNG conversion", "Burner conversion", "Conversion", "nos", 1781, 250, S.lmcInstall, "conversion stove burner"),
  lmc("27", "New connection - existing building", "Existing building (new line ₹7,850.53)", "Connections", "nos", 1325.06, 100, S.lmcInstall, "connection flat apartment"),

  lmc("29.1", "Registration camp", "Per camp per day", "Registration & other", "nos", 5967.62, 5, S.lmcSimple, "camp canopy"),
  lmc("29.2", "Domestic registration", "PNG customer", "Registration & other", "nos", 209.15, 50, S.lmcSimple, "registration"),
  lmc("30", "Core cutting", "RCC wall up to 2\"", "Registration & other", "nos", 1024, 50, S.lmcSimple, "core cut hole"),
];

export const ALL_ITEMS: RateItem[] = [...PE_ITEMS, ...LMC_ITEMS];

for (const item of ALL_ITEMS) {
  item.official = DESCRIPTIONS[item.id] ?? item.official ?? "";
}

export const ITEM_MAP: Record<string, RateItem> = Object.fromEntries(
  ALL_ITEMS.map((i) => [i.id, i]),
);

export const CATEGORIES: Record<Contract, string[]> = {
  PE: ["Survey", "Pipe laying", "GI sleeve & PCC", "Restoration", "Valves & pits", "Markers", "Connections", "Marketing & survey"],
  LMC: [
    "Connections",
    "Pipe laying",
    "Restoration",
    "Valves & pits",
    "Markers & sleeves",
    "GI & MLC pipes",
    "Meters & regulators",
    "Conversion",
    "Registration & other",
  ],
};

export const CONTRACTS = {
  PE: {
    code: "PE",
    name: "PE laying",
    short: "PE",
    loaNo: "GAILGas/WALKIN/3/5600008645/26-27/24/33",
    loaDate: "19 Aug 2026",
    basicValue: 2489137.07,
    gst: 448044.68,
    totalValue: 2937181.75,
  },
  LMC: {
    code: "LMC",
    name: "Last mile connectivity",
    short: "LMC",
    loaNo: "GAILGas/WALKIN/3/5600008537/26-27/24/33",
    loaDate: "10 Aug 2026",
    basicValue: 2495802.53,
    gst: 449244.46,
    totalValue: 2945046.99,
  },
} as const;

export function claimPct(stages: Stage[], stageIndex: number): number {
  return stages.slice(0, Math.max(0, stageIndex + 1)).reduce((s, x) => s + x.pct, 0);
}

/**
 * LOA stage amounts. The full rate is exact; the stage amounts are rounded to
 * paise and the largest stage absorbs any 1-paisa difference so they sum to
 * the full LOA rate.
 */
export function stageRates(item: RateItem): number[] {
  const rates = item.stages.map((s) => Math.round(item.rate * s.pct * 100) / 100);
  const target = Math.round(item.rate * 100) / 100;
  const sum = rates.reduce((a, b) => a + b, 0);
  const diff = Math.round((target - sum) * 100) / 100;
  if (diff !== 0 && rates.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < rates.length; i += 1) {
      if (rates[i] > rates[maxIdx]) maxIdx = i;
    }
    rates[maxIdx] = Math.round((rates[maxIdx] + diff) * 100) / 100;
  }
  return rates;
}

export function claimPerUnit(item: RateItem, stageIndex: number): number {
  return stageRates(item)
    .slice(0, Math.max(0, stageIndex + 1))
    .reduce((a, b) => a + b, 0);
}

export function stageLabel(stages: Stage[], stageIndex: number): string {
  const st = stages[Math.max(0, Math.min(stageIndex, stages.length - 1))];
  return st ? st.label : "—";
}

export function itemSearchText(i: RateItem): string {
  return `${i.code} ${i.name} ${i.detail} ${i.category} ${i.aliases ?? ""}`.toLowerCase();
}

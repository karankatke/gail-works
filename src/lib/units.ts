export const FT_TO_M = 0.3048;
export const IN_TO_M = 0.0254;
export const FT2_TO_M2 = 0.09290304;
export const FT3_TO_M3 = 0.028316846592;

export function ftInToM(ft: string | number, inch: string | number): number {
  const f = Number(ft) || 0;
  const i = Number(inch) || 0;
  return f * FT_TO_M + i * IN_TO_M;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function formatFtIn(ft: string | number, inch: string | number): string {
  const f = Number(ft) || 0;
  const i = Number(inch) || 0;
  return `${f} ft${i ? ` ${i} in` : ""}`;
}

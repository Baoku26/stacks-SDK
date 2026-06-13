/**
 * Bitcoin amount conversions and display formatting. Pure, dependency-free
 * (PLANNING.md: `utils/` has zero internal deps). All math uses `bigint` so
 * satoshi values never lose precision through IEEE-754 floats.
 *
 * 1 BTC = 100,000,000 satoshis (8 decimals).
 */

const SATS_PER_BTC = 100_000_000n;
const BTC_DECIMALS = 8;

/** Drop trailing zeros (and a dangling '.') from a fixed-decimal fractional string. */
function trimFraction(whole: string, frac: string): string {
  const trimmed = frac.replace(/0+$/, '');
  return trimmed.length > 0 ? `${whole}.${trimmed}` : whole;
}

/**
 * Convert satoshis to a BTC decimal string (no unit, trailing zeros trimmed).
 * `satsToBtc(123450000n)` → `'1.2345'`, `satsToBtc(0)` → `'0'`.
 */
export function satsToBtc(sats: bigint | number): string {
  const value = typeof sats === 'bigint' ? sats : BigInt(Math.trunc(sats));
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / SATS_PER_BTC;
  const frac = (abs % SATS_PER_BTC).toString().padStart(BTC_DECIMALS, '0');
  return (negative ? '-' : '') + trimFraction(whole.toString(), frac);
}

/**
 * Convert a BTC amount (decimal string or number) to satoshis as `bigint`.
 * Truncates beyond 8 decimals (never rounds value into existence). Throws on
 * non-numeric input.
 */
export function btcToSats(btc: string | number): bigint {
  const text = typeof btc === 'number' ? btc.toString() : btc.trim();
  if (!/^-?\d*(\.\d*)?$/.test(text) || text === '' || text === '.' || text === '-') {
    throw new Error(`Invalid BTC amount: ${JSON.stringify(btc)}`);
  }
  const negative = text.startsWith('-');
  const [wholePart = '0', fracPart = ''] = text.replace('-', '').split('.');
  const frac = fracPart.slice(0, BTC_DECIMALS).padEnd(BTC_DECIMALS, '0');
  const sats = BigInt(wholePart || '0') * SATS_PER_BTC + BigInt(frac || '0');
  return negative ? -sats : sats;
}

/** Display a satoshi amount as BTC with unit, e.g. `formatSats(123450000n)` → `'1.2345 BTC'`. */
export function formatSats(sats: bigint | number): string {
  return `${satsToBtc(sats)} BTC`;
}

/** Display a BTC amount with unit, normalised to ≤ 8 decimals, e.g. `'1.2345 BTC'`. */
export function formatBtc(btc: string | number): string {
  return formatSats(btcToSats(btc));
}

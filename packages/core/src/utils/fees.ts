import { fetchJson } from './http';

/**
 * Recommended Bitcoin fee rates in sat/vB. The consumer picks one
 * (PLANNING.md → "Fee selection"). Pure data-fetch util — takes the Bitcoin API
 * base URL (from `useSbtcContext().apiConfig.bitcoinApiUrl`) rather than reading
 * context, keeping `utils/` React-free.
 */
export interface FeeEstimate {
  /** Economical — lowest of the three (mempool `hourFee`). */
  low: number;
  /** Balanced (mempool `halfHourFee`). */
  medium: number;
  /** Priority — fastest confirmation (mempool `fastestFee`). */
  high: number;
}

/** mempool.space `GET /v1/fees/recommended` response (sat/vB). */
interface RecommendedFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

/**
 * Fetch recommended fee rates from mempool.space.
 * `getFeeEstimate('https://mempool.space/testnet/api')`.
 */
export async function getFeeEstimate(bitcoinApiUrl: string): Promise<FeeEstimate> {
  const base = bitcoinApiUrl.replace(/\/$/, '');
  const fees = await fetchJson<RecommendedFees>(`${base}/v1/fees/recommended`);
  return { low: fees.hourFee, medium: fees.halfHourFee, high: fees.fastestFee };
}

import 'server-only';
import { RelyingParty } from 'openid';

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid';
const STEAM_OP_ENDPOINT = 'https://steamcommunity.com/openid/login';
const STEAM_CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

export function createSteamRelyingParty(returnUrl: string): RelyingParty {
  return new RelyingParty(returnUrl, null, true, true, []);
}

export function extractSteamId(claimedIdentifier: string): string | null {
  return claimedIdentifier.match(STEAM_CLAIMED_ID)?.[1] ?? null;
}

/**
 * The openid library trusts whatever provider claimed_id points at, so on its
 * own it accepts an attacker's provider whose claimed_id contains a Steam URL.
 */
export function isSteamAssertion(params: URLSearchParams): boolean {
  const claimedId = params.get('openid.claimed_id') ?? '';
  return (
    params.get('openid.op_endpoint') === STEAM_OP_ENDPOINT &&
    STEAM_CLAIMED_ID.test(claimedId) &&
    params.get('openid.identity') === claimedId
  );
}

export function getSteamAuthUrl(): string {
  return STEAM_OPENID_URL;
}

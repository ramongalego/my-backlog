import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { safeShareImage } from '@/lib/share/image';
import { getSharedCompletion } from '@/lib/server/shared-completions';
import {
  checkSharedRateLimit,
  getClientIp,
  ipRateLimitKey,
  RATE_LIMITS,
} from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

// A share page never changes once made, so its image is cached for a long
// time: by browsers for a day, by the CDN for a month. Rendering one costs a
// database read, a fetch of the art and a 1200×630 PNG, and without this every
// view of a link preview would pay for it again.
const CACHE_CONTROL = 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400';

// The app's palette (globals.css), as the hex values an image needs.
const INK_950 = '#0f0d0b';
const INK_700 = '#443f3a';
const INK_500 = '#8d8884';
const INK_300 = '#bdbab6';
const INK_100 = '#eae7e4';
const INK_50 = '#f7f5f2';
const EMERALD_500 = '#00bc7d';
const EMERALD_400 = '#00d492';
const EMERALD_300 = '#5ee9b5';
const AMBER_400 = '#ffb900';
/** The image is 1200 wide, with 64 either side. */
const BAR_WIDTH = 1072;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // The route is public, and a query string gets past the CDN's cache, so
  // renders are also limited per visitor.
  const limit = await checkSharedRateLimit(
    `og:${ipRateLimitKey(getClientIp(request))}`,
    RATE_LIMITS.shareImage,
  );
  if (!limit.success) {
    return new Response('Too many requests', {
      status: 429,
      headers: { 'Retry-After': Math.ceil((limit.resetAt - Date.now()) / 1000).toString() },
    });
  }

  const { id } = await params;
  const data = await getSharedCompletion(id);

  if (!data) {
    return new Response('Not found', { status: 404 });
  }

  // Checked again here, although the share route checks before saving: next/og
  // fetches this URL on the server, so a bad row must never become a way to
  // make the server request an arbitrary address.
  const safeHeaderImage = safeShareImage(data.header_image);
  const played = Math.round((data.playtime_minutes / 60) * 10) / 10;
  const estimate =
    data.main_story_hours && data.main_story_hours > 0 ? data.main_story_hours : null;
  // The same bar as the page: the hours played against the estimate.
  const longest = Math.max(played, estimate ?? 0);
  const bar =
    played > 0 && estimate
      ? {
          fill: (Math.min(played, estimate) / longest) * BAR_WIDTH,
          over: played > estimate ? ((played - estimate) / longest) * BAR_WIDTH : 0,
        }
      : null;
  const facts = [
    played > 0 ? { figure: `${played} hour${played === 1 ? '' : 's'}`, rest: '' } : null,
    data.total_games > 0 && data.games_finished > 0
      ? { figure: String(data.games_finished), rest: `of ${data.total_games} games finished` }
      : null,
  ].filter((fact) => fact !== null);

  return new ImageResponse(
    <div
      style={{
        width: '1200px',
        height: '630px',
        display: 'flex',
        backgroundColor: INK_950,
        color: INK_50,
        fontFamily: 'sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* The game's art at full strength: next/image cannot be used inside ImageResponse. */}
      {safeHeaderImage && (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img
          src={safeHeaderImage}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1200px',
            height: '630px',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Dark from the bottom, where the words sit; the top of the art stays clear. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '1200px',
          height: '630px',
          display: 'flex',
          background:
            'linear-gradient(to top, rgba(15,13,11,0.97) 0%, rgba(15,13,11,0.92) 40%, rgba(15,13,11,0.72) 60%, rgba(15,13,11,0.25) 80%, rgba(15,13,11,0) 100%)',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          width: '1200px',
          height: '630px',
          padding: '64px',
          position: 'relative',
        }}
      >
        {/* Finished, and the rating */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 6 9 17l-5-5"
                stroke={EMERALD_400}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span style={{ fontSize: '32px', color: EMERALD_400 }}>Finished</span>
          </div>
          {data.rating !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="30" height="30" viewBox="0 0 24 24">
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"
                  fill={AMBER_400}
                />
              </svg>
              <span style={{ fontSize: '32px', color: INK_100 }}>{data.rating}/10</span>
            </div>
          )}
        </div>

        {/* Game name */}
        <div
          style={{
            display: 'block',
            lineClamp: 2,
            fontSize: '68px',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            maxWidth: '1072px',
            marginBottom: '36px',
          }}
        >
          {data.game_name}
        </div>

        {bar && (
          <div
            style={{
              display: 'flex',
              width: `${BAR_WIDTH}px`,
              height: '14px',
              borderRadius: '7px',
              overflow: 'hidden',
              backgroundColor: INK_700,
              marginBottom: '24px',
            }}
          >
            <div style={{ width: `${bar.fill}px`, height: '14px', backgroundColor: EMERALD_500 }} />
            {bar.over > 0 && (
              <div
                style={{
                  width: `${bar.over}px`,
                  height: '14px',
                  marginLeft: '2px',
                  backgroundColor: EMERALD_300,
                }}
              />
            )}
          </div>
        )}

        {/* The figures in one line, and whose page this is */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '32px', color: INK_300 }}>
            {facts.map((fact, i) => (
              <div key={fact.figure + fact.rest} style={{ display: 'flex' }}>
                {i > 0 && <span style={{ margin: '0 16px', color: INK_500 }}>·</span>}
                <span style={{ color: INK_50 }}>{fact.figure}</span>
                {fact.rest && <span style={{ marginLeft: '9px' }}>{fact.rest}</span>}
              </div>
            ))}
          </div>
          <span style={{ fontSize: '26px', color: INK_300 }}>MyBacklog</span>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': CACHE_CONTROL },
    },
  );
}

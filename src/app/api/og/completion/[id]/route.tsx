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
  const steamHours = Math.round((data.playtime_minutes / 60) * 10) / 10;
  const ratingText = data.rating !== null ? `Rated ${data.rating}/10` : null;

  return new ImageResponse(
    <div
      style={{
        width: '1200',
        height: '630',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f0d0b',
        color: '#f7f5f2',
        fontFamily: 'sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background game image with overlay — next/image cannot be used inside ImageResponse */}
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
            opacity: 0.2,
          }}
        />
      )}

      {/* Gradient overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(to top, #0f0d0b 30%, transparent 100%)',
          display: 'flex',
        }}
      />

      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '60px',
          height: '100%',
          position: 'relative',
        }}
      >
        {/* Trophy + tagline */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <span style={{ fontSize: '28px' }}>🏆</span>
          <span
            style={{
              fontSize: '20px',
              color: '#a5a19c',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}
          >
            Game Completed
          </span>
        </div>

        {/* Game name */}
        <div
          style={{
            fontSize: '56px',
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: '32px',
            maxWidth: '900px',
            display: 'flex',
          }}
        >
          {data.game_name}
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: '40px',
            alignItems: 'center',
          }}
        >
          {steamHours > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '36px', fontWeight: 700 }}>{steamHours}h</span>
              <span style={{ fontSize: '16px', color: '#8d8884' }}>playtime</span>
            </div>
          )}

          {ratingText && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '36px', fontWeight: 700 }}>{data.rating}</span>
                <span style={{ fontSize: '20px', color: '#8d8884' }}>/10</span>
              </div>
              <span style={{ fontSize: '16px', color: '#8d8884' }}>rating</span>
            </div>
          )}

          {data.total_games > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '36px', fontWeight: 700 }}>
                {data.games_finished}/{data.total_games}
              </span>
              <span style={{ fontSize: '16px', color: '#8d8884' }}>games finished</span>
            </div>
          )}
        </div>

        {/* Branding */}
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            right: '60px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '18px', color: '#8d8884', fontWeight: 600 }}>MyBacklog</span>
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

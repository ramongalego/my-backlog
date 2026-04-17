import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Defense in depth: even though the /api/share/completion endpoint validates
// header_image against the Steam CDN allow-list before persisting, we re-check
// here before rendering. next/og fetches the URL server-side — if a bad row
// ever lands in the DB (migration, manual edit, schema drift), we must not
// turn that into an SSRF primitive.
function isAllowedImageHost(hostname: string): boolean {
  return (
    hostname === 'steamcdn-a.akamaihd.net' ||
    hostname.endsWith('.steamstatic.com') ||
    hostname === 'steamstatic.com'
  );
}

function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && isAllowedImageHost(parsed.hostname) ? url : null;
  } catch {
    return null;
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from('shared_completions').select('*').eq('id', id).single();

  if (!data) {
    return new Response('Not found', { status: 404 });
  }

  const safeHeaderImage = safeImageUrl(data.header_image);
  const steamHours = Math.round((data.playtime_minutes / 60) * 10) / 10;
  const ratingText = data.rating !== null ? `Rated ${data.rating}/10` : null;

  return new ImageResponse(
    <div
      style={{
        width: '1200',
        height: '630',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#09090b',
        color: '#fafafa',
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
          background: 'linear-gradient(to top, #09090b 30%, transparent 100%)',
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
              color: '#a1a1aa',
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
              <span style={{ fontSize: '16px', color: '#71717a' }}>playtime</span>
            </div>
          )}

          {ratingText && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '36px', fontWeight: 700 }}>{data.rating}</span>
                <span style={{ fontSize: '20px', color: '#71717a' }}>/10</span>
              </div>
              <span style={{ fontSize: '16px', color: '#71717a' }}>rating</span>
            </div>
          )}

          {data.total_games > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '36px', fontWeight: 700 }}>
                {data.games_finished}/{data.total_games}
              </span>
              <span style={{ fontSize: '16px', color: '#71717a' }}>games finished</span>
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
          <span style={{ fontSize: '18px', color: '#52525b', fontWeight: 600 }}>MyBacklog</span>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}

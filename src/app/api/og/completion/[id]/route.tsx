import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from('shared_completions').select('*').eq('id', id).single();

  if (!data) {
    return new Response('Not found', { status: 404 });
  }

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
      {data.header_image && (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img
          src={data.header_image}
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

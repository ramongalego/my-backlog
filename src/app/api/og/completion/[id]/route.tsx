import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeShareImage } from '@/lib/share/image';
import { SHARED_COMPLETION_COLUMNS } from '@/lib/share/completion';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('shared_completions')
    .select(SHARED_COMPLETION_COLUMNS)
    .eq('id', id)
    .maybeSingle();

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
    },
  );
}

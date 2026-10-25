import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'MyBacklog - Stop scrolling. Start playing.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: '1200',
        height: '630',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f0d0b',
        color: '#f7f5f2',
        fontFamily: 'sans-serif',
        position: 'relative',
      }}
    >
      {/* Gradient accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '1200px',
          height: '4px',
          background: '#f97934',
          display: 'flex',
        }}
      />

      {/* Icon + Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '24px',
        }}
      >
        <span style={{ fontSize: '64px' }}>🎮</span>
        <span style={{ fontSize: '64px', fontWeight: 800 }}>MyBacklog</span>
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: '28px',
          color: '#a5a19c',
          marginBottom: '48px',
          display: 'flex',
        }}
      >
        Stop scrolling. Start playing.
      </div>

      {/* Feature pills */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
        }}
      >
        {['Pick your next game', 'Track your backlog', 'Finish what you own'].map((text) => (
          <div
            key={text}
            style={{
              display: 'flex',
              padding: '12px 24px',
              borderRadius: '12px',
              border: '1px solid #443f3a',
              backgroundColor: '#1c1916',
              fontSize: '18px',
              color: '#d6d4d0',
            }}
          >
            {text}
          </div>
        ))}
      </div>

      {/* Domain */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          display: 'flex',
          fontSize: '18px',
          color: '#8d8884',
          fontWeight: 600,
        }}
      >
        mybacklog.app
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}

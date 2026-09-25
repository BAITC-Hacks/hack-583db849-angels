'use client';

/** The last resort, when even the root layout fails: plain HTML, no providers to depend on. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#fffde9', color: '#131313', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0 }}>
        <main style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>AI Leader ID could not load</h1>
          <p style={{ fontSize: 14, opacity: 0.75 }}>Reload the page. If it keeps happening, the server may be restarting.</p>
          <button type="button" onClick={reset} style={{ marginTop: 12, padding: '10px 16px', borderRadius: 8, border: 0, background: '#c1f01d', fontWeight: 600, cursor: 'pointer' }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

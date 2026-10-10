'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="en"><body style={{ fontFamily: 'system-ui', padding: '3rem', color: '#0f172a' }}>
      <main><h1>We could not load this page</h1><p>Please try again. Your saved submissions remain available.</p><button onClick={() => reset()}>Try again</button></main>
    </body></html>
  );
}

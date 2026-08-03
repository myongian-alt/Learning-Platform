import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// react-native-skia needs its CanvasKit WASM bundle fetched and initialized before any
// `Skia.*` call works on web — without this, `Skia.Path.Make()` / `<Canvas>` throw
// "Cannot read properties of undefined (reading 'PathBuilder'/'PictureRecorder')" because
// the global `CanvasKit` they read from is still undefined. Native (iOS/Android) links
// Skia directly and needs none of this.
let loadPromise: Promise<void> | null = null;

// The canvaskit-wasm loader fetches its .wasm relative to `document.currentScript`, which
// doesn't point anywhere servable once bundled by Metro (the fetch 404s and the loader
// promise never resolves — no crash, just a canvas that silently never becomes ready).
// `locateFile` overrides that lookup unconditionally, so we serve the binary ourselves from
// `public/canvaskit.wasm` (copied from node_modules/canvaskit-wasm/bin/full/canvaskit.wasm;
// re-copy it if the canvaskit-wasm dependency version ever changes) and point straight at
// it instead of relying on the loader's own path guessing.
function ensureSkiaWebLoaded(): Promise<void> {
  if (Platform.OS !== 'web') return Promise.resolve();
  if (!loadPromise) {
    loadPromise = import('@shopify/react-native-skia/lib/module/web').then(({ LoadSkiaWeb }) =>
      LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }),
    );
  }
  return loadPromise;
}

export function useSkiaWebStatus(): { ready: boolean; error: Error | null } {
  const [ready, setReady] = useState(Platform.OS !== 'web');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    ensureSkiaWebLoaded()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[penbook] Skia web (CanvasKit) failed to load', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  return { ready, error };
}

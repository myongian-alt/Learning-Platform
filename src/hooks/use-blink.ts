import { useState, useEffect } from 'react';

// A plain 500ms opacity-toggle, extracted from SlideTimer's original expired-timer blink
// (src/components/slides/slide-viewer.tsx) since multiple "LIVE" indicators across this app
// want the exact same attention-grabbing behavior. Returns `true`/`false` to drive
// `style={{ opacity: blinkOn ? 1 : 0.35 }}` (or similar) — only runs the interval while
// `active`, so an inactive indicator costs nothing.
export function useBlink(active: boolean): boolean {
  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setBlinkOn((b) => !b), 500);
    return () => clearInterval(interval);
  }, [active]);

  return !active || blinkOn;
}

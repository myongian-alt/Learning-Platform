import { useWindowDimensions } from 'react-native';

// Above this width the student experience shows the persistent sidebar (matching
// the teacher shell); below it, the bottom tab bar from `(student)/_layout.tsx`
// is the primary nav — mirrors the design spec's Desktop/Mobile shell split.
const WIDE_BREAKPOINT = 900;

export function useIsWideScreen() {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT;
}

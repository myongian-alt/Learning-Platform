import { forwardRef, lazy, Suspense } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useSkiaWebStatus } from '@/lib/skia-web';

import type { SlideCanvasHandle, SlideCanvasProps } from './slide-canvas-impl';

export type { SlideCanvasHandle, SlideCanvasProps, SlideTool } from './slide-canvas-impl';

// Native links Skia via JSI at native-module registration and has none of the web
// CanvasKit-loading-order problem, so it can import the implementation directly. The
// ternary's untaken branch is never evaluated (plain JS short-circuiting, not a bundler
// trick), so this `require` never runs on web — it must stay synchronous for that reason.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const NativeSlideCanvas = Platform.OS === 'web' ? null : (require('./slide-canvas-impl') as typeof import('./slide-canvas-impl')).SlideCanvas;

// Web must not import the implementation (and therefore `@shopify/react-native-skia`)
// until CanvasKit has finished loading — see the comment at the top of
// slide-canvas-impl.tsx. `React.lazy` defers the `import()` until the component's first
// render, which we only do once `useSkiaWebStatus().ready` is true below.
const LazySlideCanvas = Platform.OS === 'web' ? lazy(() => import('./slide-canvas-impl')) : null;

function ErrorFallback() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" className="items-center justify-center p-6">
      <View className="rounded-lg bg-red-50 px-3 py-2">
        <Text className="text-center text-xs font-medium text-red-600">
          Drawing tools failed to load. Try refreshing the page.
        </Text>
      </View>
    </View>
  );
}

export const SlideCanvas = forwardRef<SlideCanvasHandle, SlideCanvasProps>(function SlideCanvas(
  props,
  ref,
) {
  const { ready, error } = useSkiaWebStatus();

  if (Platform.OS !== 'web') {
    const Impl = NativeSlideCanvas!;
    return <Impl {...props} ref={ref} />;
  }

  if (error) return <ErrorFallback />;
  if (!ready || !LazySlideCanvas) return <View style={StyleSheet.absoluteFill} />;

  return (
    <Suspense fallback={<View style={StyleSheet.absoluteFill} />}>
      <LazySlideCanvas {...props} ref={ref} />
    </Suspense>
  );
});

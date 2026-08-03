import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  accentColor?: string;
  padding?: 'sm' | 'md' | 'lg';
}

const PADDING_CLASSES = { sm: 'p-3.5', md: 'p-4', lg: 'p-5' } as const;

export function Card({
  accentColor,
  padding = 'md',
  className,
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <View
      className={`rounded-2xl bg-white shadow-sm ${PADDING_CLASSES[padding]} ${className ?? ''}`}
      style={[accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : null, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

interface PressableCardProps extends Omit<PressableProps, 'children'> {
  accentColor?: string;
  padding?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

export function PressableCard({
  accentColor,
  padding = 'md',
  className,
  style,
  children,
  ...rest
}: PressableCardProps) {
  return (
    <Pressable
      className={`rounded-2xl bg-white shadow-sm active:opacity-80 ${PADDING_CLASSES[padding]} ${className ?? ''}`}
      style={(state) => [
        accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : null,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

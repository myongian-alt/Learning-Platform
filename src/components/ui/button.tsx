import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: Variant;
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, { container: string; label: string }> = {
  primary: { container: 'bg-brand-500 active:bg-brand-600', label: 'text-white' },
  secondary: {
    container: 'bg-white border border-brand-200 active:bg-brand-50',
    label: 'text-brand-700',
  },
  ghost: { container: 'bg-transparent active:bg-black/5', label: 'text-ink' },
  danger: { container: 'bg-red-600 active:bg-red-700', label: 'text-white' },
};

export function Button({ label, variant = 'primary', isLoading, disabled, ...rest }: ButtonProps) {
  const classes = VARIANT_CLASSES[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || isLoading}
      className={`flex-row items-center justify-center gap-2 rounded-xl px-5 py-3 ${classes.container} ${
        disabled || isLoading ? 'opacity-50' : ''
      }`}
      {...rest}
    >
      {isLoading && <ActivityIndicator color={variant === 'primary' ? '#fff' : '#2b5cf0'} />}
      <Text className={`text-base font-semibold ${classes.label}`}>{label}</Text>
    </Pressable>
  );
}

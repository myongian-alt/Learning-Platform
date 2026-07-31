import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface TextFieldProps extends TextInputProps {
  label: string;
}

export function TextField({ label, ...rest }: TextFieldProps) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-ink/70">{label}</Text>
      <TextInput
        className="rounded-xl border border-black/10 bg-white px-4 py-3 text-base text-ink"
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
    </View>
  );
}

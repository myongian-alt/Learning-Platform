import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

export type SelectorAccent = 'purple' | 'blue' | 'green' | 'orange';

const ACCENTS: Record<
  SelectorAccent,
  {
    iconBg: string;
    selectedBg: string;
    selectedBorder: string;
    selectedText: string;
    check: string;
    customBorder: string;
    customText: string;
  }
> = {
  purple: {
    iconBg: 'bg-purple-600',
    selectedBg: 'bg-purple-50',
    selectedBorder: 'border-purple-400',
    selectedText: 'text-purple-700',
    check: 'bg-purple-500',
    customBorder: 'border-purple-300',
    customText: 'text-purple-700',
  },
  blue: {
    iconBg: 'bg-blue-600',
    selectedBg: 'bg-blue-50',
    selectedBorder: 'border-blue-400',
    selectedText: 'text-blue-700',
    check: 'bg-blue-500',
    customBorder: 'border-blue-300',
    customText: 'text-blue-700',
  },
  green: {
    iconBg: 'bg-emerald-600',
    selectedBg: 'bg-emerald-50',
    selectedBorder: 'border-emerald-400',
    selectedText: 'text-emerald-700',
    check: 'bg-emerald-500',
    customBorder: 'border-emerald-300',
    customText: 'text-emerald-700',
  },
  orange: {
    iconBg: 'bg-orange-500',
    selectedBg: 'bg-orange-50',
    selectedBorder: 'border-orange-400',
    selectedText: 'text-orange-700',
    check: 'bg-orange-500',
    customBorder: 'border-orange-300',
    customText: 'text-orange-700',
  },
};

interface CommonProps {
  icon: string;
  title: string;
  subtitle: string;
  accent: SelectorAccent;
  options: string[];
  searchPlaceholder: string;
}

interface SingleSelectProps extends CommonProps {
  multiple?: false;
  value: string | null;
  onChange: (value: string) => void;
}

interface MultiSelectProps extends CommonProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
  max: number;
}

type SelectorColumnProps = SingleSelectProps | MultiSelectProps;

export function SelectorColumn(props: SelectorColumnProps) {
  const { icon, title, subtitle, accent, options, searchPlaceholder } = props;
  const [query, setQuery] = useState('');
  const [customText, setCustomText] = useState('');
  const colors = ACCENTS[accent];

  const filtered = options.filter((option) => option.toLowerCase().includes(query.toLowerCase()));

  const selectedValues = props.multiple ? props.value : props.value ? [props.value] : [];
  const atMax = props.multiple && selectedValues.length >= props.max;

  const isSelected = (option: string) => selectedValues.includes(option);

  const handleSelectOption = (option: string) => {
    if (props.multiple) {
      if (isSelected(option)) {
        props.onChange(props.value.filter((v) => v !== option));
      } else if (!atMax) {
        props.onChange([...props.value, option]);
      }
      return;
    }
    setCustomText('');
    props.onChange(option);
  };

  const handleAddCustom = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    if (props.multiple) {
      if (atMax || isSelected(trimmed)) return;
      props.onChange([...props.value, trimmed]);
      setCustomText('');
    } else {
      props.onChange(trimmed);
    }
  };

  const isCustomValue =
    !props.multiple && props.value !== null && !options.includes(props.value);

  return (
    <View className="w-full min-w-[220px] flex-1 gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <View className="flex-row items-center gap-3">
        <View className={`h-11 w-11 items-center justify-center rounded-2xl ${colors.iconBg}`}>
          <Text className="text-lg">{icon}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-ink">{title}</Text>
          <Text className="text-xs text-ink/50">
            {subtitle}
            {props.multiple && ` · ${selectedValues.length}/${props.max} selected`}
          </Text>
        </View>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={searchPlaceholder}
        placeholderTextColor="#9ca3af"
        className="rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2.5 text-sm text-ink"
      />

      <ScrollView className="max-h-56" showsVerticalScrollIndicator={false}>
        <View className="gap-1.5">
          {filtered.map((option) => {
            const selected = isSelected(option);
            const disabled = !selected && atMax;
            return (
              <Pressable
                key={option}
                onPress={() => handleSelectOption(option)}
                disabled={disabled}
                className={`flex-row items-center justify-between rounded-xl border px-3 py-2.5 ${
                  selected ? `${colors.selectedBg} ${colors.selectedBorder}` : 'border-transparent'
                } ${disabled ? 'opacity-40' : ''}`}
              >
                <Text
                  className={`text-sm ${selected ? `font-semibold ${colors.selectedText}` : 'text-ink/70'}`}
                >
                  {option}
                </Text>
                {selected && (
                  <View className={`h-5 w-5 items-center justify-center rounded-full ${colors.check}`}>
                    <Text className="text-xs font-bold text-white">✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          {filtered.length === 0 && (
            <Text className="px-3 py-2 text-sm text-ink/40">No matches.</Text>
          )}
        </View>
      </ScrollView>

      <View className="flex-row items-center gap-2">
        <View className="h-px flex-1 bg-black/10" />
        <Text className="text-xs font-medium uppercase tracking-wide text-ink/30">or</Text>
        <View className="h-px flex-1 bg-black/10" />
      </View>

      <TextInput
        value={!props.multiple && isCustomValue && props.value !== null ? props.value : customText}
        onChangeText={(text) => {
          if (props.multiple) {
            setCustomText(text);
          } else {
            setCustomText(text);
            props.onChange(text);
          }
        }}
        onSubmitEditing={props.multiple ? handleAddCustom : undefined}
        editable={!(props.multiple && atMax)}
        placeholder={props.multiple && atMax ? `Limit of ${props.max} reached` : 'or write custom…'}
        placeholderTextColor="#9ca3af"
        returnKeyType={props.multiple ? 'done' : undefined}
        className={`rounded-xl border px-3 py-2.5 text-sm ${
          isCustomValue ? `${colors.customBorder} ${colors.customText} font-semibold` : 'border-black/10 text-ink'
        } ${props.multiple && atMax ? 'opacity-40' : ''}`}
      />
    </View>
  );
}

import { Pressable, Text, View } from 'react-native';

import { TOOL_COLORS, useCanvasStore, type CanvasTool } from '@/store/canvas-store';

const TOOLS: { id: CanvasTool; label: string; icon: string }[] = [
  { id: 'pen', label: 'Pen', icon: '✏️' },
  { id: 'highlighter', label: 'Highlight', icon: '🖍️' },
  { id: 'eraser', label: 'Erase', icon: '🧽' },
  { id: 'pointer', label: 'Move', icon: '✋' },
];

interface CanvasToolbarProps {
  onUndo: () => void;
  onRaiseHand?: () => void;
  isHandRaised?: boolean;
}

export function CanvasToolbar({ onUndo, onRaiseHand, isHandRaised }: CanvasToolbarProps) {
  const tool = useCanvasStore((s) => s.tool);
  const color = useCanvasStore((s) => s.color);
  const setTool = useCanvasStore((s) => s.setTool);
  const setColor = useCanvasStore((s) => s.setColor);

  return (
    <View className="flex-row items-center gap-3 border-t border-black/5 bg-white px-3 py-2">
      <View className="flex-row gap-1.5">
        {TOOLS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setTool(item.id)}
            className={`h-11 w-11 items-center justify-center rounded-xl ${
              tool === item.id ? 'bg-brand-100' : 'bg-black/5'
            }`}
          >
            <Text className="text-lg">{item.icon}</Text>
          </Pressable>
        ))}
      </View>

      <View className="h-8 w-px bg-black/10" />

      <View className="flex-row gap-1.5">
        {TOOL_COLORS.map((swatch) => (
          <Pressable
            key={swatch}
            onPress={() => setColor(swatch)}
            style={{ backgroundColor: swatch }}
            className={`h-8 w-8 rounded-full ${color === swatch ? 'border-2 border-ink' : ''}`}
          />
        ))}
      </View>

      <View className="h-8 w-px bg-black/10" />

      <Pressable onPress={onUndo} className="h-11 justify-center rounded-xl bg-black/5 px-3">
        <Text className="text-sm font-medium text-ink">Undo</Text>
      </Pressable>

      {onRaiseHand && (
        <Pressable
          onPress={onRaiseHand}
          className={`ml-auto h-11 flex-row items-center justify-center gap-2 rounded-xl px-4 ${
            isHandRaised ? 'bg-amber-400' : 'bg-brand-500'
          }`}
        >
          <Text className="text-sm font-semibold text-white">
            {isHandRaised ? '✋ Waiting for help' : 'Raise hand'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

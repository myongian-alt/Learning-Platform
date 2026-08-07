import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

// The visual thumbnail box shared between the teacher's draggable slide grid
// (src/app/class/[classId].tsx's DraggableSlideCard, which wraps this in its own drag
// gesture) and the student's read-only lesson view (student-class-view.tsx) — same image,
// tag-colored border, lock badge, and slide-number/tag/duration captions either way, so a
// student sees exactly what the teacher sees, just without the editing controls.
interface SlideThumbnailTileProps {
  slide: { id: string; url: string | null; duration_minutes: number | null };
  index: number;
  total: number;
  tag: { label: string; color: string } | null;
  isTeacherPaced: boolean;
  onOpen: () => void;
  /** Teacher-only: move-left/move-right/delete controls + "Drag to reorder" hint. Omitted
   * entirely for a read-only (student) caller. */
  editable?: boolean;
  isSelected?: boolean;
  selectionMode?: boolean;
  disabled?: boolean;
  onToggleSelected?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onDelete?: () => void;
  /** Student-only: a small status pill under the caption (e.g. "Graded 92%", "Not started"). */
  statusBadge?: { label: string; color: string } | null;
}

export function SlideThumbnailTile({
  slide,
  index,
  total,
  tag,
  isTeacherPaced,
  onOpen,
  editable = false,
  isSelected = false,
  selectionMode = false,
  disabled = false,
  onToggleSelected,
  onMoveLeft,
  onMoveRight,
  onDelete,
  statusBadge = null,
}: SlideThumbnailTileProps) {
  return (
    <View style={{ width: 124 }} className="gap-1">
      <Pressable
        onPress={() => (selectionMode ? onToggleSelected?.() : onOpen())}
        accessibilityLabel={
          selectionMode
            ? `${isSelected ? 'Deselect' : 'Select'} slide ${index + 1}`
            : `Open slide ${index + 1}`
        }
      >
        <View
          style={{
            height: 90,
            backgroundColor: tag ? `${tag.color}1f` : 'rgba(0,0,0,0.04)',
            borderColor: isSelected ? '#7c3aed' : tag ? `${tag.color}55` : 'rgba(0,0,0,0.1)',
            borderWidth: isSelected ? 2 : 1,
          }}
          className="items-center justify-center overflow-hidden rounded-lg border"
        >
          {slide.url ? (
            <Image
              source={{ uri: slide.url }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <ActivityIndicator size="small" />
          )}

          {isTeacherPaced && (
            <View className="absolute left-1 top-1 h-4 w-4 items-center justify-center rounded-full bg-black/60">
              <Feather name="lock" size={9} color="#fff" />
            </View>
          )}

          {selectionMode ? (
            <View
              className={`absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full ${
                isSelected ? 'bg-violet-600' : 'bg-white/80'
              }`}
              style={!isSelected ? { borderWidth: 1.5, borderColor: '#c4b5fd' } : undefined}
            >
              {isSelected && <Text className="text-xs font-bold text-white">✓</Text>}
            </View>
          ) : null}
        </View>
      </Pressable>

      <Text className="text-center text-[10px] font-medium text-ink/50">Slide {index + 1}</Text>
      {tag && (
        <Text
          style={{ color: tag.color }}
          className="text-center text-[9px] font-semibold"
          numberOfLines={1}
        >
          {tag.label}
        </Text>
      )}
      {Boolean(slide.duration_minutes) && (
        <View className="flex-row items-center justify-center gap-1">
          <Feather name="clock" size={9} color="#9ca3af" />
          <Text className="text-[9px] text-ink/40">{slide.duration_minutes}m</Text>
        </View>
      )}
      {statusBadge && (
        <View
          className="self-center rounded-full px-1.5 py-0.5"
          style={{ backgroundColor: `${statusBadge.color}1a` }}
        >
          <Text className="text-[8px] font-bold" style={{ color: statusBadge.color }}>
            {statusBadge.label}
          </Text>
        </View>
      )}
      {editable && !selectionMode && (
        <View className="flex-row items-center justify-center gap-1">
          <Pressable
            onPress={onMoveLeft}
            disabled={disabled || index === 0}
            className="h-5 w-5 items-center justify-center rounded-full bg-black/5"
            style={{ opacity: disabled || index === 0 ? 0.35 : 1 }}
            accessibilityLabel="Move slide left"
          >
            <Feather name="chevron-left" size={10} color="#4b5563" />
          </Pressable>
          <Pressable
            onPress={onMoveRight}
            disabled={disabled || index >= total - 1}
            className="h-5 w-5 items-center justify-center rounded-full bg-black/5"
            style={{ opacity: disabled || index >= total - 1 ? 0.35 : 1 }}
            accessibilityLabel="Move slide right"
          >
            <Feather name="chevron-right" size={10} color="#4b5563" />
          </Pressable>
          <Pressable
            onPress={onDelete}
            disabled={disabled}
            className="h-5 w-5 items-center justify-center rounded-full bg-red-50"
            style={{ opacity: disabled ? 0.35 : 1 }}
            accessibilityLabel="Delete slide"
          >
            <Feather name="trash-2" size={10} color="#ef4444" />
          </Pressable>
        </View>
      )}
      {editable && !selectionMode && (
        <Text className="text-center text-[8px] text-ink/35">Drag to reorder</Text>
      )}
    </View>
  );
}

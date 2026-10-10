// "Large text" view: the words the OCR read, shown in big letters instead of
// as small highlights on the photo. Every word can be tapped and opens the
// same AI Dictionary window as the photo view.
//
//   - default LargeTextView   the scrolling list of big, tappable words
//   - ViewModeSwitch          the "Photo | Large text" switch
import { useLocalization } from "@/context/LocalizationContext";
import { LargeTextSize } from "@/utils/large-text-settings";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type ViewMode = "photo" | "text";

// Anything with a word and the line it sits on can be shown here.
interface LargeTextBox {
  text: string;
  line?: string;
  sentence?: string;
  group?: number; // same number = same field or phrase
}

const FONT_SIZE: Record<LargeTextSize, number> = {
  small: 20,
  medium: 26,
  large: 34,
};

const SIZES: { key: LargeTextSize; letterSize: number }[] = [
  { key: "small", letterSize: 14 },
  { key: "medium", letterSize: 20 },
  { key: "large", letterSize: 26 },
];

interface LargeTextViewProps<T extends LargeTextBox> {
  boxes: T[];
  selectedWord: T | null;
  onSelectWord: (item: T) => void;
  size: LargeTextSize;
  onChangeSize: (size: LargeTextSize) => void;
}

export default function LargeTextView<T extends LargeTextBox>({
  boxes,
  selectedWord,
  onSelectWord,
  size,
  onChangeSize,
}: LargeTextViewProps<T>) {
  const { t } = useLocalization();

  // Each field or phrase becomes its own row. Words that carry the same group
  // number go together, even when the OCR read other words in between
  // ("DATE OF", "Month", "Day", "Year", ... "BIRTH"). Without group numbers
  // (older data) words with the same line text next to each other are grouped.
  type Item = { box: T; index: number };
  const groups: { items: Item[] }[] = [];
  const byGroup = new Map<number, { items: Item[] }>();
  let lastKey: string | undefined;
  boxes.forEach((box, index) => {
    if (box.group !== undefined) {
      let group = byGroup.get(box.group);
      if (!group) {
        group = { items: [] };
        byGroup.set(box.group, group);
        groups.push(group);
      }
      group.items.push({ box, index });
      return;
    }
    const key = box.line ?? box.sentence ?? "";
    if (groups.length === 0 || key !== lastKey) {
      groups.push({ items: [] });
      lastKey = key;
    }
    groups[groups.length - 1].items.push({ box, index });
  });

  const fontSize = FONT_SIZE[size];

  return (
    <View style={styles.card}>
      <View style={styles.sizeRow}>
        <Text style={styles.sizeCaption}>{t("lt_size")}</Text>
        <View style={styles.sizeButtons}>
          {SIZES.map((option) => {
            const active = option.key === size;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.sizeButton, active && styles.sizeButtonActive]}
                onPress={() => onChangeSize(option.key)}
                accessibilityRole="button"
                accessibilityLabel={`${t("lt_size")}: ${t(
                  option.key === "small"
                    ? "lt_size_small"
                    : option.key === "medium"
                      ? "lt_size_medium"
                      : "lt_size_large",
                )}`}
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.sizeLetter,
                    { fontSize: option.letterSize },
                    active && styles.sizeLetterActive,
                  ]}
                >
                  A
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Text style={styles.hint}>{t("lt_hint")}</Text>

      {boxes.length === 0 ? (
        <Text style={styles.empty}>{t("lt_empty")}</Text>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.groups}
        >
          {groups.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.group}>
              {group.items.map(({ box, index }) => {
                const selected = selectedWord === box;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.word, selected && styles.wordSelected]}
                    onPress={() => onSelectWord(box)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.wordText,
                        { fontSize },
                        selected && styles.wordTextSelected,
                      ]}
                    >
                      {box.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

interface ViewModeSwitchProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

// "Photo | Large text": two labelled choices, the active one is highlighted.
export function ViewModeSwitch({ mode, onChange }: ViewModeSwitchProps) {
  const { t } = useLocalization();
  const options: { key: ViewMode; label: string }[] = [
    { key: "photo", label: t("lt_mode_photo") },
    { key: "text", label: t("lt_mode_text") },
  ];
  return (
    <View style={styles.switchTrack}>
      {options.map((option) => {
        const active = option.key === mode;
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.switchOption, active && styles.switchOptionActive]}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[styles.switchText, active && styles.switchTextActive]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 16,
  },
  sizeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sizeCaption: { fontSize: 14, fontWeight: "600", color: "#444" },
  sizeButtons: { flexDirection: "row", gap: 8 },
  sizeButton: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2182DE",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  sizeButtonActive: { backgroundColor: "#2182DE" },
  sizeLetter: { fontWeight: "700", color: "#2182DE" },
  sizeLetterActive: { color: "#fff" },
  hint: { fontSize: 13, color: "#666", marginBottom: 12 },
  empty: { fontSize: 18, color: "#444", textAlign: "center", marginTop: 40 },
  groups: { gap: 18 },
  group: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  word: {
    minHeight: 48,
    justifyContent: "center",
    backgroundColor: "#EAF3FC",
    borderWidth: 2,
    borderColor: "#2182DE",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  wordSelected: { backgroundColor: "#2182DE", borderColor: "#1B5FA8" },
  wordText: { color: "#111", fontWeight: "600" },
  wordTextSelected: { color: "#fff", fontWeight: "700" },
  switchTrack: {
    flexDirection: "row",
    backgroundColor: "#E4E7EB",
    borderRadius: 12,
    padding: 3,
  },
  switchOption: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  switchOptionActive: { backgroundColor: "#fff" },
  switchText: { fontSize: 14, fontWeight: "600", color: "#666" },
  switchTextActive: { color: "#1B5FA8", fontWeight: "700" },
});

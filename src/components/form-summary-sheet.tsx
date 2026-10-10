// "About this form": a small chip under the scan header. It shows which supported
// form was recognized; tapping it opens a bottom sheet with a plain-language summary.
import { useLocalization } from "@/context/LocalizationContext";
import {
  FORM_NONE,
  getFormById,
  getForms,
  getSummaryView,
} from "@/utils/form-summaries";
import { speakText, stopSpeaking } from "@/utils/tts";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface FormSummaryChipProps {
  detectedFormId?: string | null;
}

export default function FormSummaryChip({
  detectedFormId,
}: FormSummaryChipProps) {
  const { language, t } = useLocalization();

  const [override, setOverride] = useState<string | null | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Stop reading aloud when the sheet closes or the screen goes away.
  useEffect(() => {
    if (!sheetOpen) {
      stopSpeaking();
      setSpeaking(false);
    }
  }, [sheetOpen]);
  useEffect(() => () => stopSpeaking(), []);

  const resolvedId: string | null | undefined =
    override !== undefined
      ? override
      : detectedFormId;

  const pick = (id: string | null) => {
    setOverride(id);
    setPickerOpen(false);
    setSheetOpen(false);
  };

  const view = resolvedId
    ? getSummaryView(resolvedId, language, false)
    : null;

  const handleSpeak = () => {
    if (!view?.text) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    const finish = () => setSpeaking(false);
    speakText(view.text.purpose, language, { onDone: finish });
  };

  if (!resolvedId) return null;

  const allForms = getForms();
  const ordered = [
    getFormById(resolvedId),
    ...allForms.filter((f) => f.id !== resolvedId),
  ].filter((f): f is NonNullable<typeof f> => !!f);

  const form = getFormById(resolvedId);

  return (
    <View>
      {/* The chip */}
      {resolvedId && form ? (
        <TouchableOpacity
          style={styles.chip}
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("form_chip_about")}
        >
          <Ionicons name="document-text-outline" size={18} color="#1B5FA8" />
          <Text style={styles.chipText} numberOfLines={1}>
            {form.form_name}
          </Text>
          <Text style={styles.chipAbout}>{t("form_chip_about")}</Text>
          <Ionicons name="chevron-forward" size={15} color="#1B5FA8" />
        </TouchableOpacity>
      ) : null}

      {/* The summary sheet */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setSheetOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {view?.text?.title ?? form?.form_name}
              </Text>
              <TouchableOpacity
                onPress={() => setSheetOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color="#444" />
              </TouchableOpacity>
            </View>

            {view?.text ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {view.isDraft && (
                  <View style={styles.draftBox}>
                    <Text style={styles.draftText}>{t("form_draft")}</Text>
                  </View>
                )}

                <View style={styles.sectionRow}>
                  <Text style={styles.label}>{t("form_label_purpose")}</Text>
                  <TouchableOpacity
                    style={styles.speakButton}
                    onPress={handleSpeak}
                    accessibilityRole="button"
                    accessibilityLabel={
                      speaking ? "Stop reading" : "Read aloud"
                    }
                  >
                    <Ionicons
                      name={speaking ? "stop-circle" : "volume-high"}
                      size={22}
                      color="#2182DE"
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.body}>{view.text.purpose}</Text>

                <Text style={[styles.label, styles.gap]}>
                  {t("form_label_who")}
                </Text>
                <Text style={styles.body}>{view.text.who_files}</Text>

                <Text style={[styles.label, styles.gap]}>
                  {t("form_label_prepare")}
                </Text>
                {view.text.prepare.map((item) => (
                  <Text key={item} style={styles.bullet}>
                    {"\u2022  "}
                    {item}
                  </Text>
                ))}

                <Text style={[styles.label, styles.gap]}>
                  {t("form_label_sections")}
                </Text>
                {view.text.sections.map((item) => (
                  <Text key={item} style={styles.bullet}>
                    {"\u2022  "}
                    {item}
                  </Text>
                ))}

                <Text style={[styles.label, styles.gap]}>
                  {t("form_label_submit")}
                </Text>
                <Text style={styles.body}>{view.text.where_to_submit}</Text>

                <Text style={[styles.label, styles.gap]}>
                  {t("form_label_reminder")}
                </Text>
                <Text style={styles.body}>{view.text.reminder}</Text>
              </ScrollView>
            ) : (
              <Text style={styles.unavailable}>{t("form_unavailable")}</Text>
            )}

            <View style={styles.sheetFooter}>
              <Text style={styles.footerText}>
                {view?.text
                  ? `${t("form_last_checked")}: ${view.form.last_checked}`
                  : ""}
              </Text>
              <TouchableOpacity
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
              >
                <Text style={styles.notThis}>{t("form_not_this")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* The form picker (used when unsure, and for "Not this form?") */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setPickerOpen(false)}
          />
          <View style={styles.picker}>
            <Text style={styles.sheetTitle}>{t("form_picker_title")}</Text>
            <ScrollView style={{ marginTop: 10 }}>
              {ordered.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.option,
                    f.id === resolvedId && styles.optionCurrent,
                  ]}
                  onPress={() => pick(f.id)}
                  accessibilityRole="button"
                >
                  <Text style={styles.optionText}>{f.form_name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.option}
                onPress={() => pick(null)}
                accessibilityRole="button"
              >
                <Text style={[styles.optionText, { color: "#666" }]}>
                  {t("form_none")}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EAF3FC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BFD9F2",
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  chipText: { flex: 1, color: "#1B5FA8", fontSize: 13, fontWeight: "600" },
  chipAbout: { color: "#1B5FA8", fontSize: 12 },
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 10,
    maxHeight: "82%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DDD",
    alignSelf: "center",
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  sheetTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#111" },
  draftBox: {
    backgroundColor: "#FFF6DD",
    borderWidth: 1,
    borderColor: "#F0DFA8",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  draftText: { color: "#7A5B00", fontSize: 13, fontWeight: "600" },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  gap: { marginTop: 16 },
  body: { fontSize: 16, color: "#222", lineHeight: 24, marginTop: 4 },
  bullet: { fontSize: 15, color: "#222", lineHeight: 23, marginTop: 3 },
  speakButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EAF3FC",
    alignItems: "center",
    justifyContent: "center",
  },
  unavailable: {
    fontSize: 15,
    color: "#666",
    marginVertical: 24,
    textAlign: "center",
  },
  sheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  footerText: { fontSize: 12, color: "#888" },
  notThis: { fontSize: 14, color: "#2182DE", fontWeight: "600" },
  picker: {
    backgroundColor: "#fff",
    margin: 20,
    borderRadius: 16,
    padding: 18,
    maxHeight: "75%",
    position: "absolute",
    left: 0,
    right: 0,
    top: "12%",
  },
  pickerHint: { fontSize: 14, color: "#666", marginTop: 4 },
  option: {
    borderWidth: 1,
    borderColor: "#E3E3E3",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  optionCurrent: { borderColor: "#BFD9F2", backgroundColor: "#F4F9FE" },
  optionText: { fontSize: 15, color: "#222" },
});

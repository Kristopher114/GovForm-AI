// "About this form": a prominent chip under the scan header. It shows which supported
// form was recognized; tapping it opens a bottom sheet with a plain-language summary
// and critical procedural safety warnings (Knowledge Base v1.1).
import { LanguageKey } from "@/constants/translations";
import { useLocalization } from "@/context/LocalizationContext";
import { getFormById, getForms, getSummaryView } from "@/utils/form-summaries";
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

const LANGUAGE_OPTIONS: { key: LanguageKey; label: string }[] = [
  { key: "English", label: "English" },
  { key: "Tagalog", label: "Tagalog" },
  { key: "Cebuano", label: "Bisaya" },
];

export default function FormSummaryChip({
  detectedFormId,
}: FormSummaryChipProps) {
  const { language, setLanguage, t } = useLocalization();

  const [override, setOverride] = useState<string | null | undefined>(
    undefined,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [slowSpeech, setSlowSpeech] = useState(false);

  // Stop reading aloud when the sheet closes or the screen goes away.
  useEffect(() => {
    if (!sheetOpen) {
      stopSpeaking();
      setSpeaking(false);
    }
  }, [sheetOpen]);
  useEffect(() => () => stopSpeaking(), []);

  const resolvedId: string | null | undefined =
    override !== undefined ? override : detectedFormId;

  const pick = (id: string | null) => {
    setOverride(id);
    setPickerOpen(false);
    setSheetOpen(false);
  };

  const view = resolvedId ? getSummaryView(resolvedId, language, true) : null;

  const handleSpeak = () => {
    if (!view?.text) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    const finish = () => setSpeaking(false);
    const fullNarration = `${view.text.purpose} ${view.text.reminder}`;
    speakText(fullNarration, language, {
      rate: slowSpeech ? 0.78 : undefined,
      onDone: finish,
    });
  };

  if (!resolvedId) return null;

  const allForms = getForms();
  const ordered = [
    getFormById(resolvedId),
    ...allForms.filter((f) => f.id !== resolvedId),
  ].filter((f): f is NonNullable<typeof f> => !!f);

  const form = getFormById(resolvedId);
  const shortTitle = view?.text?.title ?? form?.form_name ?? t("form_summary");

  return (
    <View>
      {/* The chip */}
      {resolvedId && form ? (
        <TouchableOpacity
          style={styles.chip}
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("form_summary")}
        >
          <Ionicons name="shield-checkmark" size={19} color="#1B5FA8" />
          <View style={styles.chipTextCol}>
            <Text style={styles.chipTitle} numberOfLines={1}>
              {shortTitle}
            </Text>
            <Text style={styles.chipSub} numberOfLines={1}>
              {t("form_summary")} &bull; Tap for warnings &amp; ID checklist
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#1B5FA8" />
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

            {/* Instant Trilingual Switcher */}
            <View style={styles.langSwitchRow}>
              <View style={styles.langPillGroup}>
                {LANGUAGE_OPTIONS.map((opt) => {
                  const active = language === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.langPill,
                        active && styles.langPillActive,
                      ]}
                      onPress={() => {
                        stopSpeaking();
                        setSpeaking(false);
                        setLanguage(opt.key);
                      }}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[
                          styles.langPillText,
                          active && styles.langPillTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[
                  styles.slowButton,
                  slowSpeech && styles.slowButtonActive,
                ]}
                onPress={() => setSlowSpeech((s) => !s)}
                accessibilityRole="button"
              >
                <Ionicons
                  name="speedometer-outline"
                  size={14}
                  color={slowSpeech ? "#fff" : "#1B5FA8"}
                />
                <Text
                  style={[
                    styles.slowButtonText,
                    slowSpeech && styles.slowButtonTextActive,
                  ]}
                >
                  {slowSpeech ? "0.8x Slow" : "Normal"}
                </Text>
              </TouchableOpacity>
            </View>

            {view?.text ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {view.isDraft && (
                  <View style={styles.draftBox}>
                    <Text style={styles.draftText}>{t("form_draft")}</Text>
                  </View>
                )}

                {/* Critical Procedural Warning Banner at Top (Table 4.5 Panel B & Table 4.7) */}
                {view.text.reminder ? (
                  <View style={styles.warningCard}>
                    <View style={styles.warningHeader}>
                      <Ionicons
                        name="warning"
                        size={18}
                        color="#B3261E"
                      />
                      <Text style={styles.warningTitle}>
                        {t("form_label_reminder")}
                      </Text>
                    </View>
                    <Text style={styles.warningBody}>{view.text.reminder}</Text>
                  </View>
                ) : null}

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
    gap: 10,
    backgroundColor: "#EAF3FC",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#90C2F0",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  chipTextCol: {
    flex: 1,
  },
  chipTitle: {
    color: "#114B8A",
    fontSize: 14,
    fontWeight: "700",
  },
  chipSub: {
    color: "#1B5FA8",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 10,
    maxHeight: "86%",
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
    marginBottom: 10,
  },
  sheetTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#111" },
  langSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  langPillGroup: {
    flexDirection: "row",
    backgroundColor: "#EEF2F6",
    borderRadius: 12,
    padding: 3,
    flex: 1,
  },
  langPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 9,
    alignItems: "center",
  },
  langPillActive: {
    backgroundColor: "#2182DE",
  },
  langPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
  },
  langPillTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  slowButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#90C2F0",
    backgroundColor: "#EAF3FC",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  slowButtonActive: {
    backgroundColor: "#1B5FA8",
    borderColor: "#1B5FA8",
  },
  slowButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1B5FA8",
  },
  slowButtonTextActive: {
    color: "#fff",
  },
  warningCard: {
    backgroundColor: "#FFF4F2",
    borderWidth: 1.5,
    borderColor: "#E57373",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#B3261E",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  warningBody: {
    fontSize: 14,
    color: "#5F1410",
    lineHeight: 21,
    fontWeight: "600",
  },
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

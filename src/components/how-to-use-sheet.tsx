// "How to use this app": a simple step-by-step guide in a bottom sheet.
// It has two parts: what to do BEFORE scanning (Home screen) and what to do
// AFTER the scan (highlighted words, sentence help, "About this form").
//
// Three pieces are exported:
//   - default HowToUseSheet      the sheet itself (open it with `visible`)
//   - HowToUseButton             a labelled help button that opens the sheet
//   - HowToUseFirstLaunch        shows the sheet once, the first time the app opens
import { TranslationKey } from "@/constants/translations";
import { useLocalization } from "@/context/LocalizationContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type HowToSection = "home" | "results";

const SEEN_KEY = "@govform_howto_seen";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface Step {
  icon: IconName;
  title: TranslationKey;
  body: TranslationKey;
}

const HOME_STEPS: Step[] = [
  {
    icon: "camera-outline",
    title: "how_home_1_title",
    body: "how_home_1_body",
  },
  { icon: "sunny-outline", title: "how_home_2_title", body: "how_home_2_body" },
  { icon: "scan-outline", title: "how_home_3_title", body: "how_home_3_body" },
  { icon: "time-outline", title: "how_home_4_title", body: "how_home_4_body" },
];

const RESULT_STEPS: Step[] = [
  {
    icon: "finger-print-outline",
    title: "how_res_1_title",
    body: "how_res_1_body",
  },
  {
    icon: "sparkles-outline",
    title: "how_res_2_title",
    body: "how_res_2_body",
  },
  {
    icon: "volume-high-outline",
    title: "how_res_3_title",
    body: "how_res_3_body",
  },
  {
    icon: "document-text-outline",
    title: "how_res_4_title",
    body: "how_res_4_body",
  },
  {
    icon: "help-circle-outline",
    title: "how_res_5_title",
    body: "how_res_5_body",
  },
  { icon: "search-outline", title: "how_res_6_title", body: "how_res_6_body" },
];

interface HowToUseSheetProps {
  visible: boolean;
  onClose: () => void;
  // Which part to show first. The user can switch with the two tabs.
  initialSection?: HowToSection;
}

export default function HowToUseSheet({
  visible,
  onClose,
  initialSection = "home",
}: HowToUseSheetProps) {
  const { t } = useLocalization();
  const [section, setSection] = useState<HowToSection>(initialSection);

  // Each time the sheet opens, start on the part that was asked for.
  useEffect(() => {
    if (visible) setSection(initialSection);
  }, [visible, initialSection]);

  const steps = section === "home" ? HOME_STEPS : RESULT_STEPS;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <View style={styles.headerText}>
              <Text style={styles.sheetTitle}>{t("how_title")}</Text>
              <Text style={styles.intro}>{t("how_intro")}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("how_close")}
            >
              <Ionicons name="close" size={24} color="#444" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            {(["home", "results"] as HowToSection[]).map((key) => {
              const active = section === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setSection(key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}
                  >
                    {t(key === "home" ? "how_tab_home" : "how_tab_results")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {steps.map((step, index) => (
              <View key={step.title} style={styles.stepRow}>
                <View style={styles.iconTile}>
                  <Ionicons name={step.icon} size={22} color="#2182DE" />
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>
                    {index + 1}. {t(step.title)}
                  </Text>
                  <Text style={styles.stepBody}>{t(step.body)}</Text>
                </View>
              </View>
            ))}

            {section === "results" && (
              <View style={styles.noteBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#7A5B00"
                />
                <Text style={styles.noteText}>{t("how_res_note")}</Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.closeButtonText}>{t("how_close")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface HowToUseButtonProps {
  // Which part the sheet opens on.
  section?: HowToSection;
  // "pill" = small outlined button (Home and results screens).
  // "row"  = full-width row (Settings).
  variant?: "pill" | "row";
}

// A help button that says what it does, and opens the guide when tapped.
export function HowToUseButton({
  section = "home",
  variant = "pill",
}: HowToUseButtonProps) {
  const { t } = useLocalization();
  const [open, setOpen] = useState(false);
  const label = t(section === "results" ? "how_btn_results" : "how_btn_home");

  return (
    <>
      <TouchableOpacity
        style={variant === "row" ? styles.rowButton : styles.pill}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name="help-circle-outline" size={18} color="#2182DE" />
        <Text style={variant === "row" ? styles.rowText : styles.pillText}>
          {label}
        </Text>
        {variant === "row" && (
          <Ionicons name="chevron-forward" size={18} color="#999" />
        )}
      </TouchableOpacity>
      <HowToUseSheet
        visible={open}
        onClose={() => setOpen(false)}
        initialSection={section}
      />
    </>
  );
}

// Shows the guide once, the first time the app is opened. After the person
// closes it, it is remembered and never opens by itself again.
export function HowToUseFirstLaunch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(SEEN_KEY);
        if (!seen && !cancelled) setOpen(true);
      } catch {
        // If storage fails, simply do not show it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClose = () => {
    setOpen(false);
    AsyncStorage.setItem(SEEN_KEY, "1").catch(() => {});
  };

  return (
    <HowToUseSheet visible={open} onClose={handleClose} initialSection="home" />
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 10,
    maxHeight: "88%",
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
    marginBottom: 12,
  },
  headerText: { flex: 1 },
  sheetTitle: { fontSize: 19, fontWeight: "700", color: "#111" },
  intro: { fontSize: 14, color: "#666", marginTop: 3, lineHeight: 20 },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#F0F2F5",
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#666" },
  tabTextActive: { color: "#1B5FA8" },
  stepRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EAF3FC",
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: "700", color: "#111" },
  stepBody: { fontSize: 14, color: "#444", lineHeight: 21, marginTop: 3 },
  noteBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FFF6DD",
    borderWidth: 1,
    borderColor: "#F0DFA8",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  noteText: { flex: 1, color: "#7A5B00", fontSize: 13, lineHeight: 19 },
  closeButton: {
    backgroundColor: "#2182DE",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 8,
  },
  closeButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderColor: "#2182DE",
    borderRadius: 18,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  pillText: { color: "#2182DE", fontSize: 13, fontWeight: "600" },
  rowButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  rowText: { flex: 1, color: "#111", fontSize: 16, fontWeight: "500" },
});

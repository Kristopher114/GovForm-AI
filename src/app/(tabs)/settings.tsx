import { HowToUseButton } from "@/components/how-to-use-sheet";
import OfflineBanner from "@/components/offline-banner";
import { LanguageKey } from "@/constants/translations";
import { useLocalization } from "@/context/LocalizationContext";
import {
  getOpenInLargeText,
  setOpenInLargeText,
} from "@/utils/large-text-settings";
import {
  clearEvents,
  getEventsCsv,
  getResearchSummary,
  isResearchEnabled,
  isShowDraftsEnabled,
  ResearchSummary,
  setResearchEnabled,
  setShowDraftsEnabled
} from "@/utils/metrics";
import {
  getOcrSettings,
  OcrMode,
  saveDesktopIp,
  saveOcrMode,
} from "@/utils/ocr-settings";
import { syncRemoteServerUrl } from "@/utils/remote-config";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const LANGUAGES: LanguageKey[] = ["English", "Tagalog", "Cebuano"];

export default function SettingsScreen() {
  const { language, setLanguage, t } = useLocalization();

  const [ocrMode, setOcrMode] = useState<OcrMode>("native");
  const [largeTextOn, setLargeTextOn] = useState(false);

  useEffect(() => {
    getOpenInLargeText().then(setLargeTextOn);
  }, []);

  const handleLargeTextToggle = async (value: boolean) => {
    setLargeTextOn(value);
    await setOpenInLargeText(value);
  };
  const [desktopIp, setDesktopIp] = useState("192.168.137.1");

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getOcrSettings();
      setOcrMode(settings.mode);
      setDesktopIp(settings.desktopIp);
    };
    loadSettings();
  }, []);

  const handleModeChange = (mode: OcrMode) => {
    setOcrMode(mode);
    saveOcrMode(mode);
  };

  const handleIpChange = (ip: string) => {
    setDesktopIp(ip);
    saveDesktopIp(ip);
  };

  const [isSyncingUrl, setIsSyncingUrl] = useState(false);

  const handleCloudSync = async () => {
    setIsSyncingUrl(true);
    try {
      const syncedUrl = await syncRemoteServerUrl();
      if (syncedUrl) {
        setDesktopIp(syncedUrl);
        Alert.alert(
          "Cloud Synced",
          `Successfully updated Desktop URL to:\n${syncedUrl}`
        );
      } else {
        Alert.alert(
          "Sync Unavailable",
          "No remote URL found in Firestore, or check your internet connection."
        );
      }
    } catch (e) {
      Alert.alert(
        "Sync Error",
        "Failed to sync: " + (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setIsSyncingUrl(false);
    }
  };

  // ---- Research mode (for testers) ----
  const [researchOn, setResearchOn] = useState(false);
  const [summary, setSummary] = useState<ResearchSummary | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);

  const refreshResearch = useCallback(async () => {
    const enabled = await isResearchEnabled();
    setResearchOn(enabled);
    setShowDrafts(await isShowDraftsEnabled());
    setSummary(enabled ? await getResearchSummary() : null);
  }, []);

  // Reload the numbers every time this screen is opened.
  useFocusEffect(
    useCallback(() => {
      refreshResearch();
    }, [refreshResearch]),
  );

  const handleResearchToggle = async (value: boolean) => {
    setResearchOn(value);
    await setResearchEnabled(value);
    refreshResearch();
  };

  const handleDraftsToggle = async (value: boolean) => {
    setShowDrafts(value);
    await setShowDraftsEnabled(value);
  };

  const handleExport = async () => {
    try {
      const csv = await getEventsCsv();
      await Share.share({ message: csv, title: "GovForm research results" });
    } catch (error) {
      console.log("Export cancelled or failed:", error);
    }
  };

  const handleClear = () => {
    Alert.alert(t("research_clear"), t("research_clear_msg"), [
      { text: t("research_cancel"), style: "cancel" },
      {
        text: t("research_clear"),
        style: "destructive",
        onPress: async () => {
          await clearEvents();
          refreshResearch();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t("nav_settings")}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("sectionTitle")}</Text>
          <View style={styles.card}>
            {LANGUAGES.map((lang, index) => {
              const isSelected = language === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.languageOption,
                    index !== LANGUAGES.length - 1 && styles.borderBottom,
                  ]}
                  onPress={() => setLanguage(lang)}
                >
                  <Text style={styles.languageText}>{lang}</Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#2182DE"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.card, { paddingHorizontal: 0 }]}>
            <HowToUseButton variant="row" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("lt_setting_title")}</Text>
          <View style={styles.card}>
            <View style={styles.researchRow}>
              <Text style={styles.researchDesc}>{t("lt_setting_desc")}</Text>
              <Switch
                value={largeTextOn}
                onValueChange={handleLargeTextToggle}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OCR Engine</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.languageOption, styles.borderBottom]}
              onPress={() => handleModeChange("desktop")}
            >
              <Text style={styles.languageText}>
                Server 1 (Optimized)
              </Text>
              {ocrMode === "desktop" && (
                <Ionicons name="checkmark-circle" size={24} color="#2182DE" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.languageOption}
              onPress={() => handleModeChange("native")}
            >
              <Text style={styles.languageText}>
                Server 2 (Default)
              </Text>
              {ocrMode === "native" && (
                <Ionicons name="checkmark-circle" size={24} color="#2182DE" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {ocrMode === "desktop" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Server 1 (Optimized) Endpoint</Text>
            <View style={styles.card}>
              <View style={styles.serverStatusRow}>
                <View style={styles.serverStatusInfo}>
                  <Text style={styles.serverStatusLabel}>Cloud Synced URL</Text>
                  <Text
                    style={styles.serverStatusUrl}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {desktopIp || "No URL Synced Yet"}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.syncIconButton}
                  onPress={handleCloudSync}
                  disabled={isSyncingUrl}
                  activeOpacity={0.7}
                >
                  {isSyncingUrl ? (
                    <ActivityIndicator size="small" color="#2182DE" />
                  ) : (
                    <Ionicons
                      name="cloud-download-outline"
                      size={20}
                      color="#2182DE"
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.helperText}>
              The server URL is dynamically synchronized from your PC portal via Firestore. Tap the cloud icon to sync immediately.
            </Text>
          </View>
        )}

        {/* Research Mode section (commented out) */}
        {/*
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("research_title")}</Text>
          <View style={styles.card}>
            <View style={styles.researchRow}>
              <Text style={styles.researchDesc}>{t("research_desc")}</Text>
              <Switch value={researchOn} onValueChange={handleResearchToggle} />
            </View>
            <Text style={styles.researchPrivacy}>{t("research_privacy")}</Text>

            {researchOn && (
              <View style={styles.researchRow}>
                <Text style={styles.researchDesc}>
                  {t("research_show_drafts")}
                </Text>
                <Switch value={showDrafts} onValueChange={handleDraftsToggle} />
              </View>
            )}

            {researchOn && summary && (
              <View style={styles.researchStats}>
                {summary.total === 0 ? (
                  <Text style={styles.researchStatText}>
                    {t("research_empty")}
                  </Text>
                ) : (
                  summaryLines(summary).map((line) => (
                    <Text key={line} style={styles.researchStatText}>
                      {line}
                    </Text>
                  ))
                )}
              </View>
            )}

            {researchOn && summary && summary.total > 0 && (
              <View style={styles.researchButtons}>
                <TouchableOpacity
                  style={styles.researchButton}
                  onPress={handleExport}
                  accessibilityRole="button"
                >
                  <Ionicons name="share-outline" size={18} color="#2182DE" />
                  <Text style={styles.researchButtonText}>
                    {t("research_export")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.researchButton}
                  onPress={handleClear}
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={18} color="#B3261E" />
                  <Text
                    style={[styles.researchButtonText, { color: "#B3261E" }]}
                  >
                    {t("research_clear")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  researchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  researchDesc: {
    flex: 1,
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
  },
  researchPrivacy: {
    fontSize: 12,
    color: "#8A6D00",
    paddingHorizontal: 16,
    paddingBottom: 14,
    lineHeight: 17,
  },
  researchStats: {
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    padding: 16,
    gap: 4,
  },
  researchStatText: {
    fontSize: 13,
    color: "#333",
    lineHeight: 19,
  },
  researchButtons: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexWrap: "wrap",
  },
  researchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D5E4F5",
    backgroundColor: "#F4F9FE",
  },
  researchButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2182DE",
  },
  container: {
    flex: 1,
    backgroundColor: "#F9F9F9",
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 32,
    color: "#000",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 12,
    marginLeft: 8,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  languageOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  languageText: {
    fontSize: 16,
    color: "#000",
  },
  textInput: {
    fontSize: 16,
    color: "#000",
    paddingVertical: 16,
  },
  helperText: {
    fontSize: 12,
    color: "#888",
    marginTop: 8,
    marginLeft: 8,
    lineHeight: 18,
  },
  serverStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  serverStatusInfo: {
    flex: 1,
    marginRight: 12,
  },
  serverStatusLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  serverStatusUrl: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  syncIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(33, 130, 222, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(33, 130, 222, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
});

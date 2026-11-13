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
  saveOcrMode
} from "@/utils/ocr-settings";
import {
  checkPrimaryHostHealth,
  formatServerUrl,
  syncRemoteServerUrl
} from "@/utils/remote-config";
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
  View
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
  const [inputIp, setInputIp] = useState("192.168.137.1");

  type ServerStatus = "checking" | "online" | "offline";
  const [serverStatus, setServerStatus] = useState<ServerStatus>("checking");

  const checkServerStatus = useCallback(async (targetUrl?: string) => {
    setServerStatus("checking");
    let urlToCheck = targetUrl;
    if (!urlToCheck) {
      try {
        const synced = await syncRemoteServerUrl();
        if (synced) {
          urlToCheck = synced;
          setDesktopIp(synced);
          setInputIp(synced);
        }
      } catch { }
    }
    const health = await checkPrimaryHostHealth(urlToCheck || desktopIp);
    if (health.isAvailable) {
      setServerStatus("online");
    } else {
      setServerStatus("offline");
    }
  }, [desktopIp]);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getOcrSettings();
      setOcrMode(settings.mode);
      let activeUrl = settings.desktopIp;
      try {
        const synced = await syncRemoteServerUrl();
        if (synced) {
          activeUrl = synced;
        }
      } catch { }
      setDesktopIp(activeUrl);
      setInputIp(activeUrl);
      checkServerStatus(activeUrl);
    };
    loadSettings();
  }, [checkServerStatus]);

  const handleModeChange = (mode: OcrMode) => {
    setOcrMode(mode);
    saveOcrMode(mode);
    if (mode === "desktop") {
      checkServerStatus();
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshServerStatus = async () => {
    setIsRefreshing(true);
    setServerStatus("checking");
    let target = desktopIp;
    try {
      const synced = await syncRemoteServerUrl();
      if (synced) {
        target = synced;
        setDesktopIp(synced);
        setInputIp(synced);
      }
    } catch { }
    const health = await checkPrimaryHostHealth(target);
    setServerStatus(health.isAvailable ? "online" : "offline");
    setIsRefreshing(false);
    if (health.isAvailable) {
      Alert.alert(
        "Server Online",
        `Connected to primary host:\n${formatServerUrl(target)}`
      );
    } else {
      Alert.alert(
        "Server Unreachable",
        `Could not connect to:\n${formatServerUrl(target)}\n\nReason: ${health.error || "Timeout or network error"}`
      );
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

  // Reload status and numbers every time this screen is opened.
  useFocusEffect(
    useCallback(() => {
      checkServerStatus();
      refreshResearch();
    }, [checkServerStatus, refreshResearch]),
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
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t("nav_settings")}</Text>
          <TouchableOpacity
            style={styles.tinyRefreshButton}
            onPress={handleRefreshServerStatus}
            disabled={isRefreshing}
            activeOpacity={0.7}
            accessibilityLabel="Refresh server status"
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#2182DE" />
            ) : (
              <Ionicons name="refresh-outline" size={18} color="#2182DE" />
            )}
          </TouchableOpacity>
        </View>

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
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleNoMargin}>OCR Engine</Text>
            <TouchableOpacity
              style={styles.tinyRefreshButton}
              onPress={handleRefreshServerStatus}
              disabled={isRefreshing}
              activeOpacity={0.7}
              accessibilityLabel="Refresh server status"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#2182DE" />
              ) : (
                <Ionicons
                  name="refresh-outline"
                  size={15}
                  color="#2182DE"
                />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.languageOption, styles.borderBottom]}
              onPress={() => handleModeChange("desktop")}
            >
              <View style={styles.engineOptionLabel}>
                <Text style={styles.languageText}>
                  Server 1 (Optimized)
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    serverStatus === "online"
                      ? styles.statusPillOnline
                      : serverStatus === "checking"
                        ? styles.statusPillChecking
                        : styles.statusPillOffline,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      serverStatus === "online"
                        ? styles.statusDotOnline
                        : serverStatus === "checking"
                          ? styles.statusDotChecking
                          : styles.statusDotOffline,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      serverStatus === "online"
                        ? styles.statusPillTextOnline
                        : serverStatus === "checking"
                          ? styles.statusPillTextChecking
                          : styles.statusPillTextOffline,
                    ]}
                  >
                    {serverStatus === "online"
                      ? "Active"
                      : serverStatus === "checking"
                        ? "Checking..."
                        : "Offline"}
                  </Text>
                </View>
              </View>

              {ocrMode === "desktop" && (
                <Ionicons name="checkmark-circle" size={24} color="#2182DE" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.languageOption}
              onPress={() => handleModeChange("native")}
            >
              <View style={styles.engineOptionLabel}>
                <Text style={styles.languageText}>
                  Server 2 (Default)
                </Text>
                <View style={styles.statusPillNative}>
                  <Text style={styles.statusPillTextNative}>On-Device</Text>
                </View>
              </View>
              {ocrMode === "native" && (
                <Ionicons name="checkmark-circle" size={24} color="#2182DE" />
              )}
            </TouchableOpacity>
          </View>
        </View>

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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#000",
  },
  tinyRefreshButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(33, 130, 222, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(33, 130, 222, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 12,
    marginLeft: 8,
  },
  sectionTitleNoMargin: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#666",
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
  engineOptionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillOnline: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  statusPillOffline: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  statusPillChecking: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  statusPillNative: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillTextNative: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotOnline: {
    backgroundColor: "#10B981",
  },
  statusDotOffline: {
    backgroundColor: "#EF4444",
  },
  statusDotChecking: {
    backgroundColor: "#F59E0B",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusPillTextOnline: {
    color: "#059669",
  },
  statusPillTextOffline: {
    color: "#DC2626",
  },
  statusPillTextChecking: {
    color: "#D97706",
  },
  serverStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
});

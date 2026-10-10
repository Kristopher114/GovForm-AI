// A bar at the top of a screen that says the app is in offline mode.
// It shows nothing while the phone is online, and appears or disappears by
// itself when the connection changes.
import { useLocalization } from "@/context/LocalizationContext";
import { useIsOffline } from "@/utils/connectivity";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

export default function OfflineBanner() {
  const { t } = useLocalization();
  const offline = useIsOffline();
  if (!offline) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={20} color="#7A4B00" />
      <Text style={styles.text}>{t("offline_banner")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF4D6",
    borderBottomWidth: 1,
    borderBottomColor: "#F0C36D",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  text: {
    flex: 1,
    color: "#7A4B00",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
});

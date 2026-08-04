import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useLocalization } from "@/context/LocalizationContext";
import { LanguageKey } from "@/constants/translations";

export default function LanguageScreen() {
  const { setLanguage, t } = useLocalization();

  const handleSelectLanguage = async (lang: LanguageKey) => {
    // Handle language selection
    console.log("Selected:", lang);
    await setLanguage(lang);
    // Route to the next screen, e.g., the tabs layout
    router.replace("/(tabs)" as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('choose_language')}</Text>

        <TouchableOpacity style={styles.button} onPress={() => handleSelectLanguage("English")}>
          <Text style={styles.buttonText}>English</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => handleSelectLanguage("Tagalog")}>
          <Text style={styles.buttonText}>Tagalog</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => handleSelectLanguage("Cebuano")}>
          <Text style={styles.buttonText}>Cebuano</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F9F9",
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 120, // To match the vertical position in Figma
  },
  title: {
    color: "#000000",
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 60,
  },
  button: {
    backgroundColor: "#2182DE", // A vibrant blue like in the Figma design
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
  },
});

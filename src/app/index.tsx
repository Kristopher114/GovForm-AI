import { router } from "expo-router";
import * as SecureStore from 'expo-secure-store';
import { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const checkLanguageAndNavigate = async () => {
    try {
      const lang = await SecureStore.getItemAsync('selectedLanguage');
      if (lang) {
        router.replace("/(tabs)" as any);
      } else {
        router.replace("/language" as any);
      }
    } catch (e) {
      router.replace("/language" as any);
    }
  };

  // Auto-navigate to appropriate screen after 2.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      checkLanguageAndNavigate();
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={styles.content} onPress={checkLanguageAndNavigate}>
        <Text style={styles.title}>Hello Welcome</Text>
      </Pressable>
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
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#000000",
    fontSize: 32,
    fontWeight: "bold",
  },
});

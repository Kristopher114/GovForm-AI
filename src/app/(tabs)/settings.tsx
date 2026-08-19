import { LanguageKey } from '@/constants/translations';
import { useLocalization } from '@/context/LocalizationContext';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LANGUAGES: LanguageKey[] = ["English", "Tagalog", "Cebuano"];

export default function SettingsScreen() {
  const { language, setLanguage, t } = useLocalization();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t('nav_settings')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('sectionTitle')}</Text>
        <View style={styles.card}>
          {LANGUAGES.map((lang, index) => {
            const isSelected = language === lang;
            return (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.languageOption,
                  index !== LANGUAGES.length - 1 && styles.borderBottom
                ]}
                onPress={() => setLanguage(lang)}
              >
                <Text style={styles.languageText}>{lang}</Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color="#2182DE" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 32,
    color: '#000',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 12,
    marginLeft: 8,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  languageText: {
    fontSize: 16,
    color: '#000',
  },
});

import AiDictionaryModal from '@/components/ai-dictionary-modal';
import { getRecentFormById, RecentForm, HarvestedWord } from '@/utils/storage';
import { useLocalization } from '@/context/LocalizationContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FormDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language } = useLocalization();
  const [form, setForm] = useState<RecentForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // LLM State for modal
  const [selectedWordText, setSelectedWordText] = useState<string | null>(null);
  const [selectedWordSentence, setSelectedWordSentence] = useState<string | undefined>(undefined);

  useEffect(() => {
    const loadForm = async () => {
      if (id) {
        const found = await getRecentFormById(id);
        setForm(found);
      }
      setIsLoading(false);
    };
    loadForm();
  }, [id]);

  const handleWordTap = (wordData: HarvestedWord | string) => {
    const wordText = typeof wordData === 'string' ? wordData : wordData.text;
    const wordSentence = typeof wordData === 'string' ? undefined : wordData.sentence;

    setSelectedWordText(wordText);
    setSelectedWordSentence(wordSentence);
  };

  const closeModal = () => {
    setSelectedWordText(null);
    setSelectedWordSentence(undefined);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2182DE" />
      </SafeAreaView>
    );
  }

  if (!form) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>Form not found.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{form.title}</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="time-outline" size={16} color="#666" />
        <Text style={styles.dateText}>{form.dateStr}</Text>
      </View>
      <Text style={styles.summaryText}>
        {form.words.length} words harvested. Tap any word to define it using GovForm AI.
      </Text>

      <FlatList
        data={form.words}
        keyExtractor={(item, index) => {
          const text = typeof item === 'string' ? item : item.text;
          return `${index}-${text}`;
        }}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const wordText = typeof item === 'string' ? item : item.text;
          return (
            <TouchableOpacity style={styles.wordCard} onPress={() => handleWordTap(item)}>
              <Text style={styles.wordText}>{wordText}</Text>
              <Ionicons name="sparkles" size={16} color="#2182DE" />
            </TouchableOpacity>
          );
        }}
      />

      {/* LLM Definition Modal */}
      <AiDictionaryModal
        visible={selectedWordText !== null}
        wordText={selectedWordText}
        wordSentence={selectedWordSentence}
        onClose={closeModal}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  centerContainer: { flex: 1, backgroundColor: '#F9F9F9', justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 18, color: '#333', marginBottom: 20 },
  backButton: { backgroundColor: '#2182DE', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: '#EAEAEA' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000', flex: 1, textAlign: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 },
  dateText: { fontSize: 14, color: '#666' },
  summaryText: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 16, paddingHorizontal: 24 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  wordCard: {
    backgroundColor: 'white', padding: 16, borderRadius: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, borderWidth: 1, borderColor: '#F0F0F0'
  },
  wordText: { fontSize: 16, color: '#333', lineHeight: 22, flex: 1 },
});

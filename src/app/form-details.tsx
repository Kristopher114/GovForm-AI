import { defineWordWithLLM, LLMResponse } from '@/utils/llm';
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

  // LLM State
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [isLlmLoading, setIsLlmLoading] = useState(false);
  const [llmResult, setLlmResult] = useState<LLMResponse | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);

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

  const handleWordTap = async (wordData: HarvestedWord | string) => {
    const wordText = typeof wordData === 'string' ? wordData : wordData.text;
    const wordSentence = typeof wordData === 'string' ? undefined : wordData.sentence;

    setSelectedWord(wordText);
    setLlmResult(null);
    setLlmError(null);
    setIsLlmLoading(true);

    try {
      const result = await defineWordWithLLM(wordText, wordSentence, language);
      setLlmResult(result);
    } catch (err: any) {
      setLlmError(err.message || 'Failed to connect to the local LLM. Make sure your laptop hotspot is active and Ollama is running.');
    } finally {
      setIsLlmLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedWord(null);
    setLlmResult(null);
    setLlmError(null);
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
      <Modal
        visible={selectedWord !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>AI Dictionary</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.selectedWord}>"{selectedWord}"</Text>

            {isLlmLoading && (
              <View style={styles.llmLoadingContainer}>
                <ActivityIndicator size="large" color="#2182DE" />
                <Text style={styles.loadingText}>Asking Llama 3.1...</Text>
              </View>
            )}

            {llmError && (
              <ScrollView style={styles.errorContainer}>
                <Ionicons name="warning-outline" size={32} color="#FF3B30" style={{ alignSelf: 'center', marginBottom: 8 }} />
                <Text style={styles.errorTitle}>Connection Error</Text>
                <Text style={styles.errorTextDetails}>{llmError}</Text>
              </ScrollView>
            )}

            {llmResult && (
              <ScrollView style={styles.resultContainer} showsVerticalScrollIndicator={false}>
                {llmResult.context_sentence ? (
                  <>
                    <Text style={styles.contextSentence}>"{llmResult.context_sentence}"</Text>
                    <View style={styles.divider} />
                  </>
                ) : null}

                {/* English Section */}
                {language === 'English' && llmResult.english && (
                  <>
                    <Text style={styles.sectionTitle}>English</Text>
                    <Text style={styles.resultText}>{llmResult.english.definition}</Text>
                    {llmResult.english.synonyms && llmResult.english.synonyms.length > 0 && (
                      <Text style={styles.synonymsText}>Synonyms: {llmResult.english.synonyms.join(', ')}</Text>
                    )}

                    <View style={styles.divider} />
                  </>
                )}

                {/* Tagalog Section */}
                {language === 'Tagalog' && llmResult.tagalog && (
                  <>
                    <Text style={styles.sectionTitle}>Tagalog</Text>
                    <Text style={styles.resultText}>{llmResult.tagalog.definition}</Text>
                    {llmResult.tagalog.synonyms && llmResult.tagalog.synonyms.length > 0 && (
                      <Text style={styles.synonymsText}>Synonyms: {llmResult.tagalog.synonyms.join(', ')}</Text>
                    )}
                    {llmResult.tagalog.example_sentence && (
                      <Text style={styles.exampleText}>Example: "{llmResult.tagalog.example_sentence}"</Text>
                    )}
                  </>
                )}

                {/* Bisaya / Cebuano Section */}
                {language === 'Cebuano' && llmResult.bisaya && (
                  <>
                    <Text style={styles.sectionTitle}>Cebuano</Text>
                    <Text style={styles.resultText}>{llmResult.bisaya.definition}</Text>
                    {llmResult.bisaya.synonyms && llmResult.bisaya.synonyms.length > 0 && (
                      <Text style={styles.synonymsText}>Synonyms: {llmResult.bisaya.synonyms.join(', ')}</Text>
                    )}
                    {llmResult.bisaya.example_sentence && (
                      <Text style={styles.exampleText}>Example: "{llmResult.bisaya.example_sentence}"</Text>
                    )}
                  </>
                )}

                {/* Fallback for when the model returns an unexpected format */}
                {!llmResult.english && !llmResult.tagalog && !llmResult.bisaya && (
                  <View>
                    {Object.entries(llmResult).map(([key, value]) => {
                      if (key === 'word' || key === 'context_sentence') return null;
                      
                      // Check if value is an object with a definition (like in the screenshot)
                      const isStructured = typeof value === 'object' && value !== null && 'definition' in value;

                      return (
                        <View key={key} style={{ marginBottom: 16 }}>
                          <Text style={styles.sectionTitle}>{key}</Text>
                          {isStructured ? (
                            <View>
                              <Text style={styles.resultText}>{(value as any).definition}</Text>
                              {(value as any).synonyms && (value as any).synonyms.length > 0 && (
                                <Text style={styles.synonymsText}>
                                  Synonyms: {(value as any).synonyms.join(', ')}
                                </Text>
                              )}
                            </View>
                          ) : (
                            <Text style={styles.resultText}>
                              {typeof value === 'string' ? value : JSON.stringify(value)}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: '50%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  selectedWord: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2182DE',
    marginBottom: 24,
    textAlign: 'center',
  },
  llmLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  resultContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  resultText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 8,
  },
  contextSentence: {
    fontSize: 18,
    fontStyle: 'italic',
    color: '#444',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 16,
  },
  synonymsText: {
    fontSize: 14,
    color: '#2182DE',
    fontWeight: '500',
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#EAEAEA',
    marginVertical: 20,
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorTextDetails: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    lineHeight: 20,
  }
});

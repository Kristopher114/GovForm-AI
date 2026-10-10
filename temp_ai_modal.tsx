import { TranslationKey } from "@/constants/translations";
import { useLocalization } from "@/context/LocalizationContext";
import { lookupDictionary } from "@/utils/glossary";
import {
  defineWordWithLLM,
  explainSentenceWithLLM,
  getErrorCode,
  hasUsableResult,
  LLMError,
  LLMResponse,
} from "@/utils/llm";
import { isResearchEnabled, logEvent } from "@/utils/metrics";
import { tokenize } from "@/utils/phrase-match";
import {
  getApproximateDefinitions,
  getCachedSentenceMeaning,
  getCachedWordDefinition,
  saveSentenceMeaning,
  saveWordDefinition,
} from "@/utils/storage";
import { speakText, stopSpeaking } from "@/utils/tts";
import { Ionicons } from "@expo/vector-icons";
import * as Network from "expo-network";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type SpeakSection = "definition" | "example" | "sentence";
type SentenceState = "idle" | "loading" | "done" | "error";

// Maps an error code from llm.ts to a translated message key.
const ERROR_MESSAGE_KEYS: Record<string, TranslationKey> = {
  offline: "err_offline",
  timeout: "err_timeout",
  network: "err_network",
  rate_limit: "err_rate_limit",
  blocked: "err_blocked",
  server: "err_server",
  auth: "err_auth",
  invalid_response: "err_invalid",
};

interface AiDictionaryModalProps {
  visible: boolean;
  wordText: string | null;
  wordSentence: string | undefined; // the whole text block around the word
  wordLine?: string; // the single line of text the word is on
  wordOccurrence?: number; // 0 = first time this word appears on its line
  onClose: () => void;
}

function SpeakButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.sectionSpeakButton}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={
        active ? `Stop reading ${label}` : `Read ${label} aloud`
      }
    >
      <Ionicons
        name={active ? "stop-circle" : "volume-high"}
        size={22}
        color="#2182DE"
      />
    </TouchableOpacity>
  );
}

export default function AiDictionaryModal({
  visible,
  wordText,
  wordSentence,
  wordLine,
  wordOccurrence,
  onClose,
}: AiDictionaryModalProps) {
  const { language, t } = useLocalization();

  // Window size: normal (about half the screen) or expanded (almost full).
  // Drag the handle up/down, tap it, or use the Expand/Collapse button.
  const [expanded, setExpanded] = useState(false);
  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy < -30) setExpanded(true);
        else if (gesture.dy > 30) setExpanded(false);
        else if (Math.abs(gesture.dx) < 10 && Math.abs(gesture.dy) < 10)
          setExpanded((value) => !value);
      },
    }),
  ).current;

  const [isLlmLoading, setIsLlmLoading] = useState(false);
  const [llmResult, setLlmResult] = useState<LLMResponse | null>(null);
  // Translation key of the error message to show (null = no error)
  const [llmErrorKey, setLlmErrorKey] = useState<TranslationKey | null>(null);
  // True when the answer shown was saved from a different form (offline fallback)
  const [isApproximate, setIsApproximate] = useState(false);
  // Research mode (testers only): thumbs up/down on the answer
  const [researchOn, setResearchOn] = useState(false);
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  // Bumped by the "Try Again" button to run the lookup again
  const [retryCount, setRetryCount] = useState(0);
  // Which section is currently being read aloud (only one at a time).
  const [speakingSection, setSpeakingSection] = useState<SpeakSection | null>(
    null,
  );

  // "Explain this sentence": plain-language version of the form text around the word
  const [sentenceState, setSentenceState] = useState<SentenceState>("idle");
  const [sentenceMeaning, setSentenceMeaning] = useState("");
  const [sentenceErrorKey, setSentenceErrorKey] =
    useState<TranslationKey | null>(null);
  const sentenceRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!visible || !wordText) return;

    // Set when this run is replaced by a newer one (another word / language /
    // closed modal). A replaced run must never touch the screen again, so a slow
    // answer for word A can't appear under word B.
    let cancelled = false;
    const controller = new AbortController();
    const occurrence = wordOccurrence ?? 0;
    // Line the word is on; older saved scans only have the text block.
    const lineContext = wordLine && wordLine.trim() ? wordLine : wordSentence;

    const fetchDefinition = async () => {
      stopSpeaking();
      setSpeakingSection(null);
      setLlmResult(null);
      setLlmErrorKey(null);
      setIsApproximate(false);
      setRating(null);
      setIsLlmLoading(true);

      // Research mode: how long this lookup took and where the answer came from.
      const startedAt = Date.now();
      const record = (source: string, termShown: string, detail?: string) => {
        if (cancelled) return;
        logEvent({
          event: "lookup",
          language,
          source,
          term: termShown,
          ms: Date.now() - startedAt,
          detail,
        });
      };

      try {
        // 0. Bisaya only: the bundled dictionary (written by people) comes first.
        //    It works offline and needs no AI request.
        const fromDictionary = lookupDictionary(
          wordText,
          lineContext,
          occurrence,
          wordSentence,
          language,
        );
        if (fromDictionary) {
          record("dictionary", fromDictionary.term ?? wordText);
          setLlmResult(fromDictionary);
          return;
        }

        // 1. Check offline cache first. Ignore cached answers that are missing
        //    the selected language (old format / incomplete) and look them up again.
        let cached: LLMResponse | null = null;
        try {
          cached = await getCachedWordDefinition(
            wordText,
            lineContext,
            occurrence,
          );
        } catch (cacheErr) {
          console.log("Cache read failed:", cacheErr);
        }
        if (cancelled) return;

        if (cached && hasUsableResult(cached, language)) {
          record("cache", cached.term ?? wordText);
          setLlmResult(cached);
          return;
        }

        // 2. Not cached: check network before calling the API
        const networkState = await Network.getNetworkStateAsync();
        if (cancelled) return;
        if (
          !networkState.isConnected &&
          networkState.isInternetReachable !== true
        ) {
          // Offline: a saved answer for this phrase from a different form is
          // better than nothing, as long as the user is told.
          let approx: LLMResponse | undefined;
          try {
            const candidates = await getApproximateDefinitions(wordText);
            approx = candidates.find((c) => hasUsableResult(c, language));
          } catch (approxErr) {
            console.log("Approximate lookup failed:", approxErr);
          }
          if (cancelled) return;
          if (approx) {
            record("cache_approx", approx.term ?? wordText);
            setLlmResult(approx);
            setIsApproximate(true);
            return;
          }
          throw new LLMError("offline");
        }

        const result = await defineWordWithLLM(
          wordText,
          wordSentence,
          language,
          controller.signal,
          wordLine && wordLine.trim()
            ? { line: wordLine, occurrence }
            : undefined,
        );
        if (cancelled) return;

        // Show the result first; a cache failure must not hide a good answer.
        record("ai", result.term ?? wordText);
        setLlmResult(result);

        // 3. Save to cache for future offline use
        try {
          await saveWordDefinition(wordText, result);
        } catch (saveErr) {
          console.log("Cache save failed:", saveErr);
        }
      } catch (err) {
        if (cancelled) return;
        record("error", wordText, getErrorCode(err));
        console.log("Dictionary lookup failed:", err);
        setLlmErrorKey(ERROR_MESSAGE_KEYS[getErrorCode(err)] ?? "err_generic");
      } finally {
        if (!cancelled) setIsLlmLoading(false);
      }
    };

    fetchDefinition();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    visible,
    wordText,
    wordSentence,
    wordLine,
    wordOccurrence,
    language,
    retryCount,
  ]);

  // Stop any in-progress speech whenever the modal is hidden or unmounted,
  // so audio never keeps playing after the user leaves the dictionary.
  useEffect(() => {
    if (!visible) {
      stopSpeaking();
      setSpeakingSection(null);
    }
    return () => stopSpeaking();
  }, [visible]);

  const handleClose = () => {
    stopSpeaking();
    setSpeakingSection(null);
    setLlmResult(null);
    setLlmErrorKey(null);
    setIsApproximate(false);
    onClose();
  };

  // Data for the currently selected language
  const langData = llmResult
    ? language === "English"
      ? llmResult.english
      : language === "Tagalog"
        ? llmResult.tagalog
        : llmResult.bisaya
    : undefined;

  // Defensive reads: the model output is not guaranteed to match the schema,
  // so anything with an unexpected type is treated as "missing" instead of
  // crashing the modal.
  const definitionText =
    typeof langData?.definition === "string" ? langData.definition.trim() : "";
  const exampleSentence =
    typeof langData?.example_sentence === "string"
      ? langData.example_sentence.trim()
      : "";
  const synonymList: string[] = Array.isArray(langData?.synonyms)
    ? langData.synonyms.filter(
        (item: unknown): item is string =>
          typeof item === "string" && item.trim() !== "",
      )
    : [];

  // Heading: the full form label the AI found (e.g. "Date of Birth" when "Date"
  // was tapped). Falls back to the tapped word while loading or on old cache entries.
  const displayTerm =
    typeof llmResult?.term === "string" && llmResult.term.trim() !== ""
      ? llmResult.term.trim()
      : wordText;

  // The real sentence from the scanned document (not model-generated).
  // Hidden when it is just the word itself (e.g. Desktop OCR mode).
  const originalText = wordSentence?.trim() ?? "";
  const showOriginal =
    originalText !== "" &&
    originalText.toLowerCase() !== (wordText ?? "").trim().toLowerCase();

  const sampleData =
    typeof llmResult?.sample_data === "string"
      ? llmResult.sample_data.trim()
      : "";

  // Is research mode on? (decides whether the thumbs up/down buttons are shown)
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    isResearchEnabled().then((on) => {
      if (!cancelled) setResearchOn(on);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleRate = (value: "up" | "down") => {
    if (rating !== null) return;
    setRating(value);
    const source =
      llmResult?.source === "dictionary"
        ? "dictionary"
        : isApproximate
          ? "cache_approx"
          : "ai";
    logEvent({
      event: "rating",
      language,
      source,
      term: displayTerm ?? "",
      value,
    });
  };

  // The explain button only makes sense for real text (not a single label word).
  const canExplainSentence = showOriginal && tokenize(originalText).length >= 4;

  // Whenever the text (or language) changes: reset, then show a saved meaning
  // for this text if there is one (free, works offline).
  useEffect(() => {
    sentenceRequestRef.current?.abort();
    setSentenceState("idle");
    setSentenceMeaning("");
    setSentenceErrorKey(null);
    if (!visible || !canExplainSentence) return;

    let cancelled = false;
    getCachedSentenceMeaning(originalText, language)
      .then((saved) => {
        if (cancelled || !saved) return;
        setSentenceMeaning(saved);
        setSentenceState("done");
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      sentenceRequestRef.current?.abort();
    };
  }, [visible, originalText, language, canExplainSentence]);

  const handleExplainSentence = async () => {
    if (sentenceState === "loading") return;

    sentenceRequestRef.current?.abort();
    const controller = new AbortController();
    sentenceRequestRef.current = controller;

    setSentenceState("loading");
    setSentenceErrorKey(null);
    const startedAt = Date.now();

    try {
      const networkState = await Network.getNetworkStateAsync();
      if (controller.signal.aborted) return;
      if (
        !networkState.isConnected &&
        networkState.isInternetReachable !== true
      ) {
        throw new LLMError("offline");
      }

      const meaning = await explainSentenceWithLLM(
        originalText,
        language,
        controller.signal,
      );
      if (controller.signal.aborted) return;

      setSentenceMeaning(meaning);
      setSentenceState("done");
      logEvent({
        event: "sentence",
        language,
        source: "ai",
        ms: Date.now() - startedAt,
        value: `${tokenize(originalText).length} words`,
      });

      try {
        await saveSentenceMeaning(originalText, language, meaning);
      } catch (saveErr) {
        console.log("Sentence cache save failed:", saveErr);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      console.log("Sentence explanation failed:", err);
      logEvent({
        event: "sentence",
        language,
        source: "error",
        ms: Date.now() - startedAt,
        detail: getErrorCode(err),
      });
      setSentenceErrorKey(
        ERROR_MESSAGE_KEYS[getErrorCode(err)] ?? "err_generic",
      );
      setSentenceState("error");
    }
  };

  // Reads only the given section aloud. Tapping the same button again stops it;
  // tapping the other section's button switches to that section.
  const handleSpeak = (section: SpeakSection, text: string) => {
    if (speakingSection === section) {
      stopSpeaking();
      setSpeakingSection(null);
      return;
    }

    if (!text) return;

    setSpeakingSection(section);
    const finish = () =>
      setSpeakingSection((current) => (current === section ? null : current));

    speakText(text, language, {
      onDone: finish,
      onError: finish,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[styles.modalContent, expanded && styles.modalContentExpanded]}
        >
          <View {...handlePan.panHandlers} style={styles.handleArea}>
            <View style={styles.handleBar} />
          </View>

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>AI Dictionary</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setExpanded((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={t(
                  expanded ? "dict_collapse" : "dict_expand",
                )}
              >
                <Ionicons
                  name={expanded ? "contract-outline" : "expand-outline"}
                  size={16}
                  color="#2182DE"
                />
                <Text style={styles.expandButtonText}>
                  {t(expanded ? "dict_collapse" : "dict_expand")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          {wordText && (
            <View style={styles.selectedWordRow}>
              <Text style={styles.selectedWord}>"{displayTerm}"</Text>
            </View>
          )}

          {isLlmLoading && (
            <View style={styles.llmLoadingContainer}>
              <ActivityIndicator size="large" color="#2182DE" />
              <Text style={styles.loadingText}>Asking Gemini Flash 3.6...</Text>
            </View>
          )}

          {llmErrorKey && (
            <ScrollView style={styles.errorContainer}>
              <Ionicons
                name="warning-outline"
                size={32}
                color="#FF3B30"
                style={{ alignSelf: "center", marginBottom: 8 }}
              />
              <Text style={styles.errorTitle}>{t("err_title")}</Text>
              <Text style={styles.errorTextDetails}>{t(llmErrorKey)}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => setRetryCount((count) => count + 1)}
                accessibilityRole="button"
              >
                <Text style={styles.retryButtonText}>{t("btn_try_again")}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {llmResult && (
            <ScrollView
              style={styles.resultContainer}
              showsVerticalScrollIndicator={false}
            >
              {/* Where the answer came from: the human-written dictionary */}
              {llmResult.source === "dictionary" && (
                <View style={styles.sourceBadge}>
                  <Ionicons name="book-outline" size={13} color="#1B6B3A" />
                  <Text style={styles.sourceBadgeText}>
                    {t("badge_dictionary")}
                  </Text>
                </View>
              )}

              {/* Offline fallback notice */}
              {isApproximate && (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeText}>
                    {t("notice_approximate")}
                  </Text>
                </View>
              )}

              {/* Original sentence from the scanned document */}
              {showOriginal && (
                <>
                  <Text style={[styles.sectionTitle, styles.smallSectionTitle]}>
                    {t("label_original_text")}
                  </Text>
                  <Text style={styles.contextSentence}>"{originalText}"</Text>

                  {canExplainSentence && (
                    <View style={styles.sentenceArea}>
                      {sentenceState === "idle" && (
                        <TouchableOpacity
                          style={styles.explainButton}
                          onPress={handleExplainSentence}
                          accessibilityRole="button"
                        >
                          <Ionicons name="sparkles" size={16} color="#2182DE" />
                          <Text style={styles.explainButtonText}>
                            {t("btn_explain_sentence")}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {sentenceState === "loading" && (
                        <View style={styles.sentenceLoadingRow}>
                          <ActivityIndicator size="small" color="#2182DE" />
                          <Text style={styles.sentenceLoadingText}>
                            {t("loading_sentence")}
                          </Text>
                        </View>
                      )}

                      {sentenceState === "error" && (
                        <View>
                          <Text style={styles.sentenceErrorText}>
                            {t(sentenceErrorKey ?? "err_generic")}
                          </Text>
                          <TouchableOpacity
                            style={styles.explainButton}
                            onPress={handleExplainSentence}
                            accessibilityRole="button"
                          >
                            <Text style={styles.explainButtonText}>
                              {t("btn_try_again")}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {sentenceState === "done" && sentenceMeaning !== "" && (
                        <View style={styles.sentenceBox}>
                          <View style={styles.sectionHeaderRow}>
                            <Text
                              style={[
                                styles.sectionTitle,
                                styles.sectionTitleInRow,
                              ]}
                            >
                              {t("label_sentence_meaning")}
                            </Text>
                            <SpeakButton
                              active={speakingSection === "sentence"}
                              label="sentence meaning"
                              onPress={() =>
                                handleSpeak("sentence", sentenceMeaning)
                              }
                            />
                          </View>
                          <Text style={styles.sentenceMeaningText}>
                            {sentenceMeaning}
                          </Text>
                          <Text style={styles.aiNoteText}>
                            {t("notice_ai_generated")}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.divider} />
                </>
              )}

              {/* Definition, example sentence and synonyms (selected language) */}
              {definitionText !== "" && (
                <>
                  <View style={styles.sectionHeaderRow}>
                    <Text
                      style={[styles.sectionTitle, styles.sectionTitleInRow]}
                    >
                      {t("label_definition")}
                    </Text>
                    <SpeakButton
                      active={speakingSection === "definition"}
                      label="definition"
                      onPress={() => handleSpeak("definition", definitionText)}
                    />
                  </View>
                  <Text style={styles.resultText}>{definitionText}</Text>
                </>
              )}

              {exampleSentence !== "" && (
                <>
                  <View style={[styles.sectionHeaderRow, styles.sectionSpaced]}>
                    <Text
                      style={[styles.sectionTitle, styles.sectionTitleInRow]}
                    >
                      {t("label_example")}
                    </Text>
                    <SpeakButton
                      active={speakingSection === "example"}
                      label="example sentence"
                      onPress={() => handleSpeak("example", exampleSentence)}
                    />
                  </View>
                  <Text style={styles.exampleText}>"{exampleSentence}"</Text>
                </>
              )}

              {synonymList.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, styles.sectionSpaced]}>
                    {t("label_synonyms")}
                  </Text>
                  <Text style={styles.synonymsText}>
                    {synonymList.join(", ")}
                  </Text>
                </>
              )}

              {/* Fake sample entry (only for fill-in form fields) */}
              {sampleData !== "" && (
                <View style={styles.sampleBox}>
                  <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>
                    {t("label_sample_entry")}
                  </Text>
                  <Text style={styles.sampleText}>{sampleData}</Text>
                </View>
              )}

              {/* AI answers get a reminder; dictionary answers are not AI-generated */}
              {definitionText !== "" && llmResult.source !== "dictionary" && (
                <Text style={[styles.aiNoteText, { marginTop: 14 }]}>
                  {t("notice_ai_generated")}
                </Text>
              )}

              {/* Research mode: was this answer helpful? */}
              {researchOn && definitionText !== "" && (
                <View style={styles.ratingRow}>
                  {rating === null ? (
                    <>
                      <Text style={styles.ratingText}>
                        {t("research_helpful")}
                      </Text>
                      <TouchableOpacity
                        style={styles.ratingButton}
                        onPress={() => handleRate("up")}
                        accessibilityRole="button"
                        accessibilityLabel="Helpful"
                      >
                        <Ionicons
                          name="thumbs-up-outline"
                          size={22}
                          color="#2182DE"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.ratingButton}
                        onPress={() => handleRate("down")}
                        accessibilityRole="button"
                        accessibilityLabel="Not helpful"
                      >
                        <Ionicons
                          name="thumbs-down-outline"
                          size={22}
                          color="#B3261E"
                        />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.ratingThanks}>
                      {t("research_thanks")}
                    </Text>
                  )}
                </View>
              )}

              {/* Fallback for when the model returns an unexpected format */}
              {!llmResult.english &&
                !llmResult.tagalog &&
                !llmResult.bisaya && (
                  <View>
                    {Object.entries(llmResult).map(([key, value]) => {
                      if (
                        key === "word" ||
                        key === "context_sentence" ||
                        key === "sample_data"
                      )
                        return null;

                      const isStructured =
                        typeof value === "object" &&
                        value !== null &&
                        "definition" in value;

                      return (
                        <View key={key} style={{ marginBottom: 16 }}>
                          <Text style={styles.sectionTitle}>{key}</Text>
                          {isStructured ? (
                            <View>
                              <Text style={styles.resultText}>
                                {(value as any).definition}
                              </Text>
                              {Array.isArray((value as any).synonyms) &&
                                (value as any).synonyms.length > 0 && (
                                  <Text style={styles.synonymsText}>
                                    Synonyms:{" "}
                                    {(value as any).synonyms.join(", ")}
                                  </Text>
                                )}
                            </View>
                          ) : (
                            <Text style={styles.resultText}>
                              {typeof value === "string"
                                ? value
                                : JSON.stringify(value)}
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
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: "50%",
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
  },
  closeButton: {
    padding: 4,
  },
  modalContentExpanded: {
    height: "92%",
    minHeight: "92%",
    maxHeight: "92%",
  },
  handleArea: {
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: -14,
    paddingVertical: 12,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D0D0D0",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#2182DE",
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  expandButtonText: {
    color: "#2182DE",
    fontSize: 12,
    fontWeight: "600",
  },
  selectedWordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  selectedWord: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2182DE",
    textAlign: "center",
  },
  sentenceArea: {
    marginTop: 10,
  },
  explainButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#BFD9F2",
    backgroundColor: "#F4F9FE",
  },
  explainButtonText: {
    color: "#2182DE",
    fontSize: 14,
    fontWeight: "600",
  },
  sentenceLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sentenceLoadingText: {
    color: "#666",
    fontSize: 14,
  },
  sentenceErrorText: {
    color: "#B3261E",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  sentenceBox: {
    backgroundColor: "#F4F9FE",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#BFD9F2",
  },
  sentenceMeaningText: {
    fontSize: 16,
    color: "#222",
    lineHeight: 24,
  },
  aiNoteText: {
    fontSize: 12,
    color: "#888",
    marginTop: 8,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  ratingText: {
    flex: 1,
    fontSize: 13,
    color: "#666",
  },
  ratingButton: {
    padding: 6,
  },
  ratingThanks: {
    fontSize: 13,
    color: "#1B6B3A",
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: "#E6F4EA",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  sourceBadgeText: {
    color: "#1B6B3A",
    fontSize: 12,
    fontWeight: "600",
  },
  noticeBox: {
    backgroundColor: "#FFF6DD",
    borderWidth: 1,
    borderColor: "#F0DFA8",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  noticeText: {
    color: "#7A5B00",
    fontSize: 13,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: "center",
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: "#2182DE",
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitleInRow: {
    marginBottom: 0,
    flex: 1,
  },
  sectionSpeakButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EAF3FC",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  llmLoadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
  },
  resultContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  resultText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
    marginBottom: 8,
  },
  contextSentence: {
    fontSize: 18,
    fontStyle: "italic",
    color: "#444",
    textAlign: "center",
    lineHeight: 26,
    paddingHorizontal: 16,
  },
  smallSectionTitle: {
    fontSize: 13,
    color: "#888",
    marginBottom: 4,
    marginTop: 0,
  },
  sectionSpaced: {
    marginTop: 16,
  },
  exampleText: {
    fontSize: 16,
    fontStyle: "italic",
    color: "#444",
    lineHeight: 24,
    marginBottom: 4,
  },
  sampleBox: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#EAF3FC",
    borderWidth: 1,
    borderColor: "#BFD9F2",
  },
  sampleText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1B5FA8",
  },
  synonymsText: {
    fontSize: 14,
    color: "#2182DE",
    fontWeight: "500",
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#EAEAEA",
    marginVertical: 20,
  },
  errorContainer: {
    padding: 20,
    backgroundColor: "#FFF0F0",
    borderRadius: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FF3B30",
    textAlign: "center",
    marginBottom: 8,
  },
  errorTextDetails: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
    lineHeight: 20,
  },
});

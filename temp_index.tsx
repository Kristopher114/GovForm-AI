import AiDictionaryModal from "@/components/ai-dictionary-modal";
import FormSummaryChip from "@/components/form-summary-sheet";
import {
  HowToUseButton,
  HowToUseFirstLaunch,
} from "@/components/how-to-use-sheet";
import LargeTextView, {
  ViewMode,
  ViewModeSwitch,
} from "@/components/large-text-view";
import OfflineBanner from "@/components/offline-banner";
import { useLocalization } from "@/context/LocalizationContext";
import { checkIsOffline, useIsOffline } from "@/utils/connectivity";
import { recognizeForm } from "@/utils/form-recognition";
import {
  getLargeTextSize,
  getOpenInLargeText,
  LargeTextSize,
  saveLargeTextSize,
} from "@/utils/large-text-settings";
import { buildBoxesFromMlKit } from "@/utils/line-context";
import { logEvent } from "@/utils/metrics";
import { getOcrSettings } from "@/utils/ocr-settings";
import { saveRecentForm, updateRecentFormId } from "@/utils/storage";
import { clampPan, fitSize, MAX_ZOOM } from "@/utils/zoom-bounds";
import { Ionicons } from "@expo/vector-icons";
import TextRecognition from "@react-native-ml-kit/text-recognition";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router, useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import ExpoBlurDetector from "../../../modules/expo-blur-detector/src/ExpoBlurDetectorModule";

export interface BoundingBoxItem {
  id?: string;
  text: string;
  sentence?: string; // the whole text block around the word
  line?: string; // the single line of text the word is on
  occurrence?: number; // 0 = first time this word appears on its line, 1 = second, ...
  group?: number; // same number = same field or phrase (used by the Large text view)
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function HomeScreen() {
  const { t } = useLocalization();
  const navigation = useNavigation();

  const [image, setImage] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBoxItem[]>([]);
  // The saved copy of this scan, so a form the user picks can be saved with it.
  const savedRecentIdRef = useRef<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<BoundingBoxItem | null>(
    null,
  );

  // Photo view (highlights on the picture) or Large text view (big words).
  const [viewMode, setViewMode] = useState<ViewMode>("photo");
  const [textSize, setTextSize] = useState<LargeTextSize>("medium");

  // True while the phone has no internet: scanning is turned off.
  const offline = useIsOffline();

  // A new scan opens in Large text only if the person turned that on in Settings.
  const applyLargeTextPreference = async () => {
    setViewMode((await getOpenInLargeText()) ? "text" : "photo");
    setTextSize(await getLargeTextSize());
  };

  const handleChangeTextSize = (size: LargeTextSize) => {
    setTextSize(size);
    saveLargeTextSize(size);
  };

  // Card Layout Dimensions for scaling coordinates
  const [cardLayout, setCardLayout] = useState<{
    width: number;
    height: number;
  }>({
    width: 0,
    height: 0,
  });

  // --- Zoom & Pan Gesture State ---
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Size of the picture on screen and of the viewing area, used to stop the
  // form from being dragged out of its box (see utils/zoom-bounds.ts).
  const boundW = useSharedValue(0);
  const boundH = useSharedValue(0);
  const viewW = useSharedValue(0);
  const viewH = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(1, savedScale.value * e.scale));
      // Zooming out can leave the picture off-centre: pull it back inside.
      translateX.value = clampPan(
        translateX.value,
        scale.value,
        boundW.value,
        viewW.value,
      );
      translateY.value = clampPan(
        translateY.value,
        scale.value,
        boundH.value,
        viewH.value,
      );
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        translateX.value = 0;
        translateY.value = 0;
      }
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = clampPan(
          savedTranslateX.value + e.translationX,
          scale.value,
          boundW.value,
          viewW.value,
        );
        translateY.value = clampPan(
          savedTranslateY.value + e.translationY,
          scale.value,
          boundH.value,
          viewH.value,
        );
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Tell the gestures how big the picture and the viewing area are.
  // The card has 20 of padding on every side, and the picture sits inside it.
  useEffect(() => {
    if (!image || cardLayout.width <= 0 || cardLayout.height <= 0) return;
    const fit = fitSize(
      image.width,
      image.height,
      cardLayout.width - 40,
      cardLayout.height - 40,
    );
    boundW.value = fit.width;
    boundH.value = fit.height;
    viewW.value = cardLayout.width;
    viewH.value = cardLayout.height;
  }, [image, cardLayout]);

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: image ? { display: "none" } : undefined,
    });
  }, [image, navigation]);

  const processImageOCR = async (
    uri: string,
    originalWidth: number,
    originalHeight: number,
  ) => {
    const startedAt = Date.now(); // research mode: time from photo to word boxes
    savedRecentIdRef.current = null;
    setImage({ uri, width: originalWidth, height: originalHeight });
    setIsLoading(true);
    setSelectedWord(null);

    try {
      const blurScore = await ExpoBlurDetector.getBlurScore(uri);

      if (blurScore < 1000.0) {
        logEvent({
          event: "scan_rejected",
          source: "blur",
          ms: Date.now() - startedAt,
          value: String(Math.round(blurScore)),
          detail: "gallery",
        });
        Alert.alert(
          "Image Blurry",
          "The image is too blurry. Please upload a clearer photo.",
        );
        setImage(null);
        setIsLoading(false);
        return;
      }

      const ocrSettings = await getOcrSettings();
      let data: BoundingBoxItem[] = [];

      if (ocrSettings.mode === "desktop") {
        const url = `http://${ocrSettings.desktopIp}:8000/predict`;
        const response = await FileSystem.uploadAsync(url, uri, {
          fieldName: "file",
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        });

        if (response.status === 200) {
          const result = JSON.parse(response.body);
          data = result.boxes.map((box: any) => ({
            text: box.text,
            sentence: box.text, // Fallback to text since Python Tesseract doesn't currently group sentences
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          }));
        } else {
          throw new Error("Desktop OCR failed with status " + response.status);
        }
      } else {
        // Process locally with Google ML Kit
        const result = await TextRecognition.recognize(uri);

        // Words, the fields they belong to, and phrases that wrap onto the
        // next line ("DATE OF" / "BIRTH") are worked out from their positions.
        data.push(...buildBoxesFromMlKit(result.blocks));
      }

      console.log(`Γ£à Received ${data.length} bounding boxes from OCR!`);
      setBoundingBoxes(data);
      applyLargeTextPreference();
      logEvent({
        event: "scan",
        source: ocrSettings.mode === "desktop" ? "desktop" : "mlkit",
        ms: Date.now() - startedAt,
        value: String(data.length),
        detail: "gallery",
      });

      // Save to recents in the background
      // ...together with the supported form it was recognized as, when the app is sure.
      const recognition = recognizeForm(data);
      saveRecentForm(
        uri,
        data,
        recognition.status === "confident" ? recognition.formId : null,
      )
        .then((record) => {
          savedRecentIdRef.current = record?.id ?? null;
        })
        .catch((err) => console.log("Failed to save to recents", err));
    } catch (e) {
      console.error("ML Kit OCR Processing Error:", e);
      logEvent({
        event: "scan_error",
        ms: Date.now() - startedAt,
        detail: "gallery",
      });
      Alert.alert(
        "Processing Error",
        "Could not run text recognition locally. Details: " +
          (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Scanning needs internet. Checked again here in case the connection
  // dropped after the screen was drawn.
  const blockIfOffline = async (): Promise<boolean> => {
    if (await checkIsOffline()) {
      Alert.alert(t("offline_title"), t("offline_scan_blocked"));
      return true;
    }
    return false;
  };

  const takePhoto = async () => {
    if (await blockIfOffline()) return;
    router.push("/camera" as any);
  };

  const pickImage = async () => {
    if (await blockIfOffline()) return;
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        alert("Sorry, we need camera roll permissions to make this work!");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        processImageOCR(asset.uri, asset.width || 600, asset.height || 800);
      }
    } catch (error) {
      console.log("Error picking image:", error);
      alert("Failed to pick image");
    }
  };

  const handleCardLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCardLayout({ width, height });
  };

  const handleReset = () => {
    setImage(null);
    setBoundingBoxes([]);
    setSelectedWord(null);
    setIsLoading(false);

    // Reset zoom state
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  // 1. Loading Screen State
  if (image && isLoading) {
    return (
      <SafeAreaView style={styles.loadingScreenContainer}>
        <View style={styles.loadingCenterBox}>
          <LinearGradient
            colors={["#E5E5E5", "#1A1A1A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.progressBar}
          />
          <Text style={styles.loadingTitle}>Please Wait</Text>
          <Text style={styles.loadingSubtitle}>
            Scanning document and detecting text with OCR...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // 2. Google Lens Interactive Document Preview State
  if (image && !isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.previewHeaderContainer}>
          <Text style={styles.title}>{t("app_title")}</Text>
          <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
            <Ionicons name="close-circle-outline" size={28} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Which supported form this is (tap for its summary) */}
        <View style={styles.formChipRow}>
          <FormSummaryChip
            boxes={boundingBoxes}
            source="gallery"
            onFormChange={(formId) => {
              if (savedRecentIdRef.current)
                updateRecentFormId(savedRecentIdRef.current, formId);
            }}
          />
        </View>

        {/* How to use the results (tap a word, summary, zoom) */}
        <View style={styles.howToRow}>
          <HowToUseButton section="results" />
        </View>

        {/* Photo | Large text */}
        <View style={styles.viewModeRow}>
          <ViewModeSwitch mode={viewMode} onChange={setViewMode} />
        </View>

        {viewMode === "text" ? (
          <View style={styles.previewCardContainer}>
            <LargeTextView
              boxes={boundingBoxes}
              selectedWord={selectedWord}
              onSelectWord={setSelectedWord}
              size={textSize}
              onChangeSize={handleChangeTextSize}
            />
          </View>
        ) : (
          <View style={styles.previewCardContainer}>
            <View style={styles.darkCard} onLayout={handleCardLayout}>
              <GestureDetector gesture={composedGesture}>
                <Animated.View
                  style={[
                    StyleSheet.absoluteFill,
                    animatedStyle,
                    {
                      padding: 20,
                      justifyContent: "center",
                      alignItems: "center",
                    },
                  ]}
                >
                  <Image
                    source={{ uri: image.uri }}
                    style={styles.documentImage}
                    resizeMode="contain"
                  />

                  {/* Google Lens Interactive Bounding Box Overlays */}
                  {cardLayout.width > 0 &&
                    cardLayout.height > 0 &&
                    (() => {
                      const containerW = cardLayout.width - 40;
                      const containerH = cardLayout.height - 40;
                      const imgAspect = image.width / image.height;
                      const containerAspect = containerW / containerH;

                      let displayedW = containerW;
                      let displayedH = containerH;
                      let offsetX = 0; // relative to inner animated view which has padding
                      let offsetY = 0;

                      if (containerAspect > imgAspect) {
                        displayedW = containerH * imgAspect;
                        offsetX = (containerW - displayedW) / 2;
                      } else {
                        displayedH = containerW / imgAspect;
                        offsetY = (containerH - displayedH) / 2;
                      }

                      const scaleVal = displayedW / image.width;

                      return boundingBoxes.map((item, index) => {
                        const boxStyle = {
                          left: offsetX + item.x * scaleVal + 20, // add padding back
                          top: offsetY + item.y * scaleVal + 20,
                          width: item.width * scaleVal,
                          height: item.height * scaleVal,
                        };

                        const isSelected = selectedWord === item;

                        return (
                          <TouchableOpacity
                            key={index}
                            activeOpacity={0.7}
                            style={[
                              styles.boundingBox,
                              boxStyle,
                              isSelected && styles.selectedBoundingBox,
                            ]}
                            onPress={() => setSelectedWord(item)}
                          />
                        );
                      });
                    })()}
                </Animated.View>
              </GestureDetector>
            </View>
          </View>
        )}

        {/* Selected Word AI Dictionary Modal */}
        <AiDictionaryModal
          visible={selectedWord !== null}
          wordText={selectedWord ? selectedWord.text : null}
          wordSentence={selectedWord ? selectedWord.sentence : undefined}
          wordLine={selectedWord ? selectedWord.line : undefined}
          wordOccurrence={selectedWord ? selectedWord.occurrence : undefined}
          onClose={() => setSelectedWord(null)}
        />
      </SafeAreaView>
    );
  }

  // 3. Default Home State (Take / Pick photo buttons)
  return (
    <SafeAreaView style={styles.container}>
      {/* Shows the guide once, the first time the app opens */}
      <HowToUseFirstLaunch />
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>{t("app_title")}</Text>
          <Text style={styles.subtitle}>{t("subtitle")}</Text>
          <View style={styles.howToHome}>
            <HowToUseButton section="home" />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              offline && styles.actionButtonDisabled,
            ]}
            onPress={takePhoto}
            disabled={offline}
          >
            <Ionicons name="camera" size={80} color="white" />
            <Text style={styles.actionButtonText}>{t("btn_take_photo")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              offline && styles.actionButtonDisabled,
            ]}
            onPress={pickImage}
            disabled={offline}
          >
            <Ionicons name="cloud-upload" size={80} color="white" />
            <Text style={styles.actionButtonText}>{t("btn_choose_photo")}</Text>
          </TouchableOpacity>

          {offline && (
            <Text style={styles.offlineNote}>{t("offline_scan_blocked")}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  formChipRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  howToRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  viewModeRow: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  howToHome: {
    marginTop: 16,
  },
  container: {
    flex: 1,
    backgroundColor: "#F9F9F9",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerContainer: {
    paddingHorizontal: 24,
    paddingTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    gap: 32,
    alignItems: "center",
  },
  actionButton: {
    backgroundColor: "#2182DE",
    width: 306,
    height: 173,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  actionButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  actionButtonDisabled: {
    opacity: 0.35,
  },
  offlineNote: {
    color: "#7A4B00",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "600",
  },
  loadingScreenContainer: {
    flex: 1,
    backgroundColor: "#F9F9F9",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingCenterBox: {
    width: "80%",
    alignItems: "center",
  },
  progressBar: {
    width: "100%",
    height: 24,
    borderRadius: 12,
    marginBottom: 24,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 16,
  },
  loadingSubtitle: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    lineHeight: 18,
  },
  previewHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  resetButton: {
    padding: 4,
  },
  previewCardContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  darkCard: {
    flex: 1,
    backgroundColor: "#2C2D30",
    borderRadius: 24,
    overflow: "hidden",
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  documentImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  boundingBox: {
    position: "absolute",
    backgroundColor: "rgba(33, 130, 222, 0.3)",
    borderWidth: 1,
    borderColor: "#2182DE",
    borderRadius: 4,
  },
  selectedBoundingBox: {
    backgroundColor: "rgba(255, 204, 0, 0.5)",
    borderColor: "#FFCC00",
    borderWidth: 2,
  },
});

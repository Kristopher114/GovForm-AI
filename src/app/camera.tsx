import AiDictionaryModal from "@/components/ai-dictionary-modal";
import FormSummaryChip from "@/components/form-summary-sheet";
import { HowToUseButton } from "@/components/how-to-use-sheet";
import LargeTextView, {
  ViewMode,
  ViewModeSwitch,
} from "@/components/large-text-view";
import { useLocalization } from "@/context/LocalizationContext";
import {
  detectFormTypeByKeywords,
  getFormDisplayName,
  getFormIdFromType,
} from "@/utils/classification";
import {
  getLargeTextSize,
  getOpenInLargeText,
  LargeTextSize,
  saveLargeTextSize,
} from "@/utils/large-text-settings";
import { buildBoxesFromMlKit } from "@/utils/line-context";
import { logEvent } from "@/utils/metrics";
import { getOcrSettings } from "@/utils/ocr-settings";
import { saveRecentForm } from "@/utils/storage";
import { Ionicons } from "@expo/vector-icons";
import TextRecognition from "@react-native-ml-kit/text-recognition";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import ExpoBlurDetector from "../../modules/expo-blur-detector/src/ExpoBlurDetectorModule";

const CARD_PAD = 8; // space between the card edge and the form image

const ZOOM_PRESETS = [
  { label: "1x", value: 0 },
  { label: "1.2x", value: 0.05 },
  { label: "1.5x", value: 0.1 },
  { label: "2x", value: 0.18 },
];

export interface BoundingBoxItem {
  id?: string;
  text: string;
  sentence?: string;
  line?: string;
  occurrence?: number;
  group?: number;
  x: number; // Original image pixel X
  y: number; // Original image pixel Y
  width: number; // Original image pixel width
  height: number; // Original image pixel height
}

export default function CameraOCRScreen() {
  const { t } = useLocalization();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [torch, setTorch] = useState(false);

  const [capturedImage, setCapturedImage] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(
    "Processing document with OCR...",
  );
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBoxItem[]>([]);
  const [selectedWord, setSelectedWord] = useState<BoundingBoxItem | null>(
    null,
  );
  const [detectedFormId, setDetectedFormId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("photo");
  const [textSize, setTextSize] = useState<LargeTextSize>("medium");
  const [showOcrHighlights, setShowOcrHighlights] = useState(true);
  const [showZoomHint, setShowZoomHint] = useState(false);

  // Show the zoom hint briefly when a scan result appears
  useEffect(() => {
    if (!capturedImage) return;
    setShowZoomHint(true);
    const timer = setTimeout(() => setShowZoomHint(false), 4000);
    return () => clearTimeout(timer);
  }, [capturedImage]);

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

  // Automatically request camera permission on mount if needed
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // --- Zoom & Pan Gesture State ---
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Keep the zoomed image inside the card: max pan = half of the extra size
  const cardW = useSharedValue(0);
  const cardH = useSharedValue(0);
  const clampPan = (v: number, size: number) => {
    "worklet";
    const max = (size * (scale.value - 1)) / 2;
    return Math.min(Math.max(v, -max), max);
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(1, savedScale.value * e.scale), 6);
      translateX.value = clampPan(translateX.value, cardW.value);
      translateY.value = clampPan(translateY.value, cardH.value);
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
          cardW.value,
        );
        translateY.value = clampPan(
          savedTranslateY.value + e.translationY,
          cardH.value,
        );
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = 2;
        savedScale.value = 2;
      }
    });

  const composedGesture = Gesture.Simultaneous(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // --- Live Camera Zoom State & Pinch Gesture ---
  const [zoom, setZoom] = useState(0);
  const zoomShared = useSharedValue(0);
  const startZoom = useSharedValue(0);
  const lastPinchUpdate = useSharedValue(0);

  const handleSetZoom = (val: number) => {
    setZoom(val);
    zoomShared.value = val;
    startZoom.value = val;
    lastPinchUpdate.value = val;
  };

  const pinchCameraGesture = Gesture.Pinch()
    .onStart(() => {
      startZoom.value = zoomShared.value;
    })
    .onUpdate((e) => {
      const delta = (e.scale - 1) * 0.18;
      const next = Math.min(Math.max(startZoom.value + delta, 0), 0.5);
      zoomShared.value = next;
      if (Math.abs(next - lastPinchUpdate.value) > 0.015) {
        lastPinchUpdate.value = next;
        runOnJS(setZoom)(next);
      }
    })
    .onEnd(() => {
      runOnJS(setZoom)(Math.round(zoomShared.value * 100) / 100);
    });

  const handleAutoScan = async () => {
    if (isProcessing || isAutoScanning) return;

    try {
      setIsAutoScanning(true);
      setIsProcessing(true);
      setLoadingMessage("Opening Document Scanner...");

      // Small tick delay to let React unmount CameraView and release camera hardware & touch focus
      await new Promise((resolve) => setTimeout(resolve, 150));

      if (typeof ExpoBlurDetector.scanDocument === "function") {
        const result = await ExpoBlurDetector.scanDocument({
          mode: "full", // Full Google Document Scanner UI: auto/manual capture, crop & rotate, filters & save
          galleryImportAllowed: false, // 🚫 Permanently disables the gallery button
          maxNumDocuments: 1,
        });

        if (
          result &&
          result.status === "success" &&
          result.scannedImages &&
          result.scannedImages.length > 0
        ) {
          setLoadingMessage("Optimizing document...");
          const scannedUri = result.scannedImages[0];

          let manipResult = await ImageManipulator.manipulateAsync(
            scannedUri,
            [{ resize: { width: 1800 } }],
            { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
          );

          try {
            if (typeof ExpoBlurDetector.sharpenImage === "function") {
              const enhancedUri = await ExpoBlurDetector.sharpenImage(
                manipResult.uri,
              );
              if (enhancedUri && enhancedUri !== manipResult.uri) {
                manipResult = {
                  uri: enhancedUri,
                  width: manipResult.width,
                  height: manipResult.height,
                };
              }
            }
          } catch (enhErr) {
            console.warn("Text enhancement skipped:", enhErr);
          }

          setCapturedImage({
            uri: manipResult.uri,
            width: manipResult.width,
            height: manipResult.height,
          });

          await processCapturedPhoto(
            manipResult.uri,
            manipResult.width,
            manipResult.height,
          );
        }
      } else {
        Alert.alert(
          "Scanner Unavailable",
          "Auto document scanner requires an Android device with Google Play Services. You can use the manual shutter below.",
        );
      }
    } catch (err) {
      console.error("Auto scan error:", err);
      Alert.alert(
        "Scanner Error",
        "Failed to scan document: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setIsAutoScanning(false);
      setIsProcessing(false);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      setLoadingMessage("Capturing photo...");

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
      });

      if (!photo || !photo.uri) {
        Alert.alert("Capture Failed", "Could not capture photo from camera.");
        setIsProcessing(false);
        return;
      }

      setLoadingMessage("Optimizing image...");

      // 1. Auto-orient: If camera sensor captured landscape (width > height) while holding portrait, rotate 90° CW
      const actions: ImageManipulator.Action[] = [];
      const isLandscape =
        photo.width && photo.height && photo.width > photo.height;
      if (isLandscape) {
        console.log(
          "🔄 Auto-rotating landscape camera capture to upright portrait (90° CW)",
        );
        actions.push({ rotate: 90 });
      }

      // 2. High resolution scaling (1800px) with high quality compression (0.92) to keep text letters crisp
      actions.push({ resize: { width: 1800 } });

      let manipResult = await ImageManipulator.manipulateAsync(
        photo.uri,
        actions,
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
      );

      // 3. Document text contrast enhancement (if native module available)
      try {
        if (typeof ExpoBlurDetector.sharpenImage === "function") {
          setLoadingMessage("Enhancing text sharpness...");
          const enhancedUri = await ExpoBlurDetector.sharpenImage(
            manipResult.uri,
          );
          if (enhancedUri && enhancedUri !== manipResult.uri) {
            manipResult = {
              uri: enhancedUri,
              width: manipResult.width,
              height: manipResult.height,
            };
          }
        }
      } catch (enhErr) {
        console.warn("Text enhancement skipped:", enhErr);
      }

      setCapturedImage({
        uri: manipResult.uri,
        width: manipResult.width,
        height: manipResult.height,
      });

      // Blur detection check
      setLoadingMessage("Checking image quality...");
      try {
        const blurScore = await ExpoBlurDetector.getBlurScore(manipResult.uri);
        console.log("📷 Camera blur score:", blurScore);
        if (blurScore > 0 && blurScore < 60.0) {
          Alert.alert(
            "Image Blurry",
            "The captured photo may be blurry. Would you like to retake or process anyway?",
            [
              {
                text: "Retake",
                style: "cancel",
                onPress: () => {
                  setCapturedImage(null);
                  setIsProcessing(false);
                },
              },
              {
                text: "Process Anyway",
                onPress: () =>
                  processCapturedPhoto(
                    manipResult.uri,
                    manipResult.width,
                    manipResult.height,
                  ),
              },
            ],
          );
          return;
        }
      } catch (blurErr) {
        console.warn("Blur detection check skipped due to error:", blurErr);
      }

      await processCapturedPhoto(
        manipResult.uri,
        manipResult.width,
        manipResult.height,
      );
    } catch (err) {
      console.error("Camera capture error:", err);
      Alert.alert(
        "Error",
        "Failed to capture photo: " +
          (err instanceof Error ? err.message : String(err)),
      );
      setCapturedImage(null);
      setIsProcessing(false);
    }
  };

  const processCapturedPhoto = async (
    photoUri: string,
    imgWidth: number,
    imgHeight: number,
  ) => {
    try {
      setIsProcessing(true);
      setLoadingMessage("Recognizing text with OCR...");

      const ocrSettings = await getOcrSettings();
      let data: BoundingBoxItem[] = [];
      let visualFormType: string | undefined = undefined;

      if (ocrSettings.mode === "desktop") {
        let cleanIp = ocrSettings.desktopIp.trim();
        if (cleanIp.endsWith("/")) {
          cleanIp = cleanIp.slice(0, -1);
        }

        const baseUrl = cleanIp.toLowerCase().startsWith("http")
          ? cleanIp
          : `http://${cleanIp}:8000`;
        const url = `${baseUrl}/predict`;
        const response = await FileSystem.uploadAsync(url, photoUri, {
          fieldName: "file",
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        });

        if (response.status === 200) {
          const result = JSON.parse(response.body);
          if (result.formType && result.formType !== "UNKNOWN") {
            visualFormType = result.formType;
          }
          data = result.boxes.map((box: any) => ({
            text: box.text,
            sentence: box.text,
            line: box.text,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          }));
        } else {
          throw new Error("Desktop OCR failed with status " + response.status);
        }
      } else {
        // Local ML Kit OCR
        const result = await TextRecognition.recognize(photoUri);
        data.push(...buildBoxesFromMlKit(result.blocks));
      }

      console.log(`✅ Received ${data.length} bounding boxes from camera OCR!`);
      setBoundingBoxes(data);
      applyLargeTextPreference();

      // Document Classification (Keyword-first hierarchy)
      try {
        const fullText = data.map((b) => b.text).join(" ");
        const keywordType = detectFormTypeByKeywords(fullText);

        let formType = "UNKNOWN";
        if (keywordType !== "UNKNOWN") {
          formType = keywordType;
          console.log("Keyword classified form as:", formType);
        } else if (visualFormType && visualFormType !== "UNKNOWN") {
          formType = visualFormType;
          console.log("Visual OpenCV classified form as:", formType);
        }

        const formId = getFormIdFromType(formType);
        const displayTitle = getFormDisplayName(formType);

        saveRecentForm(
          photoUri,
          data,
          displayTitle !== "Scanned Document" ? displayTitle : undefined,
        ).catch((err) => console.log("Failed to save to recents", err));

        setDetectedFormId(formId);
        logEvent({ event: "scan", detail: formId ?? undefined });
      } catch (err) {
        saveRecentForm(photoUri, data).catch((err) =>
          console.log("Failed to save to recents", err),
        );
      }
    } catch (error) {
      console.error("ML Kit OCR Processing Error:", error);
      Alert.alert(
        "Processing Error",
        "Could not run text recognition locally. Details: " +
          (error instanceof Error ? error.message : String(error)),
      );
      setCapturedImage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset to live camera viewfinder
  const handleReset = () => {
    setCapturedImage(null);
    setBoundingBoxes([]);
    setSelectedWord(null);
    setDetectedFormId(null);
    setIsProcessing(false);

    // Reset zoom state
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  // Rotate captured document 90 degrees clockwise and re-run OCR
  const handleRotateImage = async () => {
    if (!capturedImage || isProcessing) return;

    try {
      setIsProcessing(true);
      setLoadingMessage("Rotating document & re-analyzing...");

      let rotated = await ImageManipulator.manipulateAsync(
        capturedImage.uri,
        [{ rotate: 90 }],
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
      );

      try {
        if (typeof ExpoBlurDetector.sharpenImage === "function") {
          const enhancedUri = await ExpoBlurDetector.sharpenImage(rotated.uri);
          if (enhancedUri && enhancedUri !== rotated.uri) {
            rotated = {
              uri: enhancedUri,
              width: rotated.width,
              height: rotated.height,
            };
          }
        }
      } catch (enhErr) {
        console.warn("Text enhancement on rotate skipped:", enhErr);
      }

      setCapturedImage({
        uri: rotated.uri,
        width: rotated.width,
        height: rotated.height,
      });

      await processCapturedPhoto(rotated.uri, rotated.width, rotated.height);
    } catch (err) {
      console.error("Rotate error:", err);
      Alert.alert(
        "Error",
        "Failed to rotate image: " +
          (err instanceof Error ? err.message : String(err)),
      );
      setIsProcessing(false);
    }
  };

  const handleCardLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCardLayout({ width, height });
    cardW.value = width;
    cardH.value = height;
  };

  // 1. Camera Permission checks
  if (!permission) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2182DE" />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons
          name="camera-outline"
          size={64}
          color="#2182DE"
          style={{ marginBottom: 16 }}
        />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionText}>
          GovForm-AI needs camera access to capture documents and recognize
          their text.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.permissionCancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.permissionCancelText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // 2. Loading Screen State during OCR processing
  if (capturedImage && isProcessing) {
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
          <Text style={styles.loadingSubtitle}>{loadingMessage}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 3. Interactive Document Preview State
  if (capturedImage && !isProcessing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.previewHeaderContainer}>
          <Text style={styles.title}>{t("app_title")}</Text>
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              onPress={handleRotateImage}
              style={styles.rotateButton}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={17} color="#2182DE" />
              <Text style={styles.rotateButtonText}>Rotate 90°</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
              <Ionicons name="close-circle-outline" size={28} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.chipContainer}>
          <FormSummaryChip detectedFormId={detectedFormId} />
        </View>

        <View style={styles.controlsRow}>
          <HowToUseButton section="results" />
          <View style={styles.viewModeSwitchWrap}>
            <ViewModeSwitch mode={viewMode} onChange={setViewMode} />
          </View>
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
                    { padding: CARD_PAD },
                  ]}
                >
                  <Image
                    source={{ uri: capturedImage.uri }}
                    style={styles.documentImage}
                    resizeMode="contain"
                  />

                  {/* Pixel-Perfect Interactive Bounding Box Overlays */}
                  {cardLayout.width > 0 &&
                    cardLayout.height > 0 &&
                    (() => {
                      const containerW = cardLayout.width - CARD_PAD * 2;
                      const containerH = cardLayout.height - CARD_PAD * 2;
                      const imgAspect =
                        capturedImage.width / capturedImage.height;
                      const containerAspect = containerW / containerH;

                      let displayedW = containerW;
                      let displayedH = containerH;
                      let offsetX = CARD_PAD;
                      let offsetY = CARD_PAD;

                      if (containerAspect > imgAspect) {
                        displayedW = containerH * imgAspect;
                        offsetX = CARD_PAD + (containerW - displayedW) / 2;
                      } else {
                        displayedH = containerW / imgAspect;
                        offsetY = CARD_PAD + (containerH - displayedH) / 2;
                      }

                      const scaleVal = displayedW / capturedImage.width;

                      return boundingBoxes.map((item, index) => {
                        const boxStyle = {
                          left: offsetX + item.x * scaleVal,
                          top: offsetY + item.y * scaleVal,
                          width: Math.max(item.width * scaleVal, 6),
                          height: Math.max(item.height * scaleVal, 6),
                        };

                        const isSelected = selectedWord === item;

                        return (
                          <TouchableOpacity
                            key={item.id || index}
                            activeOpacity={0.6}
                            style={[
                              styles.boundingBox,
                              boxStyle,
                              !showOcrHighlights && styles.hiddenBoundingBox,
                              showOcrHighlights &&
                                isSelected &&
                                styles.selectedBoundingBox,
                            ]}
                            onPress={() => setSelectedWord(item)}
                          />
                        );
                      });
                    })()}
                </Animated.View>
              </GestureDetector>
              {showZoomHint && (
                <View style={styles.zoomHint} pointerEvents="none">
                  <Text style={styles.zoomHintText}>Double-tap to zoom</Text>
                </View>
              )}
              {/* Floating toggle: stays fixed on the card, does not zoom */}
              <TouchableOpacity
                style={styles.highlightToggleButton}
                onPress={() => setShowOcrHighlights((previous) => !previous)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={showOcrHighlights ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#FFF"
                />
                <Text style={styles.highlightToggleText}>
                  {showOcrHighlights ? "Hide Highlights" : "Show Highlights"}
                </Text>
              </TouchableOpacity>
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

  // 4. Live Manual Camera Viewfinder State (4:3 ratio with Zoom & Framing controls)
  return (
    <SafeAreaView style={styles.cameraContainer}>
      {/* Top Bar: Back button, 4:3 indicator, Torch toggle */}
      <View style={styles.cameraTopBar}>
        <TouchableOpacity
          style={styles.cameraIconButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/");
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.cameraHeaderCenter}>
          <Text style={styles.cameraHeaderTitle}>Scan Document</Text>
          <View style={styles.ratioBadge}>
            <Text style={styles.ratioBadgeText}>4:3</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.autoScanPill}
            onPress={handleAutoScan}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            <Ionicons name="scan-outline" size={15} color="#FFF" />
            <Text style={styles.autoScanPillText}>Auto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.cameraIconButton,
              torch && styles.cameraIconButtonActive,
            ]}
            onPress={() => setTorch(!torch)}
          >
            <Ionicons
              name={torch ? "flash" : "flash-outline"}
              size={22}
              color={torch ? "#000" : "#FFF"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* 4:3 Viewfinder Container with pinch-to-zoom gesture */}
      <View style={styles.viewfinderWrapper}>
        <GestureDetector gesture={pinchCameraGesture}>
          <View
            style={styles.viewfinder43}
            pointerEvents={isAutoScanning ? "none" : "auto"}
          >
            {!isAutoScanning && (
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                ratio="4:3"
                zoom={zoom}
                enableTorch={torch}
              />
            )}

            {/* Document Framing Guide overlay */}
            <View style={styles.frameGuideBox} pointerEvents="none">
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <Text style={styles.frameGuideText}>
                Align document within the frame
              </Text>
            </View>
          </View>
        </GestureDetector>
      </View>

      {/* Bottom Bar: Zoom Controls & Manual Shutter Button */}
      <View style={styles.cameraBottomBar}>
        {/* Zoom Presets Selector */}
        <View style={styles.zoomControlRow}>
          {ZOOM_PRESETS.map((preset) => {
            const isActive = Math.abs(zoom - preset.value) < 0.02;
            return (
              <TouchableOpacity
                key={preset.label}
                style={[
                  styles.zoomPresetButton,
                  isActive && styles.zoomPresetButtonActive,
                ]}
                onPress={() => handleSetZoom(preset.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.zoomPresetText,
                    isActive && styles.zoomPresetTextActive,
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bottom Bar: Zoom Controls & Manual Shutter Button */}
        <View style={styles.shutterRow}>
          <TouchableOpacity
            style={[
              styles.scannerSwitchButton,
              isProcessing && styles.captureDisabled,
            ]}
            onPress={handleAutoScan}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            <Ionicons name="scan" size={20} color="#2182DE" />
            <Text style={styles.scannerSwitchText}>Auto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.captureOuterRing,
              isProcessing && styles.captureDisabled,
            ]}
            onPress={handleCapture}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#2182DE" />
            ) : (
              <View style={styles.captureInnerCircle} />
            )}
          </TouchableOpacity>

          <View style={styles.shutterSpacer} />
        </View>

        <Text style={styles.cameraHintText}>
          Tap Auto for auto-capture • Or Shutter for manual
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "space-between",
  },
  cameraTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  cameraHeaderCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cameraHeaderTitle: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "600",
  },
  ratioBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratioBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cameraIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraIconButtonActive: {
    backgroundColor: "#FFCC00",
  },
  viewfinderWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  viewfinder43: {
    width: "100%",
    aspectRatio: 3 / 4,
    maxHeight: "74%",
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },
  frameGuideBox: {
    width: "88%",
    height: "90%",
    position: "relative",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 16,
  },
  corner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: "#FFFFFF",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  frameGuideText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "500",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: "hidden",
  },
  cameraBottomBar: {
    alignItems: "center",
    paddingBottom: 24,
    paddingTop: 8,
  },
  zoomControlRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    padding: 3,
    marginBottom: 16,
  },
  zoomPresetButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  zoomPresetButtonActive: {
    backgroundColor: "#2182DE",
  },
  zoomPresetText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
  },
  zoomPresetTextActive: {
    color: "#FFF",
    fontWeight: "700",
  },
  shutterRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    paddingHorizontal: 20,
    position: "relative",
  },
  scannerSwitchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(33, 130, 222, 0.2)",
    borderWidth: 1.5,
    borderColor: "#2182DE",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: "absolute",
    left: 24,
  },
  scannerSwitchText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  shutterSpacer: {
    width: 60,
  },
  autoScanPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2182DE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 6,
  },
  autoScanPillText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  captureOuterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  captureDisabled: {
    opacity: 0.5,
  },
  captureInnerCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#FFFFFF",
  },
  cameraHintText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "500",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#F9F9F9",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: "#2182DE",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  permissionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  permissionCancelButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  permissionCancelText: {
    color: "#888",
    fontSize: 15,
  },
  container: {
    flex: 1,
    backgroundColor: "#F9F9F9",
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
    color: "#1A1A1A",
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 15,
    color: "#666666",
    textAlign: "center",
    lineHeight: 22,
  },
  previewHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rotateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(33, 130, 222, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  rotateButtonText: {
    color: "#2182DE",
    fontSize: 13,
    fontWeight: "600",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  resetButton: {
    padding: 4,
  },
  chipContainer: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  viewModeSwitchWrap: {
    flex: 1,
  },

  zoomHint: {
    position: "absolute",
    left: 12,
    bottom: 12,
    zIndex: 10,
    elevation: 10,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  zoomHintText: { color: "#E5E5E5", fontSize: 12, fontWeight: "500" },
  highlightToggleButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    zIndex: 10,
    elevation: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  highlightToggleText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
  },
  hiddenBoundingBox: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  previewCardContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  darkCard: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  documentImage: {
    width: "100%",
    height: "100%",
  },
  boundingBox: {
    position: "absolute",
    backgroundColor: "rgba(33, 130, 222, 0.14)",
    borderRadius: 4,
  },
  selectedBoundingBox: {
    backgroundColor: "rgba(255, 204, 0, 0.45)",
    borderColor: "#FFCC00",
    borderWidth: 2.5,
  },
});

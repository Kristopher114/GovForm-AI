import AiDictionaryModal from '@/components/ai-dictionary-modal';
import { getOcrSettings } from '@/utils/ocr-settings';
import { saveRecentForm } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import ExpoBlurDetector from '../../modules/expo-blur-detector/src/ExpoBlurDetectorModule';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface BoundingBoxItem {
  id?: string;
  text: string;
  sentence?: string;
  x: number;      // Original image pixel X
  y: number;      // Original image pixel Y
  width: number;  // Original image pixel width
  height: number; // Original image pixel height
}

export default function CameraOCRScreen() {
  const [capturedImage, setCapturedImage] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing document with OCR...');
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBoxItem[]>([]);
  const [selectedWord, setSelectedWord] = useState<BoundingBoxItem | null>(null);

  // Layout container dimensions for accurate coordinate scaling
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Automatically trigger document scanner when there is no captured image
  useEffect(() => {
    if (!capturedImage && !isScannerOpen && !isProcessing) {
      launchScanner();
    }
  }, [capturedImage, isScannerOpen, isProcessing]);

  // --- Zoom & Pan Gesture State ---
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const launchScanner = async () => {
    setIsScannerOpen(true);
    try {
      const { scannedImages } = await DocumentScanner.scanDocument({
        maxNumDocuments: 1,
      });

      if (scannedImages && scannedImages.length > 0) {
        await processImage(scannedImages[0]);
      } else {
        // User cancelled scanning, return to previous screen safely
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/');
        }
      }
    } catch (error) {
      console.error('Scanner error:', error);
      Alert.alert('Scanner Error', 'Failed to open document scanner.');
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } finally {
      setIsScannerOpen(false);
    }
  };

  const processImage = async (uri: string) => {
    try {
      setIsProcessing(true);
      setLoadingMessage('Optimizing image...');

      // Resize the image to 1000px width (maintaining aspect ratio) to drastically reduce upload size
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1000 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      setCapturedImage({
        uri: manipResult.uri,
        width: manipResult.width,
        height: manipResult.height,
      });

      setLoadingMessage('Checking image quality...');
      
      const blurScore = await ExpoBlurDetector.getBlurScore(manipResult.uri);
      
      if (blurScore < 1000.0) {
        Alert.alert("Image Blurry", "The image is too blurry. Please hold steady and try again.");
        setCapturedImage(null);
        setIsProcessing(false);
        return;
      }

      setLoadingMessage('Uploading image...');

      const ocrSettings = await getOcrSettings();
      let data: BoundingBoxItem[] = [];

      if (ocrSettings.mode === 'desktop') {
        let cleanIp = ocrSettings.desktopIp.trim();
        if (cleanIp.endsWith('/')) {
          cleanIp = cleanIp.slice(0, -1);
        }
        
        const baseUrl = cleanIp.toLowerCase().startsWith('http') 
          ? cleanIp 
          : `http://${cleanIp}:8000`;
        const url = `${baseUrl}/predict`;
        const response = await FileSystem.uploadAsync(url, manipResult.uri, {
          fieldName: 'file',
          httpMethod: 'POST',
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
          throw new Error('Desktop OCR failed with status ' + response.status);
        }
      } else {
        // Skip Python Server! Process locally with Google ML Kit.
        const result = await TextRecognition.recognize(manipResult.uri);

        result.blocks.forEach((block: any) => {
          // Create context sentence by concatenating all lines in the block
          const blockSentence = block.lines
            ? block.lines.map((l: any) => l.text).join(' ')
            : block.text;

          if (block.lines) {
            block.lines.forEach((line: any) => {
              if (line.elements) {
                line.elements.forEach((element: any) => {
                  data.push({
                    text: element.text,
                    sentence: blockSentence, // Keep block context for the dictionary LLM
                    x: element.frame?.left || 0,
                    y: element.frame?.top || 0,
                    width: element.frame?.width || 0,
                    height: element.frame?.height || 0,
                  });
                });
              } else {
                // Fallback to line level if elements are missing
                data.push({
                  text: line.text,
                  sentence: blockSentence,
                  x: line.frame?.left || 0,
                  y: line.frame?.top || 0,
                  width: line.frame?.width || 0,
                  height: line.frame?.height || 0,
                });
              }
            });
          } else {
            // Fallback to block level if lines are missing
            data.push({
              text: block.text,
              sentence: blockSentence,
              x: block.frame?.left || 0,
              y: block.frame?.top || 0,
              width: block.frame?.width || 0,
              height: block.frame?.height || 0,
            });
          }
        });
      }

      setBoundingBoxes(data);

      // Save to recents in the background
      saveRecentForm(manipResult.uri, data).catch(err => console.log('Failed to save to recents', err));
    } catch (error) {
      console.error('ML Kit OCR Processing Error:', error);
      Alert.alert(
        'Processing Error',
        'Could not run text recognition locally. Details: ' + (error instanceof Error ? error.message : String(error))
      );
      setCapturedImage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset to trigger scanner again
  const handleReset = () => {
    setCapturedImage(null);
    setBoundingBoxes([]);
    setSelectedWord(null);
    setIsProcessing(false);
    setIsScannerOpen(false);
    setLoadingMessage('Processing document with OCR...');

    // Reset zoom state
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  // Handle Box Tap
  const handleBoxPress = (item: BoundingBoxItem) => {
    setSelectedWord(item);
    console.log('----------------------------------------');
    console.log('📌 TAPPED WORD:', item.text);
    console.log('📖 CONTEXT SENTENCE:', item.sentence || 'No context sentence provided.');
    console.log('----------------------------------------');
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  return (
    <View style={styles.container}>
      {capturedImage ? (
        <View style={styles.previewContainer} onLayout={handleLayout}>
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
              <Image
                source={{ uri: capturedImage.uri }}
                style={styles.fullImage}
                resizeMode="contain"
              />

              {/* Bounding Box Overlay Layer */}
              {containerSize.width > 0 &&
                containerSize.height > 0 &&
                (() => {
                  const containerW = containerSize.width;
                  const containerH = containerSize.height;
                  const imgAspect = capturedImage.width / capturedImage.height;
                  const containerAspect = containerW / containerH;

                  let displayedW = containerW;
                  let displayedH = containerH;
                  let offsetX = 0;
                  let offsetY = 0;

                  if (containerAspect > imgAspect) {
                    displayedW = containerH * imgAspect;
                    offsetX = (containerW - displayedW) / 2;
                  } else {
                    displayedH = containerW / imgAspect;
                    offsetY = (containerH - displayedH) / 2;
                  }

                  const scaleVal = displayedW / capturedImage.width;

                  return boundingBoxes.map((item, index) => {
                    const boxStyle = {
                      left: offsetX + item.x * scaleVal,
                      top: offsetY + item.y * scaleVal,
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
                        onPress={() => handleBoxPress(item)}
                      />
                    );
                  });
                })()}
            </Animated.View>
          </GestureDetector>

          {/* Header Controls overlay */}
          <SafeAreaView style={styles.overlayHeader}>
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/');
                }
              }}
            >
              <Ionicons name="arrow-back" size={26} color="white" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={handleReset}>
              <Ionicons name="refresh" size={26} color="white" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Active Word AI Dictionary Modal */}
          <AiDictionaryModal
            visible={selectedWord !== null}
            wordText={selectedWord ? selectedWord.text : null}
            wordSentence={selectedWord ? selectedWord.sentence : undefined}
            onClose={() => setSelectedWord(null)}
          />

          {/* Processing Spinner Overlay */}
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={styles.processingText}>{loadingMessage}</Text>
            </View>
          )}
        </View>
      ) : (
        /* State 2: Waiting/Loading (Native Scanner overlays this) */
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={{ color: 'white', marginTop: 10 }}>Opening Document Scanner...</Text>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  boundingBox: {
    position: 'absolute',
    backgroundColor: 'rgba(33, 130, 222, 0.25)',
    borderWidth: 1,
    borderColor: '#2182DE',
    borderRadius: 3,
  },
  selectedBoundingBox: {
    backgroundColor: 'rgba(255, 204, 0, 0.45)',
    borderColor: '#FFCC00',
    borderWidth: 2,
  },
  overlayHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    zIndex: 10,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  processingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
});

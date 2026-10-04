import AiDictionaryModal from '@/components/ai-dictionary-modal';
import { useLocalization } from '@/context/LocalizationContext';
import { getOcrSettings } from '@/utils/ocr-settings';
import { saveRecentForm } from '@/utils/storage';
import { detectFormTypeByKeywords, getFormSummary } from '@/utils/classification';
import { Ionicons } from '@expo/vector-icons';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, SlideInLeft, SlideOutLeft } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import ExpoBlurDetector from '../../../modules/expo-blur-detector/src/ExpoBlurDetectorModule';

export interface BoundingBoxItem {
  id?: string;
  text: string;
  sentence?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Sample fallback bounding boxes simulating Tesseract --psm 11 sparse text detection
const DEMO_BOUNDING_BOXES: BoundingBoxItem[] = [
  { text: 'SUPPLEMENTARY/UPDATING', sentence: 'SUPPLEMENTARY/UPDATING OF DATA', x: 230, y: 135, width: 140, height: 12 },
  { text: 'PERSONAL', sentence: '1. PERSONAL INFORMATION', x: 130, y: 158, width: 70, height: 10 },
  { text: 'INFORMATION', sentence: '1. PERSONAL INFORMATION', x: 205, y: 158, width: 90, height: 10 },
  { text: 'PWD', sentence: '2. PWD TYPE OF DISABILITY', x: 420, y: 158, width: 35, height: 10 },
  { text: 'LAST NAME:', sentence: 'LAST NAME: DE LA CRUZ', x: 108, y: 172, width: 55, height: 8 },
  { text: 'FIRST NAME:', sentence: 'FIRST NAME: JUAN', x: 108, y: 186, width: 55, height: 8 },
  { text: 'MIDDLE NAME:', sentence: 'MIDDLE NAME: SANTOS', x: 108, y: 200, width: 62, height: 8 },
  { text: 'BARANGAY:', sentence: 'BARANGAY: SAN JOSE', x: 108, y: 228, width: 50, height: 8 },
  { text: 'CITY/MUNICIPALITY:', sentence: 'CITY/MUNICIPALITY: QUEZON CITY', x: 108, y: 242, width: 85, height: 8 },
  { text: 'INDIGENOUS', sentence: '3. INDIGENOUS PEOPLE', x: 130, y: 275, width: 75, height: 10 },
  { text: 'PEOPLE', sentence: '3. INDIGENOUS PEOPLE', x: 210, y: 275, width: 50, height: 10 },
  { text: 'Deaf/Hard of Hearing', sentence: 'Deaf/Hard of Hearing Disability', x: 300, y: 186, width: 95, height: 8 },
  { text: 'Psychosocial', sentence: 'Psychosocial Disability', x: 430, y: 186, width: 65, height: 8 },
  { text: 'Visual', sentence: 'Visual Impairment', x: 430, y: 214, width: 35, height: 8 },
  { text: 'Physical', sentence: 'Physical Disability', x: 300, y: 242, width: 45, height: 8 },
];

export default function HomeScreen() {
  const { t } = useLocalization();
  const navigation = useNavigation();

  const [image, setImage] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBoxItem[]>([]);
  const [selectedWord, setSelectedWord] = useState<BoundingBoxItem | null>(null);
  const [detectedForm, setDetectedForm] = useState<{type: string, summary: string} | null>(null);

  // Card Layout Dimensions for scaling coordinates
  const [cardLayout, setCardLayout] = useState<{ width: number; height: number }>({
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

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: image ? { display: 'none' } : undefined,
    });
  }, [image, navigation]);

  const processImageOCR = async (uri: string, originalWidth: number, originalHeight: number) => {
    setImage({ uri, width: originalWidth, height: originalHeight });
    setIsLoading(true);
    setSelectedWord(null);

    try {
      const blurScore = await ExpoBlurDetector.getBlurScore(uri);

      if (blurScore < 1000.0) {
        Alert.alert("Image Blurry", "The image is too blurry. Please upload a clearer photo.");
        setImage(null);
        setIsLoading(false);
        return;
      }

      const ocrSettings = await getOcrSettings();
      let data: BoundingBoxItem[] = [];
      let visualFormType: string | undefined = undefined;

      if (ocrSettings.mode === 'desktop') {
        let cleanIp = ocrSettings.desktopIp.trim();
        if (cleanIp.endsWith('/')) {
          cleanIp = cleanIp.slice(0, -1);
        }

        const baseUrl = cleanIp.toLowerCase().startsWith('http')
          ? cleanIp
          : `http://${cleanIp}:8000`;
        const url = `${baseUrl}/predict`;
        const response = await FileSystem.uploadAsync(url, uri, {
          fieldName: 'file',
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        });

        if (response.status === 200) {
          const result = JSON.parse(response.body);
          if (result.formType && result.formType !== 'UNKNOWN') {
            visualFormType = result.formType;
          }
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
        // Process locally with Google ML Kit
        const result = await TextRecognition.recognize(uri);

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
                // Fallback to line level
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
            // Fallback to block level
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

      console.log(`✅ Received ${data.length} bounding boxes from OCR!`);
      setBoundingBoxes(data);

      // Document Classification
      try {
        let formType = "UNKNOWN";
        if (visualFormType) {
          formType = visualFormType;
          console.log("Visual OpenCV classified form as:", formType);
        } else {
          const fullText = data.map(b => b.text).join(' ');
          formType = detectFormTypeByKeywords(fullText);
          console.log("Keyword classified form as:", formType);
        }
        
        // Save to recents in the background with classification title
        saveRecentForm(uri, data, formType).catch(err => console.log('Failed to save to recents', err));
        
        const summary = getFormSummary(formType);
        const displayType = formType === "UNKNOWN" ? "Unknown Document" : formType;
        setDetectedForm({ type: displayType, summary: summary });
      } catch (err) {
        // Fallback
        saveRecentForm(uri, data).catch(err => console.log('Failed to save to recents', err));
      }
    } catch (e) {
      console.error('ML Kit OCR Processing Error:', e);
      Alert.alert(
        'Processing Error',
        'Could not run text recognition locally. Details: ' + (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setIsLoading(false);
    }
  };

  const takePhoto = async () => {
    router.push('/camera' as any);
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        processImageOCR(asset.uri, asset.width || 600, asset.height || 800);
      }
    } catch (error) {
      console.log('Error picking image:', error);
      alert('Failed to pick image');
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
    setDetectedForm(null);
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
            colors={['#E5E5E5', '#1A1A1A']}
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
          <Text style={styles.title}>{t('app_title')}</Text>
          <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
            <Ionicons name="close-circle-outline" size={28} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.previewCardContainer}>
          <View style={styles.darkCard} onLayout={handleCardLayout}>
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={[StyleSheet.absoluteFill, animatedStyle, { padding: 20, justifyContent: 'center', alignItems: 'center' }]}>
                <Image source={{ uri: image.uri }} style={styles.documentImage} resizeMode="contain" />

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

        {/* Selected Word AI Dictionary Modal */}
        <AiDictionaryModal
          visible={selectedWord !== null}
          wordText={selectedWord ? selectedWord.text : null}
          wordSentence={selectedWord ? selectedWord.sentence : undefined}
          onClose={() => setSelectedWord(null)}
        />

        {/* Sidebar Overlay for Form Classification */}
        {detectedForm && (
          <Animated.View 
            style={styles.sidebarContainer}
            entering={SlideInLeft.duration(400).springify()}
            exiting={SlideOutLeft.duration(300)}
          >
            <TouchableOpacity style={styles.closeSidebarBtn} onPress={() => setDetectedForm(null)}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.sidebarContent}>
              <Ionicons name="document-text" size={36} color="#0A84FF" style={{ marginBottom: 12 }} />
              <Text style={styles.sidebarTitle}>{detectedForm.type}</Text>
              <View style={styles.sidebarDivider} />
              <Text style={styles.sidebarSummary}>{detectedForm.summary}</Text>
            </View>
          </Animated.View>
        )}
      </SafeAreaView>
    );
  }

  // 3. Default Home State (Take / Pick photo buttons)
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>{t('app_title')}</Text>
          <Text style={styles.subtitle}>{t('subtitle')}</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
            <Ionicons name="camera" size={80} color="white" />
            <Text style={styles.actionButtonText}>{t('btn_take_photo')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
            <Ionicons name="cloud-upload" size={80} color="white" />
            <Text style={styles.actionButtonText}>{t('btn_choose_photo')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
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
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    gap: 32,
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: '#2182DE',
    width: 306,
    height: 173,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingScreenContainer: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCenterBox: {
    width: '80%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 24,
    borderRadius: 12,
    marginBottom: 24,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  loadingSubtitle: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    lineHeight: 18,
  },
  previewHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    backgroundColor: '#2C2D30',
    borderRadius: 24,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  documentImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  boundingBox: {
    position: 'absolute',
    backgroundColor: 'rgba(33, 130, 222, 0.3)',
    borderWidth: 1,
    borderColor: '#2182DE',
    borderRadius: 4,
  },
  selectedBoundingBox: {
    backgroundColor: 'rgba(255, 204, 0, 0.5)',
    borderColor: '#FFCC00',
    borderWidth: 2,
  },
  wordDetailCard: {
    position: 'absolute',
    bottom: 30,
    left: 24,
    right: 24,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 20,
  },
  wordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  wordText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  contextText: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
  },
  sidebarContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '40%',
    backgroundColor: 'rgba(20, 20, 22, 0.85)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 200,
    paddingTop: 60,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  closeSidebarBtn: {
    position: 'absolute',
    top: 50,
    right: 15,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 210,
  },
  sidebarContent: {
    marginTop: 40,
  },
  sidebarTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 15,
  },
  sidebarSummary: {
    color: '#E0E0E0',
    fontSize: 15,
    lineHeight: 22,
  },
});

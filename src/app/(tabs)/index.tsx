import { useLocalization } from '@/context/LocalizationContext';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useNavigation } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import AiDictionaryModal from '@/components/ai-dictionary-modal';
import { useEffect, useState } from 'react';
import { saveRecentForm } from '@/utils/storage';
import {
  Image,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Use 10.0.2.2 if testing on Android Emulator, or your IP (192.168.x.x) if testing on physical phone
const PYTHON_API_URL = 'https://govform-ai-7uef.onrender.com/scan';

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
      // Use expo-file-system for a reliable native file upload
      const response = await FileSystem.uploadAsync(PYTHON_API_URL, uri, {
        fieldName: 'file',
        httpMethod: 'POST',
        uploadType: 1, // 1 corresponds to MULTIPART in Expo FileSystem
      });

      if (response.status === 200) {
        const data: BoundingBoxItem[] = JSON.parse(response.body);
        console.log(`✅ Received ${data.length} bounding boxes from server!`);
        console.log(data.slice(0, 2)); // Print just the first two to keep console clean
        setBoundingBoxes(data);
        
        // Save to recents in the background
        saveRecentForm(uri, data).catch(err => console.log('Failed to save to recents', err));
      } else {
        console.log(`❌ Server Error! Status: ${response.status}`);
        Alert.alert(
          'Connection Error',
          `Could not connect to Python API at ${PYTHON_API_URL}. Ensure server is running.`
        );
      }
    } catch (e) {
      console.log('Error hitting Python API:', e);
      Alert.alert(
        'Connection Error',
        `Could not connect to Python API at ${PYTHON_API_URL}. Ensure server is running.`
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
});

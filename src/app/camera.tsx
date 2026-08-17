import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

// -----------------------------------------------------------------------------
// CONFIGURATION: Set your local Python server IP here
// -----------------------------------------------------------------------------
const PYTHON_API_URL = 'https://govform-ai-7uef.onrender.com/scan';

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
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const [capturedImage, setCapturedImage] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing document with OCR...');
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBoxItem[]>([]);
  const [selectedWord, setSelectedWord] = useState<BoundingBoxItem | null>(null);

  // Layout container dimensions for accurate coordinate scaling
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Automatically request camera permission on mount
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // Handle image capture and API upload
  const handleCapture = async () => {
    if (!cameraRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photo) {
        Alert.alert('Error', 'Failed to capture photo.');
        setIsProcessing(false);
        return;
      }

      setCapturedImage({
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
      });

      // Prepare FormData for local Python API
      const formData = new FormData();
      formData.append('file', {
        uri: photo.uri,
        name: 'capture.jpg',
        type: 'image/jpeg',
      } as any);

      setLoadingMessage('Uploading image...');

      // POST Request to local Python server with Automatic Retry for Render Cold Starts
      let response;
      let retries = 3;
      
      for (let i = 0; i < retries; i++) {
        try {
          response = await fetch(PYTHON_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            body: formData,
          });
          
          if (response.ok) break; // Success! Exit the retry loop.
          
        } catch (error) {
          if (i === retries - 1) throw error; // If last try fails, throw error
          
          console.log(`Connection failed. Retrying... (${i + 1}/${retries})`);
          setLoadingMessage('Waking up cloud server (this can take 60s)...');
          
          // Wait 15 seconds before trying again to let Render boot up
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
      }

      if (!response || !response.ok) {
        throw new Error(`Server returned status ${response?.status}`);
      }

      const data: BoundingBoxItem[] = await response.json();
      setBoundingBoxes(data);
    } catch (error) {
      console.error('OCR Processing Error:', error);
      Alert.alert(
        'Connection Error',
        `Could not connect to Python API at ${PYTHON_API_URL}. Ensure server is running.`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset to live camera
  const handleReset = () => {
    setCapturedImage(null);
    setBoundingBoxes([]);
    setSelectedWord(null);
    setIsProcessing(false);
    setLoadingMessage('Processing document with OCR...');
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

  // Camera permission states
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2182DE" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.permissionText}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* State 1: Captured Image & Interactive Bounding Boxes Overlay */}
      {capturedImage ? (
        <View style={styles.previewContainer} onLayout={handleLayout}>
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

              const scale = displayedW / capturedImage.width;

              return boundingBoxes.map((item, index) => {
                const boxStyle = {
                  left: offsetX + item.x * scale,
                  top: offsetY + item.y * scale,
                  width: item.width * scale,
                  height: item.height * scale,
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

          {/* Header Controls overlay */}
          <SafeAreaView style={styles.overlayHeader}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={26} color="white" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={handleReset}>
              <Ionicons name="refresh" size={26} color="white" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Active Word Detail Callout Card */}
          {selectedWord && (
            <View style={styles.wordDetailCard}>
              <View style={styles.wordHeaderRow}>
                <Text style={styles.wordText}>{selectedWord.text}</Text>
                <TouchableOpacity onPress={() => setSelectedWord(null)}>
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              {selectedWord.sentence && (
                <Text style={styles.contextText}>"{selectedWord.sentence}"</Text>
              )}
            </View>
          )}

          {/* Processing Spinner Overlay */}
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={styles.processingText}>{loadingMessage}</Text>
            </View>
          )}
        </View>
      ) : (
        /* State 2: Live Full-Screen Camera */
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back">
          <SafeAreaView style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={26} color="white" />
            </TouchableOpacity>

            {/* Centered Capture Button */}
            <View style={styles.bottomBar}>
              <TouchableOpacity style={styles.captureOuterRing} onPress={handleCapture}>
                <View style={styles.captureInnerCircle} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </CameraView>
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
    backgroundColor: '#F9F9F9',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#2182DE',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    alignItems: 'center',
    marginBottom: 30,
  },
  captureOuterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInnerCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'white',
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
  wordDetailCard: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
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
    marginBottom: 6,
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
    lineHeight: 20,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFill,
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

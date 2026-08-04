import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalization } from '@/context/LocalizationContext';

export default function HomeScreen() {
  const { t } = useLocalization();
  const [image, setImage] = useState<string | null>(null);

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log('Error taking photo:', error);
      alert('Failed to open camera');
    }
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
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log('Error picking image:', error);
      alert('Failed to pick image');
    }
  };

  if (image) {
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
            Lorem ipsum dolor sit amet consectetur. Consectetur eu ac morbi id tellus tincidunt et. Arcu lobortis ullamcorper est gravida at iaculis fames imperdiet. Velit sit non tempor risus amet enim amet morbi.
          </Text>
          
          <TouchableOpacity onPress={() => setImage(null)} style={{marginTop: 40}}>
            <Text style={{color: '#2182DE', fontWeight: 'bold'}}>Cancel / Go Back (Dev only)</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>{t('app_title')}</Text>
          <Text style={styles.subtitle}>
            {t('subtitle')}
          </Text>
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
  }
});

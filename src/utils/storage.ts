import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

export interface BoundingBoxItem {
  id?: string;
  text: string;
  sentence?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HarvestedWord {
  text: string;
  sentence?: string;
}

export interface RecentForm {
  id: string;
  title: string;
  dateStr: string;
  thumbnailUri: string;
  words: Array<HarvestedWord | string>;
}

const STORAGE_KEY = '@govform_recent_scans';

export const saveRecentForm = async (
  originalUri: string,
  boundingBoxes: BoundingBoxItem[]
) => {
  try {
    // 1. Copy image to a permanent document directory so it doesn't get cleared by the OS
    const fileName = originalUri.split('/').pop() || `scan_${Date.now()}.jpg`;
    const permanentUri = FileSystem.documentDirectory + fileName;
    
    await FileSystem.copyAsync({
      from: originalUri,
      to: permanentUri,
    });

    // 2. Harvest just the words and their context sentences
    const words: HarvestedWord[] = boundingBoxes.map(box => ({
      text: box.text,
      sentence: box.sentence,
    }));

    // 3. Create the record
    const newRecord: RecentForm = {
      id: Date.now().toString(),
      title: `Scanned Document - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      dateStr: new Date().toLocaleString(),
      thumbnailUri: permanentUri,
      words,
    };

    // 4. Save to AsyncStorage
    const existingStr = await AsyncStorage.getItem(STORAGE_KEY);
    const existing: RecentForm[] = existingStr ? JSON.parse(existingStr) : [];
    
    // Add to beginning of array (most recent first)
    existing.unshift(newRecord);
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    return newRecord;
  } catch (error) {
    console.error('Error saving recent form:', error);
    throw error;
  }
};

export const getRecentForms = async (): Promise<RecentForm[]> => {
  try {
    const dataStr = await AsyncStorage.getItem(STORAGE_KEY);
    return dataStr ? JSON.parse(dataStr) : [];
  } catch (error) {
    console.error('Error getting recent forms:', error);
    return [];
  }
};

export const getRecentFormById = async (id: string): Promise<RecentForm | null> => {
  try {
    const forms = await getRecentForms();
    return forms.find(f => f.id === id) || null;
  } catch (error) {
    console.error('Error getting recent form by id:', error);
    return null;
  }
};

export const deleteRecentForm = async (id: string, thumbnailUri: string) => {
  try {
    // 1. Remove from AsyncStorage
    const existingStr = await AsyncStorage.getItem(STORAGE_KEY);
    if (!existingStr) return;
    
    const existing: RecentForm[] = JSON.parse(existingStr);
    const filtered = existing.filter(form => form.id !== id);
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

    // 2. Delete the physical image file to save storage
    await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });
  } catch (error) {
    console.error('Error deleting recent form:', error);
    throw error;
  }
};

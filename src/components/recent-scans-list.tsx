import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { RecentForm, deleteRecentForm } from '@/utils/storage';

interface RecentScansListProps {
  recentForms: RecentForm[];
  onRefresh: () => void;
}

export default function RecentScansList({ recentForms, onRefresh }: RecentScansListProps) {
  const handleDelete = (id: string, uri: string) => {
    Alert.alert('Delete Scan', 'Are you sure you want to delete this scan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRecentForm(id, uri);
          onRefresh(); // Refresh list
        },
      },
    ]);
  };

  const renderFormItem = ({ item }: { item: RecentForm }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/form-details', params: { id: item.id } })}
    >
      <Image source={{ uri: item.thumbnailUri }} style={styles.thumbnail} />
      
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardDate}>{item.dateStr}</Text>
        <Text style={styles.wordCount}>{(item.words?.length ?? 0)} words found</Text>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item.id, item.thumbnailUri)}
      >
        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (recentForms.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={64} color="#CCC" />
        <Text style={styles.emptyText}>No recent scans found.</Text>
        <Text style={styles.emptySubText}>Upload or take a picture of a form to see it here.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={recentForms}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      renderItem={renderFormItem}
    />
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  thumbnail: {
    width: 60,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#EAEAEA',
  },
  cardContent: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  wordCount: {
    fontSize: 12,
    color: '#2182DE',
    fontWeight: '600',
  },
  deleteButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

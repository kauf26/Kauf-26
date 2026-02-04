import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../services/api';

const MARKETPLACES = [
  { id: 'ebay', name: 'eBay', icon: 'cart' },
  { id: 'amazon', name: 'Amazon', icon: 'logo-amazon' },
  { id: 'etsy', name: 'Etsy', icon: 'basket' },
  { id: 'shopify', name: 'Shopify', icon: 'bag' },
  { id: 'woocommerce', name: 'WooCommerce', icon: 'logo-wordpress' },
  { id: 'mercadolibre', name: 'Mercado Libre', icon: 'globe' },
  { id: 'rakuten', name: 'Rakuten', icon: 'storefront' },
  { id: 'depop', name: 'Depop', icon: 'shirt' },
  { id: 'vinted', name: 'Vinted', icon: 'pricetag' },
  { id: 'grailed', name: 'Grailed', icon: 'diamond' },
];

export default function HomeScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListing, setIsListing] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
      analyzeImage(result.assets[0].base64 || '');
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Camera access is needed to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
      analyzeImage(result.assets[0].base64 || '');
    }
  };

  const analyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/analyze-base64`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: `data:image/jpeg;base64,${base64}` }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setTitle(data.title || '');
        setDescription(data.description || '');
        if (data.suggestedPrice) {
          setPrice(data.suggestedPrice.toString());
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze image. Please enter details manually.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleMarketplace = (id: string) => {
    setSelectedMarketplaces((prev) =>
      prev.includes(id)
        ? prev.filter((m) => m !== id)
        : [...prev, id]
    );
  };

  const handleCreateListing = async () => {
    if (!title || !price || selectedMarketplaces.length === 0) {
      Alert.alert('Missing Information', 'Please fill in title, price, and select at least one marketplace.');
      return;
    }

    setIsListing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          price: parseFloat(price),
          marketplaces: selectedMarketplaces,
          imageUrl: image,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', `Listing created on ${selectedMarketplaces.length} marketplace(s)!`);
        setImage(null);
        setTitle('');
        setDescription('');
        setPrice('');
        setSelectedMarketplaces([]);
      } else {
        throw new Error('Failed to create listing');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create listing. Please try again.');
    } finally {
      setIsListing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.imageSection}>
          {image ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: image }} style={styles.image} />
              <TouchableOpacity
                style={styles.removeImage}
                onPress={() => setImage(null)}
              >
                <Ionicons name="close-circle" size={28} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <View style={styles.imageButtons}>
                <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
                  <Ionicons name="camera" size={32} color="#3b82f6" />
                  <Text style={styles.imageButtonText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                  <Ionicons name="images" size={32} color="#3b82f6" />
                  <Text style={styles.imageButtonText}>Choose Photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {isAnalyzing && (
          <View style={styles.analyzingContainer}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.analyzingText}>AI analyzing product...</Text>
          </View>
        )}

        <View style={styles.form}>
          <Text style={styles.label}>Product Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter product title"
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Description (AI-generated)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Description will be generated by AI"
            placeholderTextColor="#6b7280"
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>Price (USD)</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            placeholderTextColor="#6b7280"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Select Marketplaces</Text>
          <View style={styles.marketplaces}>
            {MARKETPLACES.map((marketplace) => (
              <TouchableOpacity
                key={marketplace.id}
                style={[
                  styles.marketplaceChip,
                  selectedMarketplaces.includes(marketplace.id) && styles.marketplaceChipSelected,
                ]}
                onPress={() => toggleMarketplace(marketplace.id)}
              >
                <Ionicons
                  name={marketplace.icon as any}
                  size={16}
                  color={selectedMarketplaces.includes(marketplace.id) ? '#ffffff' : '#9ca3af'}
                />
                <Text
                  style={[
                    styles.marketplaceText,
                    selectedMarketplaces.includes(marketplace.id) && styles.marketplaceTextSelected,
                  ]}
                >
                  {marketplace.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.createButton, (!title || !price || selectedMarketplaces.length === 0) && styles.createButtonDisabled]}
          onPress={handleCreateListing}
          disabled={!title || !price || selectedMarketplaces.length === 0 || isListing}
        >
          {isListing ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color="#ffffff" />
              <Text style={styles.createButtonText}>Create Listings</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  imageSection: {
    marginBottom: 20,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: '#1f2937',
  },
  removeImage: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: '#1f2937',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 32,
  },
  imageButton: {
    alignItems: 'center',
    gap: 8,
  },
  imageButtonText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  analyzingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#1f2937',
    borderRadius: 8,
  },
  analyzingText: {
    color: '#3b82f6',
    fontSize: 14,
  },
  form: {
    marginBottom: 20,
  },
  label: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  marketplaces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  marketplaceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  marketplaceChipSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  marketplaceText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  marketplaceTextSelected: {
    color: '#ffffff',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  createButtonDisabled: {
    backgroundColor: '#374151',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

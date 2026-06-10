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
import { publishListing } from '../services/marketplaceClients';
import { hasPlatformTokens } from '../services/secureTokenStore';
import {
  MAX_DRAFT_IMAGES,
  addPhotosToDraftMobile,
  draftImagesFromRecord,
  saveDraftSnapshotMobile,
  uploadDraftPhotosMobile,
} from '../services/draftPhotos';

const MOBILE_PUBLISH_PLATFORMS = new Set(['etsy', 'shopify', 'ebay']);

const MARKETPLACES = [
  { id: 'aliexpress', name: 'AliExpress', icon: 'pricetag' as const, color: '#e62e04' },
  { id: 'allegro', name: 'Allegro', icon: 'cart' as const, color: '#ff5a00' },
  { id: 'amazon', name: 'Amazon', icon: 'logo-amazon' as const, color: '#ff9900' },
  { id: 'bigcommerce', name: 'BigCommerce', icon: 'cart' as const, color: '#34313f' },
  { id: 'bolcom', name: 'Bol.com', icon: 'storefront' as const, color: '#0000ff' },
  { id: 'depop', name: 'Depop', icon: 'shirt' as const, color: '#ff2300' },
  { id: 'ebay', name: 'eBay', icon: 'cart' as const, color: '#e53238' },
  { id: 'etsy', name: 'Etsy', icon: 'basket' as const, color: '#f45800' },
  { id: 'flipkart', name: 'Flipkart', icon: 'bag' as const, color: '#2874f0' },
  { id: 'fruugo', name: 'Fruugo', icon: 'globe' as const, color: '#00a651' },
  { id: 'lazada', name: 'Lazada', icon: 'pricetags' as const, color: '#0f146d' },
  { id: 'magento', name: 'Magento', icon: 'cube' as const, color: '#f26322' },
  { id: 'mercadolibre', name: 'MercadoLibre', icon: 'globe' as const, color: '#ffe600' },
  { id: 'mercadolibre_br', name: 'Mercado Livre BR', icon: 'globe' as const, color: '#ffe600' },
  { id: 'newegg', name: 'Newegg', icon: 'hardware-chip' as const, color: '#f7941d' },
  { id: 'poshmark', name: 'Poshmark', icon: 'shirt-outline' as const, color: '#7b2d8e' },
  { id: 'rakuten', name: 'Rakuten', icon: 'storefront' as const, color: '#bf0000' },
  { id: 'shopee', name: 'Shopee', icon: 'bag-handle' as const, color: '#ee4d2d' },
  { id: 'shopify', name: 'Shopify', icon: 'bag' as const, color: '#95bf47' },
  { id: 'stockx', name: 'StockX', icon: 'footsteps' as const, color: '#006340' },
  { id: 'taobao', name: 'Taobao', icon: 'pricetag' as const, color: '#ff5000' },
  { id: 'tiktokshop', name: 'TikTok Shop', icon: 'musical-notes' as const, color: '#000000' },
  { id: 'vinted', name: 'Vinted', icon: 'shirt' as const, color: '#09b1ba' },
  { id: 'wayfair', name: 'Wayfair', icon: 'home' as const, color: '#7b2d8e' },
  { id: 'woocommerce', name: 'WooCommerce', icon: 'logo-wordpress' as const, color: '#96588a' },
  { id: 'zalando', name: 'Zalando', icon: 'shirt' as const, color: '#ff6900' },
];

const US_MARKETPLACE_IDS = new Set([
  'amazon',
  'depop',
  'ebay',
  'newegg',
  'poshmark',
  'stockx',
  'wayfair',
]);

const LOCAL_MARKETPLACES = MARKETPLACES.filter((m) => US_MARKETPLACE_IDS.has(m.id));
const GLOBAL_MARKETPLACES = MARKETPLACES.filter((m) => !US_MARKETPLACE_IDS.has(m.id));

export default function HomeScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<'new' | 'used'>('new');
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [isAddingPhotos, setIsAddingPhotos] = useState(false);

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
      setGalleryImages([result.assets[0].uri]);
      setDraftId(null);
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
      setGalleryImages([result.assets[0].uri]);
      setDraftId(null);
      analyzeImage(result.assets[0].base64 || '');
    }
  };

  const ensureDraftId = async (): Promise<number> => {
    if (draftId != null) return draftId;
    const images = galleryImages.length > 0 ? galleryImages : image ? [image] : [];
    const id = await saveDraftSnapshotMobile({
      draftId,
      title: title || 'Untitled draft',
      images,
      attributes: {
        capturedImage: images[0] ?? '',
        capturedImages: images,
        aiDescription: description,
        recommendedPrice: parseFloat(price) || 0,
      },
    });
    setDraftId(id);
    return id;
  };

  const analyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    try {
      const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
      const response = await fetch(`${API_BASE_URL}/api/products/analyze-base64`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Timezone': deviceTz,
        },
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

  const addMorePhotos = async () => {
    const remaining = MAX_DRAFT_IMAGES - galleryImages.length;
    if (remaining <= 0) {
      Alert.alert('Photo limit', `Maximum ${MAX_DRAFT_IMAGES} photos per listing.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Photo library access is needed to add images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: Math.min(5, remaining),
      quality: 0.85,
    });

    if (result.canceled || !result.assets.length) return;

    const previousImages = galleryImages;
    setIsAddingPhotos(true);
    try {
      const id = await ensureDraftId();
      const uploadedUrls = await uploadDraftPhotosMobile(id, result.assets);
      const addResult = await addPhotosToDraftMobile(id, uploadedUrls);
      const nextImages = draftImagesFromRecord(addResult.draft);
      setGalleryImages(nextImages);
      if (nextImages[0]) {
        setImage(nextImages[0]);
      }
    } catch (error) {
      setGalleryImages(previousImages);
      Alert.alert(
        'Add photos failed',
        error instanceof Error ? error.message : 'Could not add photos'
      );
    } finally {
      setIsAddingPhotos(false);
    }
  };

  const resetListingForm = () => {
    setImage(null);
    setGalleryImages([]);
    setDraftId(null);
    setTitle('');
    setDescription('');
    setPrice('');
    setSelectedMarketplaces([]);
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
    const results: string[] = [];
    const errors: string[] = [];

    try {
      for (const marketplace of selectedMarketplaces) {
        if (MOBILE_PUBLISH_PLATFORMS.has(marketplace)) {
          const connected = await hasPlatformTokens(marketplace);
          if (!connected) {
            errors.push(`${marketplace}: not connected — open Connections tab`);
            continue;
          }
          const result = await publishListing(marketplace, {
            title,
            description,
            price: parseFloat(price),
            sku: `kauf-${Date.now()}`,
          });
          if (result.success) {
            results.push(`${marketplace}: ${result.message}${result.listingUrl ? ` (${result.listingUrl})` : ''}`);
          } else {
            errors.push(`${marketplace}: ${result.message}`);
          }
        } else {
          errors.push(`${marketplace}: publish from web app or connect via mobile-supported platforms only`);
        }
      }

      if (results.length > 0) {
        Alert.alert(
          errors.length ? 'Partial success' : 'Success',
          [...results, ...errors].join('\n\n')
        );
        if (errors.length === 0) {
          resetListingForm();
        }
      } else {
        Alert.alert('Publish failed', errors.join('\n\n'));
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to publish');
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
                onPress={resetListingForm}
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

          {galleryImages.length > 0 && (
            <View style={styles.gallerySection}>
              <View style={styles.galleryHeader}>
                <Text style={styles.galleryTitle}>Product Photos</Text>
                <Text style={styles.galleryCount}>
                  {galleryImages.length}/{MAX_DRAFT_IMAGES}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {galleryImages.map((uri, index) => (
                  <Image
                    key={`${uri}-${index}`}
                    source={{ uri }}
                    style={styles.galleryThumb}
                  />
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[
                  styles.addPhotosButton,
                  (galleryImages.length >= MAX_DRAFT_IMAGES || isAddingPhotos) &&
                    styles.addPhotosButtonDisabled,
                ]}
                onPress={addMorePhotos}
                disabled={galleryImages.length >= MAX_DRAFT_IMAGES || isAddingPhotos}
              >
                {isAddingPhotos ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={18} color="#ffffff" />
                    <Text style={styles.addPhotosButtonText}>Add Photos</Text>
                  </>
                )}
              </TouchableOpacity>
              {galleryImages.length >= MAX_DRAFT_IMAGES && (
                <Text style={styles.galleryLimitText}>
                  Maximum {MAX_DRAFT_IMAGES} photos reached.
                </Text>
              )}
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

          <Text style={styles.label}>Your Price (USD)</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            placeholderTextColor="#6b7280"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Condition</Text>
          <View style={styles.conditionContainer}>
            <TouchableOpacity
              style={[
                styles.conditionButton,
                condition === 'new' && styles.conditionButtonActive,
              ]}
              onPress={() => setCondition('new')}
            >
              <Text
                style={[
                  styles.conditionText,
                  condition === 'new' && styles.conditionTextActive,
                ]}
              >
                New
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.conditionButton,
                condition === 'used' && styles.conditionButtonActive,
              ]}
              onPress={() => setCondition('used')}
            >
              <Text
                style={[
                  styles.conditionText,
                  condition === 'used' && styles.conditionTextActive,
                ]}
              >
                Used
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Local Marketplaces</Text>
          <View style={styles.marketplaces}>
            {LOCAL_MARKETPLACES.map((marketplace) => {
              const isSelected = selectedMarketplaces.includes(marketplace.id);
              return (
                <TouchableOpacity
                  key={marketplace.id}
                  style={[
                    styles.marketplaceChip,
                    isSelected && { backgroundColor: marketplace.color, borderColor: marketplace.color },
                  ]}
                  onPress={() => toggleMarketplace(marketplace.id)}
                >
                  <Ionicons
                    name={marketplace.icon as any}
                    size={16}
                    color={isSelected ? '#ffffff' : '#9ca3af'}
                  />
                  <Text
                    style={[
                      styles.marketplaceText,
                      isSelected && styles.marketplaceTextSelected,
                    ]}
                  >
                    {marketplace.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Global Marketplaces</Text>
          <View style={styles.marketplaces}>
            {GLOBAL_MARKETPLACES.map((marketplace) => {
              const isSelected = selectedMarketplaces.includes(marketplace.id);
              return (
                <TouchableOpacity
                  key={marketplace.id}
                  style={[
                    styles.marketplaceChip,
                    isSelected && { backgroundColor: marketplace.color, borderColor: marketplace.color },
                  ]}
                  onPress={() => toggleMarketplace(marketplace.id)}
                >
                  <Ionicons
                    name={marketplace.icon as any}
                    size={16}
                    color={isSelected ? '#ffffff' : '#9ca3af'}
                  />
                  <Text
                    style={[
                      styles.marketplaceText,
                      isSelected && styles.marketplaceTextSelected,
                    ]}
                  >
                    {marketplace.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
  gallerySection: {
    marginTop: 12,
    gap: 8,
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  galleryTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  galleryCount: {
    color: '#9ca3af',
    fontSize: 12,
  },
  galleryThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#1f2937',
  },
  addPhotosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#374151',
    paddingVertical: 10,
    borderRadius: 8,
  },
  addPhotosButtonDisabled: {
    opacity: 0.5,
  },
  addPhotosButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  galleryLimitText: {
    color: '#fbbf24',
    fontSize: 12,
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
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
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
  conditionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  conditionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#374151',
    backgroundColor: '#1f2937',
    alignItems: 'center',
  },
  conditionButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
  },
  conditionText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
  },
  conditionTextActive: {
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

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import type { HomeStackParamList } from '../types/identify';
import {
  DEFAULT_IDENTIFY_MARKETPLACES,
  mapIdentifyResponseToEditPayload,
  postIdentify,
} from '../services/identifyApi';
import { getAutoTranslateEnabled } from '../services/translationPrefs';

type NavigationProp = StackNavigationProp<HomeStackParamList, 'Identify'>;

type SelectedImage = {
  uri: string;
  mimeType: string;
  fileName: string;
};

export default function IdentifyScreen() {
  const navigation = useNavigation<NavigationProp>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const setImageFromAsset = (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.uri) {
      Alert.alert('Image error', 'Could not read the selected photo. Please try again.');
      return;
    }
    setSelectedImage({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileName: asset.fileName ?? `product-${Date.now()}.jpg`,
    });
    setStatusMessage(null);
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Camera permission required',
          'Enable camera access in Settings to take product photos.'
        );
        return;
      }
    }
    setShowCamera(true);
  };

  const capturePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (!photo?.uri) {
        Alert.alert('Capture failed', 'No image was captured. Please try again.');
        return;
      }
      setSelectedImage({
        uri: photo.uri,
        mimeType: 'image/jpeg',
        fileName: `capture-${Date.now()}.jpg`,
      });
      setShowCamera(false);
      setStatusMessage(null);
    } catch {
      Alert.alert('Capture failed', 'Something went wrong while taking the photo.');
    }
  };

  const pickFromGallery = async () => {
    const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libraryPermission.granted) {
      Alert.alert(
        'Photo library permission required',
        'Allow photo library access to choose a product image.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;
    setImageFromAsset(result.assets[0]);
  };

  const runIdentify = async () => {
    if (!selectedImage) {
      Alert.alert('No image', 'Take a photo or pick one from your gallery first.');
      return;
    }

    setIsIdentifying(true);
    setStatusMessage('Analyzing product with AI — this may take up to a minute…');

    try {
      const autoTranslate = await getAutoTranslateEnabled();
      const response = await postIdentify(selectedImage, {
        autoTranslate,
        marketplaces: DEFAULT_IDENTIFY_MARKETPLACES,
      });

      const payload = mapIdentifyResponseToEditPayload(response);

      if (!payload.title && !payload.brand) {
        throw new Error('The server did not return enough product details. Please try another photo.');
      }

      navigation.navigate('Edit', { result: payload });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Identification failed. Check your network and try again.';
      setStatusMessage(null);
      Alert.alert('Identification failed', message);
    } finally {
      setIsIdentifying(false);
    }
  };

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <SafeAreaView style={styles.cameraOverlay} edges={['top', 'bottom']}>
            <TouchableOpacity
              style={styles.cameraCloseButton}
              onPress={() => setShowCamera(false)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={styles.cameraBottomBar}>
              <TouchableOpacity style={styles.shutterButton} onPress={() => void capturePhoto()}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Capture or choose a product photo, then identify it with Kauf26 AI. Results open on the
          edit screen for review before listing.
        </Text>

        <View style={styles.previewCard}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Ionicons name="image-outline" size={48} color="#4b5563" />
              <Text style={styles.previewPlaceholderText}>No image selected</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void openCamera()}>
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.secondaryButtonText}>Open camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void pickFromGallery()}>
            <Ionicons name="images" size={20} color="#fff" />
            <Text style={styles.secondaryButtonText}>Pick from gallery</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, (!selectedImage || isIdentifying) && styles.buttonDisabled]}
          onPress={() => void runIdentify()}
          disabled={!selectedImage || isIdentifying}
        >
          {isIdentifying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="scan" size={20} color="#fff" />
          )}
          <Text style={styles.primaryButtonText}>
            {isIdentifying ? 'Identifying…' : 'Identify product'}
          </Text>
        </TouchableOpacity>

        {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

        <Text style={styles.hint}>
          Sends to {DEFAULT_IDENTIFY_MARKETPLACES.join(', ')} marketplace context. Auto-translate
          follows your Settings preference.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16, paddingBottom: 32 },
  subtitle: { color: '#9ca3af', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  previewCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
    marginBottom: 16,
    minHeight: 240,
  },
  previewImage: { width: '100%', height: 280 },
  previewPlaceholder: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewPlaceholderText: { color: '#6b7280', fontSize: 14 },
  buttonRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  secondaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 16,
    marginBottom: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
  statusText: { color: '#93c5fd', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  hint: { color: '#6b7280', fontSize: 12, lineHeight: 18, marginTop: 8 },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'space-between' },
  cameraCloseButton: {
    alignSelf: 'flex-start',
    margin: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 24,
    padding: 8,
  },
  cameraBottomBar: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
});

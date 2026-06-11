import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { StackScreenProps } from '@react-navigation/stack';
import type { HomeStackParamList, IdentifyTranslation } from '../types/identify';

type Props = StackScreenProps<HomeStackParamList, 'Edit'>;

function hasTranslationContent(translation: IdentifyTranslation | null): boolean {
  if (!translation) return false;
  return Boolean(
    translation.applied ||
      translation.originalTitle ||
      translation.translatedTitle ||
      translation.originalDescription ||
      translation.translatedDescription
  );
}

function TranslationPair({
  label,
  original,
  translated,
  targetLang,
}: {
  label: string;
  original?: string;
  translated?: string | null;
  targetLang?: string | null;
}) {
  if (!original && !translated) return null;

  return (
    <View style={styles.translationBlock}>
      <Text style={styles.translationLabel}>
        {label}
        {targetLang ? ` (${targetLang})` : ''}
      </Text>
      <View style={styles.translationRow}>
        <View style={styles.translationColumn}>
          <Text style={styles.translationColumnHeader}>Original</Text>
          <Text style={styles.translationText}>{original || '—'}</Text>
        </View>
        <View style={styles.translationDivider} />
        <View style={styles.translationColumn}>
          <Text style={styles.translationColumnHeader}>Translated</Text>
          <Text style={styles.translationText}>{translated || '—'}</Text>
        </View>
      </View>
    </View>
  );
}

export default function EditScreen({ route, navigation }: Props) {
  const { result } = route.params;
  const [title, setTitle] = useState(result.title);
  const [brand, setBrand] = useState(result.brand);
  const [price, setPrice] = useState(result.price);
  const [description, setDescription] = useState(result.description);

  const previewUri = result.capturedImage ?? result.capturedImages[0] ?? null;
  const translation = result.translation;
  const showTranslation = hasTranslationContent(translation);

  const finalListing = useMemo(
    () => ({
      title: title.trim(),
      brand: brand.trim(),
      price: price.trim(),
      description: description.trim(),
      requiresManualReview: result.requiresManualReview,
      priceReliable: result.priceReliable,
      isExactMatch: result.isExactMatch,
      matchType: result.matchType,
      translation,
      capturedImage: previewUri,
    }),
    [
      title,
      brand,
      price,
      description,
      result.requiresManualReview,
      result.priceReliable,
      result.isExactMatch,
      result.matchType,
      translation,
      previewUri,
    ]
  );

  const handlePostToMarketplace = () => {
    console.log('[EditScreen] Post to Marketplace (placeholder):', finalListing);
  };

  const handleRetakePhoto = () => {
    navigation.navigate('Identify');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {result.requiresManualReview ? (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={20} color="#fbbf24" />
            <View style={styles.warningTextWrap}>
              <Text style={styles.warningTitle}>Manual review required</Text>
              <Text style={styles.warningText}>
                Verify the brand, title, and price before posting to a marketplace.
              </Text>
            </View>
          </View>
        ) : null}

        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
        ) : null}

        <Text style={styles.sectionTitle}>Edit listing</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Product title"
          placeholderTextColor="#6b7280"
        />

        <Text style={styles.label}>Brand</Text>
        <TextInput
          style={styles.input}
          value={brand}
          onChangeText={setBrand}
          placeholder="Brand name"
          placeholderTextColor="#6b7280"
        />

        <Text style={styles.label}>Price (USD)</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          placeholder={
            result.priceReliable ? '0.00' : 'Estimated — verify before posting'
          }
          placeholderTextColor="#6b7280"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          placeholder="Listing description"
          placeholderTextColor="#6b7280"
        />

        {showTranslation ? (
          <View style={styles.translationCard}>
            <Text style={styles.translationCardTitle}>Translation</Text>
            <TranslationPair
              label="Title"
              original={translation?.originalTitle}
              translated={translation?.translatedTitle}
              targetLang={translation?.targetLang}
            />
            <TranslationPair
              label="Description"
              original={translation?.originalDescription}
              translated={translation?.translatedDescription}
              targetLang={translation?.targetLang}
            />
          </View>
        ) : null}

        <TouchableOpacity style={styles.primaryButton} onPress={handlePostToMarketplace}>
          <Ionicons name="storefront-outline" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>Post to Marketplace</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleRetakePhoto}>
          <Ionicons name="camera-outline" size={20} color="#fff" />
          <Text style={styles.secondaryButtonText}>Retake photo</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16, paddingBottom: 32 },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(180, 83, 9, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.5)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  warningTextWrap: { flex: 1 },
  warningTitle: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  warningText: { color: '#fcd34d', fontSize: 13, lineHeight: 18 },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#111827',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  label: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
  },
  textArea: { minHeight: 120 },
  translationCard: {
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 12,
    marginTop: 20,
    gap: 12,
  },
  translationCardTitle: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '700',
  },
  translationBlock: { gap: 8 },
  translationLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  translationRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  translationColumn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  translationDivider: {
    width: 1,
    backgroundColor: '#374151',
  },
  translationColumnHeader: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  translationText: {
    color: '#e5e7eb',
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 16,
    marginTop: 24,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 10,
  },
  secondaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

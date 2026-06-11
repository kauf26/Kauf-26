import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { StackScreenProps } from '@react-navigation/stack';
import type { HomeStackParamList, IdentifyTranslation } from '../types/identify';
import { IdentifyTheme as T } from '../theme/identifyTheme';

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

function formatPriceDisplay(value: string): string {
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return 'Price not found';
  return `$${n.toFixed(2)}`;
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
  const [category, setCategory] = useState(result.category);
  const [condition, setCondition] = useState(result.condition);
  const [model, setModel] = useState(result.model);
  const [material, setMaterial] = useState(result.material);
  const [color, setColor] = useState(result.color);

  const previewUri = result.capturedImage ?? result.capturedImages[0] ?? null;
  const translation = result.translation;
  const showTranslation = hasTranslationContent(translation);
  const verificationMessage = result.verificationMessage?.trim() || null;

  const priceHint = !result.priceReliable
    ? 'Price estimate unavailable – set manually'
    : !price.trim() || parseFloat(price) <= 0
      ? 'Price not available — set manually before posting.'
      : null;

  const finalListing = useMemo(
    () => ({
      title: title.trim(),
      brand: brand.trim(),
      price: price.trim(),
      description: description.trim(),
      category: category.trim(),
      condition: condition.trim(),
      model: model.trim(),
      material: material.trim(),
      color: color.trim(),
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
      category,
      condition,
      model,
      material,
      color,
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

  const renderMatchBanner = () => {
    if (result.matchType === 'exact' || result.isExactMatch) {
      return (
        <View style={styles.exactBanner}>
          <View style={styles.exactBadge}>
            <Text style={styles.exactBadgeText}>Exact Match Confirmed</Text>
          </View>
          <Text style={styles.exactText}>
            Listing data came from a validated marketplace match.
          </Text>
        </View>
      );
    }

    if (result.matchType === 'similar') {
      return (
        <View style={styles.similarBanner}>
          <Text style={styles.similarTitle}>
            Best match — similar product found; review before posting.
          </Text>
          <Text style={styles.similarSubtext}>
            Marketplace data is from a comparable listing, not an exact SKU match.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.reviewBanner}>
        <Ionicons name="warning" size={18} color={T.warningTitle} />
        <View style={styles.bannerTextWrap}>
          <Text style={styles.reviewTitle}>
            Here&apos;s our match, please review before publishing.
          </Text>
          <Text style={styles.reviewSubtext}>
            Confirm title, brand, price, category, and condition before posting.
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.draftCard}>
          {verificationMessage ? (
            <View style={styles.warningBanner}>
              <Ionicons name="alert-circle" size={18} color={T.warningTitle} />
              <Text style={styles.warningBannerText}>{verificationMessage}</Text>
            </View>
          ) : null}

          {result.requiresManualReview ? (
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={18} color={T.warningTitle} />
              <View style={styles.bannerTextWrap}>
                <Text style={styles.warningTitle}>Manual review required</Text>
                <Text style={styles.warningBannerText}>
                  Verify the brand, title, and price before posting to a marketplace.
                </Text>
              </View>
            </View>
          ) : null}

          {renderMatchBanner()}

          <View style={styles.summaryCard}>
            <Text style={styles.summaryHeading}>IDENTIFIED PRODUCT</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Title</Text>
              <Text style={styles.summaryValue}>{title || '—'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Brand</Text>
              <Text style={styles.summaryValue}>{brand || '—'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Price</Text>
              <Text style={styles.summaryValue}>{formatPriceDisplay(price)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Category</Text>
              <Text style={styles.summaryValue}>{category || 'Not available'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Condition</Text>
              <Text style={styles.summaryValue}>{condition || '—'}</Text>
            </View>
          </View>

          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
          ) : null}

          <View style={styles.draftHeader}>
            <Text style={styles.draftTitle}>Product Draft</Text>
            <Text style={styles.draftSubtitle}>
              Refine the automatically extracted product metadata specifications below.
            </Text>
          </View>

          <Text style={styles.fieldLabel}>Exact Match Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Product title"
            placeholderTextColor={T.textSubtle}
          />

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Brand</Text>
              <TextInput
                style={styles.input}
                value={brand}
                onChangeText={setBrand}
                placeholder="Brand name"
                placeholderTextColor={T.textSubtle}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Your Price (USD)</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder={
                  result.priceReliable ? '0.00' : 'Price estimate unavailable – set manually'
                }
                placeholderTextColor={T.textSubtle}
              />
              {priceHint ? <Text style={styles.priceHint}>{priceHint}</Text> : null}
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Model Number</Text>
              <TextInput
                style={styles.input}
                value={model}
                onChangeText={setModel}
                placeholder="Model / reference"
                placeholderTextColor={T.textSubtle}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Material Composition</Text>
              <TextInput
                style={styles.input}
                value={material}
                onChangeText={setMaterial}
                placeholder="e.g. ceramic, cotton"
                placeholderTextColor={T.textSubtle}
              />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Color</Text>
              <TextInput
                style={styles.input}
                value={color}
                onChangeText={setColor}
                placeholder="e.g. white and blue"
                placeholderTextColor={T.textSubtle}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Category Node</Text>
              <TextInput
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholder="e.g. Electronics"
                placeholderTextColor={T.textSubtle}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Item Condition</Text>
          <TextInput
            style={styles.input}
            value={condition}
            onChangeText={setCondition}
            placeholder="New, Like New, Used, Fair"
            placeholderTextColor={T.textSubtle}
          />

          <Text style={styles.fieldLabel}>Description</Text>
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>
              AI-generated description — verify accuracy before posting.
            </Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            placeholder="Listing description"
            placeholderTextColor={T.textSubtle}
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
            <Text style={styles.primaryButtonText}>Continue to Marketplaces & Post</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleRetakePhoto}>
            <Ionicons name="camera-outline" size={18} color={T.text} />
            <Text style={styles.secondaryButtonText}>Retake photo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: T.pageBg },
  pageContent: { padding: 16, paddingBottom: 32 },
  draftCard: {
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 12,
    padding: 16,
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: T.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: T.warningBg,
    borderWidth: 1,
    borderColor: T.warningBorder,
    borderRadius: 8,
    padding: 12,
  },
  warningTitle: {
    color: T.warningTitle,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  warningBannerText: { color: T.warningText, fontSize: 12, lineHeight: 17, flex: 1 },
  bannerTextWrap: { flex: 1 },
  exactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T.successBg,
    borderWidth: 1,
    borderColor: T.successBorder,
    borderRadius: 8,
    padding: 12,
    flexWrap: 'wrap',
  },
  exactBadge: {
    backgroundColor: T.emerald,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  exactBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  exactText: { color: T.successText, fontSize: 12, flex: 1 },
  similarBanner: {
    backgroundColor: T.similarBg,
    borderWidth: 1,
    borderColor: T.similarBorder,
    borderRadius: 8,
    padding: 12,
  },
  similarTitle: { color: T.similarText, fontSize: 13, fontWeight: '600' },
  similarSubtext: { color: T.similarText, fontSize: 11, marginTop: 4, opacity: 0.8 },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: T.warningBg,
    borderWidth: 1,
    borderColor: T.warningBorder,
    borderRadius: 8,
    padding: 12,
  },
  reviewTitle: { color: T.warningText, fontSize: 13, fontWeight: '600' },
  reviewSubtext: { color: T.warningText, fontSize: 11, marginTop: 4, opacity: 0.8 },
  summaryCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  summaryHeading: {
    color: T.textSubtle,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryRow: { gap: 2 },
  summaryLabel: { color: T.textSubtle, fontSize: 12 },
  summaryValue: { color: T.text, fontSize: 14, fontWeight: '600' },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  draftHeader: { gap: 4 },
  draftTitle: { color: T.text, fontSize: 22, fontWeight: '700' },
  draftSubtitle: { color: T.textSubtle, fontSize: 12 },
  fieldLabel: {
    color: T.label,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    marginTop: 4,
  },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldHalf: { flex: 1 },
  input: {
    backgroundColor: T.inputBg,
    borderWidth: 1,
    borderColor: T.inputBorder,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: T.inputText,
    fontSize: 14,
  },
  textArea: { minHeight: 110 },
  priceHint: { color: T.warningTitle, fontSize: 11, marginTop: 4 },
  disclaimerBox: {
    backgroundColor: T.warningBg,
    borderWidth: 1,
    borderColor: T.warningBorder,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
  },
  disclaimerText: { color: T.warningText, fontSize: 11 },
  translationCard: {
    backgroundColor: T.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.cardBorder,
    padding: 12,
    gap: 12,
  },
  translationCardTitle: {
    color: T.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  translationBlock: { gap: 8 },
  translationLabel: {
    color: T.textSubtle,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  translationRow: { flexDirection: 'row', gap: 8 },
  translationColumn: {
    flex: 1,
    backgroundColor: T.inputBg,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: T.inputBorder,
  },
  translationDivider: { width: 1, backgroundColor: T.surfaceBorder },
  translationColumnHeader: {
    color: T.textSubtle,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  translationText: { color: T.inputText, fontSize: 12, lineHeight: 17 },
  primaryButton: {
    backgroundColor: T.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: T.cardBorder,
    borderRadius: 8,
    paddingVertical: 12,
  },
  secondaryButtonText: { color: T.text, fontSize: 14, fontWeight: '600' },
});

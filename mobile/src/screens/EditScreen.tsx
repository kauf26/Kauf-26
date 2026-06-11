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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { StackScreenProps } from '@react-navigation/stack';
import type { HomeStackParamList, IdentifyTranslation } from '../types/identify';
import { IdentifyTheme as T } from '../theme/identifyTheme';
import { API_BASE_URL } from '../services/config';
import { saveDraftSnapshotMobile } from '../services/draftPhotos';

type Props = StackScreenProps<HomeStackParamList, 'Edit'>;

const PROHIBITED_KEYWORDS = ['gun', 'drugs', 'alcohol', 'tobacco', 'vape', 'weapon'];

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
  const [productUrl, setProductUrl] = useState(result.productUrl ?? '');
  const [allegroAverage, setAllegroAverage] = useState(result.allegroAverage ?? '');
  const [ebayAverage, setEbayAverage] = useState(result.ebayAverage ?? '');
  const [exactSearchTerm, setExactSearchTerm] = useState('');
  const [isRescraping, setIsRescraping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(result.draftId ?? null);

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

  const isProhibited = PROHIBITED_KEYWORDS.some(
    (kw) =>
      title.toLowerCase().includes(kw) || category.toLowerCase().includes(kw)
  );

  const buildDraftAttributes = (images: string[]) => ({
    capturedImage: images[0] ?? previewUri ?? '',
    capturedImages: images,
    modelName: title.trim(),
    brand: brand.trim(),
    condition: condition.trim(),
    category: category.trim(),
    aiDescription: description.trim(),
    recommendedPrice: parseFloat(price) || 0,
    medianPrice: price.trim(),
    allegroAvg: parseFloat(allegroAverage) || 0,
    ebayAvg: parseFloat(ebayAverage) || 0,
    marketPrices: {
      recommendedPrice: price.trim(),
      allegroAvg: allegroAverage.trim(),
      ebayAvg: ebayAverage.trim(),
    },
    productUrl: productUrl.trim(),
  });

  const handleRescrapeExact = async () => {
    const term = exactSearchTerm.trim();
    if (!term) {
      Alert.alert('Enter a search term', 'Type a product name or model to search.');
      return;
    }
    setIsRescraping(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/catalog/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: term,
          searchQuery: term,
          visionTitle: title || term,
          visionBrand: brand,
        }),
      });
      const data = (await res.json()) as Record<string, unknown> & { message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? `Search failed (${res.status})`);
      }
      if (typeof data.title === 'string' && data.title.trim()) setTitle(data.title.trim());
      if (typeof data.brand === 'string' && data.brand.trim()) setBrand(data.brand.trim());
      if (typeof data.description === 'string' && data.description.trim()) {
        setDescription(data.description.trim());
      }
      if (data.price != null) setPrice(String(data.price));
      if (typeof data.category === 'string' && data.category.trim()) {
        setCategory(data.category.trim());
      }
      if (typeof data.productUrl === 'string') setProductUrl(data.productUrl.trim());
      if (data.allegroAvg != null) setAllegroAverage(String(data.allegroAvg));
      if (data.ebayAvg != null) setEbayAverage(String(data.ebayAvg));
    } catch (err) {
      Alert.alert(
        'Search failed',
        err instanceof Error ? err.message : 'Could not refresh listing data.'
      );
    } finally {
      setIsRescraping(false);
    }
  };

  const handlePostToMarketplace = async () => {
    if (isProhibited) return;

    setIsSaving(true);
    try {
      const images = result.capturedImages.length
        ? result.capturedImages
        : previewUri
          ? [previewUri]
          : [];

      const savedDraftId = await saveDraftSnapshotMobile({
        draftId,
        title: title.trim() || 'Untitled draft',
        images,
        attributes: buildDraftAttributes(images),
      });
      setDraftId(savedDraftId);

      navigation.navigate('SelectMarketplaces', {
        draftId: savedDraftId,
        listing: {
          title: title.trim(),
          description: description.trim(),
          price: price.trim(),
          brand: brand.trim(),
          category: category.trim(),
          condition: condition.trim(),
          material: material.trim(),
          color: color.trim(),
          model: model.trim(),
          productUrl: productUrl.trim(),
          capturedImage: previewUri,
          capturedImages: images,
          priceReliable: result.priceReliable,
          isExactMatch: result.isExactMatch,
          matchType: result.matchType,
        },
      });
    } catch (err) {
      Alert.alert(
        'Could not save draft',
        err instanceof Error ? err.message : 'Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
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
      <View style={styles.centeredContainer}>
        <ScrollView
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentColumn}>
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

          <View style={styles.valuationCard}>
            <Text style={styles.valuationTitle}>Scraped Valuations</Text>
            <View style={styles.valuationRow}>
              <Text style={styles.valuationLabel}>eBay Market Avg:</Text>
              <Text style={styles.valuationValue}>{ebayAverage || '—'}</Text>
            </View>
            <View style={styles.valuationRow}>
              <Text style={styles.valuationLabel}>Allegro Market Avg:</Text>
              <Text style={styles.valuationValue}>{allegroAverage || '—'}</Text>
            </View>
          </View>

          <View style={styles.rescrapeCard}>
            <Text style={styles.fieldLabel}>Exact match search</Text>
            <TextInput
              style={styles.input}
              value={exactSearchTerm}
              onChangeText={setExactSearchTerm}
              placeholder="Search term for exact marketplace match"
              placeholderTextColor={T.textSubtle}
            />
            <TouchableOpacity
              style={[styles.rescrapeButton, isRescraping && styles.buttonDisabled]}
              onPress={() => void handleRescrapeExact()}
              disabled={isRescraping}
            >
              {isRescraping ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.rescrapeButtonText}>Refresh from marketplace search</Text>
              )}
            </TouchableOpacity>
          </View>

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

          {isProhibited ? (
            <View style={styles.prohibitedBanner}>
              <Text style={styles.prohibitedText}>
                PROHIBITED KEYWORD DETECTED — UNABLE TO SYNDICATE LISTING
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
              onPress={() => void handlePostToMarketplace()}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue to Marketplaces & Post</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.secondaryButton} onPress={handleRetakePhoto}>
            <Ionicons name="camera-outline" size={18} color={T.text} />
            <Text style={styles.secondaryButtonText}>Retake photo</Text>
          </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: T.pageBg },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    width: '100%',
  },
  contentColumn: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
  },
  draftCard: {
    width: '100%',
    alignItems: 'center',
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
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
  },
  warningBannerText: {
    color: T.warningText,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
    textAlign: 'center',
  },
  bannerTextWrap: { flex: 1, alignItems: 'center' },
  exactBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  exactText: { color: T.successText, fontSize: 12, flex: 1, textAlign: 'center' },
  similarBanner: {
    width: '100%',
    backgroundColor: T.similarBg,
    borderWidth: 1,
    borderColor: T.similarBorder,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  similarTitle: { color: T.similarText, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  similarSubtext: { color: T.similarText, fontSize: 11, opacity: 0.8, textAlign: 'center' },
  reviewBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: T.warningBg,
    borderWidth: 1,
    borderColor: T.warningBorder,
    borderRadius: 8,
    padding: 12,
  },
  reviewTitle: { color: T.warningText, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  reviewSubtext: { color: T.warningText, fontSize: 11, opacity: 0.8, textAlign: 'center' },
  summaryCard: {
    width: '100%',
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 8,
    padding: 12,
    gap: 8,
    alignItems: 'center',
  },
  summaryHeading: {
    color: T.textSubtle,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    width: '100%',
  },
  summaryRow: { gap: 2, alignItems: 'center', width: '100%' },
  summaryLabel: { color: T.textSubtle, fontSize: 12, textAlign: 'center' },
  summaryValue: { color: T.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  draftHeader: { width: '100%', gap: 4, alignItems: 'center' },
  draftTitle: { color: T.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  draftSubtitle: { color: T.textSubtle, fontSize: 12, textAlign: 'center' },
  fieldLabel: {
    color: T.label,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
  },
  fieldRow: { width: '100%', flexDirection: 'row', gap: 10 },
  fieldHalf: { flex: 1, alignItems: 'center' },
  input: {
    width: '100%',
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
  priceHint: { color: T.warningTitle, fontSize: 11, textAlign: 'center', width: '100%' },
  disclaimerBox: {
    width: '100%',
    backgroundColor: T.warningBg,
    borderWidth: 1,
    borderColor: T.warningBorder,
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  disclaimerText: { color: T.warningText, fontSize: 11, textAlign: 'center' },
  translationCard: {
    width: '100%',
    backgroundColor: T.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.cardBorder,
    padding: 12,
    gap: 12,
    alignItems: 'center',
  },
  translationCardTitle: {
    color: T.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  translationBlock: { width: '100%', gap: 8, alignItems: 'center' },
  translationLabel: {
    color: T.textSubtle,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
    width: '100%',
  },
  translationRow: { width: '100%', flexDirection: 'row', gap: 8 },
  translationColumn: {
    flex: 1,
    backgroundColor: T.inputBg,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: T.inputBorder,
    alignItems: 'center',
  },
  translationDivider: { width: 1, backgroundColor: T.surfaceBorder },
  translationColumnHeader: {
    color: T.textSubtle,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '100%',
  },
  translationText: { color: T.inputText, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  valuationCard: {
    width: '100%',
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.surfaceBorder,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  valuationTitle: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  valuationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valuationLabel: { color: T.textSubtle, fontSize: 13 },
  valuationValue: { color: T.inputText, fontSize: 13, fontWeight: '600' },
  rescrapeCard: {
    width: '100%',
    gap: 8,
  },
  rescrapeButton: {
    width: '100%',
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rescrapeButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  prohibitedBanner: {
    width: '100%',
    backgroundColor: 'rgba(127,29,29,0.35)',
    borderWidth: 1,
    borderColor: '#B91C1C',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  prohibitedText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButton: {
    width: '100%',
    backgroundColor: T.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  secondaryButton: {
    width: '100%',
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

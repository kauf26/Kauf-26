import React, { useState } from 'react';
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
import type { HomeStackParamList } from '../types/identify';

type Props = StackScreenProps<HomeStackParamList, 'Edit'>;

export default function EditScreen({ route, navigation }: Props) {
  const { result } = route.params;
  const [title, setTitle] = useState(result.title);
  const [brand, setBrand] = useState(result.brand);
  const [description, setDescription] = useState(result.description);
  const [price, setPrice] = useState(result.price);
  const [category, setCategory] = useState(result.category);
  const [condition, setCondition] = useState(result.condition);

  const previewUri = result.capturedImage ?? result.capturedImages[0] ?? null;
  const translation = result.translation;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {result.requiresManualReview ? (
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={18} color="#fbbf24" />
            <Text style={styles.warningText}>
              Manual review recommended — verify brand, title, and price before publishing.
            </Text>
          </View>
        ) : null}

        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
        ) : null}

        <Text style={styles.sectionTitle}>Listing details</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Brand</Text>
        <TextInput style={styles.input} value={brand} onChangeText={setBrand} />

        <Text style={styles.label}>Price (USD)</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          placeholder={result.priceReliable ? undefined : 'Estimated — verify manually'}
          placeholderTextColor="#6b7280"
        />

        <Text style={styles.label}>Category</Text>
        <TextInput style={styles.input} value={category} onChangeText={setCategory} />

        <Text style={styles.label}>Condition</Text>
        <TextInput style={styles.input} value={condition} onChangeText={setCondition} />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>Identification metadata</Text>
          <Text style={styles.metaLine}>Match: {result.matchType}</Text>
          <Text style={styles.metaLine}>
            Exact match: {result.isExactMatch ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.metaLine}>
            Price reliable: {result.priceReliable ? 'Yes' : 'No'}
          </Text>
        </View>

        {translation?.applied ? (
          <View style={styles.metaCard}>
            <Text style={styles.metaTitle}>
              Translation ({translation.targetLang ?? 'unknown'})
            </Text>
            {translation.originalTitle ? (
              <Text style={styles.metaLine}>Original title: {translation.originalTitle}</Text>
            ) : null}
            {translation.translatedTitle ? (
              <Text style={styles.metaLine}>Translated title: {translation.translatedTitle}</Text>
            ) : null}
            {translation.translatedDescription ? (
              <Text style={styles.metaLine}>
                Translated description: {translation.translatedDescription}
              </Text>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Text style={styles.backButtonText}>Identify another product</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16, paddingBottom: 32 },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(180, 83, 9, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.45)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: { flex: 1, color: '#fcd34d', fontSize: 13, lineHeight: 18 },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#111827',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  label: { color: '#9ca3af', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 8 },
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
  metaCard: {
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 12,
    marginTop: 16,
    gap: 4,
  },
  metaTitle: { color: '#d1d5db', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  metaLine: { color: '#9ca3af', fontSize: 12, lineHeight: 18 },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#1f2937',
  },
  backButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

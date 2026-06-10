import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import {
  DEFAULT_FROM_ADDRESS,
  fetchShippingRates,
  generateShippingLabel,
  markShippingLabelCreated,
  parseBuyerAddress,
  type MobileSale,
  type ShippingAddress,
  type ShippingRate,
} from '../services/shipping';

type Props = {
  sale: MobileSale;
  onClose: () => void;
  onComplete: () => void;
};

export default function ShippingLabelScreen({ sale, onClose, onComplete }: Props) {
  const [fromAddress] = useState<ShippingAddress>(DEFAULT_FROM_ADDRESS);
  const [toAddress, setToAddress] = useState<ShippingAddress>(() =>
    parseBuyerAddress(sale.buyerInfo)
  );
  const [weightLbs, setWeightLbs] = useState('1');
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setToAddress(parseBuyerAddress(sale.buyerInfo));
  }, [sale.id, sale.buyerInfo]);

  const handleGetRates = async () => {
    setLoadingRates(true);
    try {
      const next = await fetchShippingRates(parseFloat(weightLbs) || 1);
      setRates(next);
      if (next[0]) setSelectedService(next[0].service);
    } catch (error) {
      Alert.alert('Rates failed', error instanceof Error ? error.message : 'Try again');
    } finally {
      setLoadingRates(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedService) {
      Alert.alert('Select a service', 'Get rates and choose a shipping option.');
      return;
    }
    setGenerating(true);
    try {
      const result = await generateShippingLabel({
        saleId: sale.id,
        fromAddress,
        toAddress,
        packageDetails: {
          weightLbs: parseFloat(weightLbs) || 1,
          lengthIn: 10,
          widthIn: 10,
          heightIn: 10,
        },
        service: selectedService,
      });
      await markShippingLabelCreated(sale.id);
      setLabelUrl(result.labelPdfUrl);
      setTrackingNumber(result.trackingNumber);
      Alert.alert('Label ready', `Tracking ${result.trackingNumber}`);
      onComplete();
    } catch (error) {
      Alert.alert('Label failed', error instanceof Error ? error.message : 'Try again');
    } finally {
      setGenerating(false);
    }
  };

  const updateTo = (key: keyof ShippingAddress, value: string) => {
    setToAddress((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Shipping Label</Text>
        <Text style={styles.subtitle}>
          {sale.productTitle ?? `Sale #${sale.id}`}
        </Text>

        <Text style={styles.sectionLabel}>Ship to</Text>
        <TextInput style={styles.input} placeholder="Name" value={toAddress.name ?? ''} onChangeText={(v) => updateTo('name', v)} placeholderTextColor="#6b7280" />
        <TextInput style={styles.input} placeholder="Address" value={toAddress.line1 ?? ''} onChangeText={(v) => updateTo('line1', v)} placeholderTextColor="#6b7280" />
        <TextInput style={styles.input} placeholder="City" value={toAddress.city ?? ''} onChangeText={(v) => updateTo('city', v)} placeholderTextColor="#6b7280" />
        <TextInput style={styles.input} placeholder="State" value={toAddress.state ?? ''} onChangeText={(v) => updateTo('state', v)} placeholderTextColor="#6b7280" />
        <TextInput style={styles.input} placeholder="ZIP" value={toAddress.postalCode ?? ''} onChangeText={(v) => updateTo('postalCode', v)} placeholderTextColor="#6b7280" />

        <Text style={styles.sectionLabel}>Weight (lb)</Text>
        <TextInput style={styles.input} value={weightLbs} onChangeText={setWeightLbs} keyboardType="decimal-pad" placeholderTextColor="#6b7280" />

        <TouchableOpacity style={styles.secondaryButton} onPress={handleGetRates} disabled={loadingRates}>
          {loadingRates ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Get Rates</Text>}
        </TouchableOpacity>

        {rates.map((rate) => (
          <TouchableOpacity
            key={`${rate.carrier}-${rate.service}`}
            style={[styles.rateRow, selectedService === rate.service && styles.rateRowSelected]}
            onPress={() => setSelectedService(rate.service)}
          >
            <Text style={styles.rateText}>{rate.carrier} — {rate.service}</Text>
            <Text style={styles.ratePrice}>${rate.price.toFixed(2)}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.primaryButton} onPress={handleGenerate} disabled={generating}>
          {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Buy & Print Label</Text>}
        </TouchableOpacity>

        {labelUrl && (
          <TouchableOpacity style={styles.primaryButton} onPress={() => void Linking.openURL(labelUrl)}>
            <Text style={styles.buttonText}>Download PDF</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16, gap: 10 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#9ca3af', marginBottom: 8 },
  sectionLabel: { color: '#fff', fontWeight: '600', marginTop: 8 },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: '#374151',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
  },
  rateRowSelected: { borderColor: '#3b82f6' },
  rateText: { color: '#fff', flex: 1 },
  ratePrice: { color: '#93c5fd', fontWeight: '700' },
});

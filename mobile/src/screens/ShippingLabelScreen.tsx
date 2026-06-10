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
  formatRateLabel,
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
  const [weightOz, setWeightOz] = useState('0');
  const [lengthIn, setLengthIn] = useState('10');
  const [widthIn, setWidthIn] = useState('10');
  const [heightIn, setHeightIn] = useState('10');
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [shipDateLabel, setShipDateLabel] = useState<string | null>(null);
  const [isInternational, setIsInternational] = useState(false);
  const [selectedRateId, setSelectedRateId] = useState('');
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
      const result = await fetchShippingRates({
        fromAddress,
        toAddress,
        packageDetails: {
          weightLbs: parseFloat(weightLbs) || 1,
          weightOz: parseFloat(weightOz) || 0,
          lengthIn: parseFloat(lengthIn) || 10,
          widthIn: parseFloat(widthIn) || 10,
          heightIn: parseFloat(heightIn) || 10,
        },
      });
      setRates(result.rates);
      setShipDateLabel(result.shipDateLabel ?? null);
      setIsInternational(result.isInternational);
      if (result.rates[0]) {
        setSelectedRateId(result.rates[0].rateId);
        setSelectedService(result.rates[0].service);
      }
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
          lengthIn: parseFloat(lengthIn) || 10,
          widthIn: parseFloat(widthIn) || 10,
          heightIn: parseFloat(heightIn) || 10,
        },
        service: selectedService || rates.find((r) => r.rateId === selectedRateId)?.service || '',
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

        <Text style={styles.sectionLabel}>Weight</Text>
        <View style={styles.weightRow}>
          <TextInput style={[styles.input, styles.weightInput]} value={weightLbs} onChangeText={setWeightLbs} keyboardType="decimal-pad" placeholder="lb" placeholderTextColor="#6b7280" />
          <TextInput style={[styles.input, styles.weightInput]} value={weightOz} onChangeText={setWeightOz} keyboardType="decimal-pad" placeholder="oz" placeholderTextColor="#6b7280" />
        </View>

        <Text style={styles.sectionLabel}>Dimensions (in)</Text>
        <View style={styles.weightRow}>
          <TextInput style={[styles.input, styles.weightInput]} value={lengthIn} onChangeText={setLengthIn} keyboardType="decimal-pad" placeholder="L" placeholderTextColor="#6b7280" />
          <TextInput style={[styles.input, styles.weightInput]} value={widthIn} onChangeText={setWidthIn} keyboardType="decimal-pad" placeholder="W" placeholderTextColor="#6b7280" />
          <TextInput style={[styles.input, styles.weightInput]} value={heightIn} onChangeText={setHeightIn} keyboardType="decimal-pad" placeholder="H" placeholderTextColor="#6b7280" />
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleGetRates} disabled={loadingRates}>
          {loadingRates ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Get Rates</Text>}
        </TouchableOpacity>

        {shipDateLabel ? (
          <Text style={styles.shipDateNote}>{shipDateLabel}</Text>
        ) : null}
        <Text style={styles.deliveryDisclaimer}>
          Delivery time estimates are based on carrier data and may vary.
          {isInternational ? ' Customs clearance may add time.' : ''}
        </Text>

        {rates.map((rate) => (
          <TouchableOpacity
            key={rate.rateId}
            style={[styles.rateRow, selectedRateId === rate.rateId && styles.rateRowSelected]}
            onPress={() => {
              setSelectedRateId(rate.rateId);
              setSelectedService(rate.service);
            }}
          >
            <Text style={styles.rateText}>
              {formatRateLabel(rate)}
              {rate.source === 'mock' ? ' est.' : ''}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.primaryButton} onPress={handleGenerate} disabled={generating}>
          {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Print Label</Text>}
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
  shipDateNote: { color: '#93c5fd', fontSize: 13, marginTop: 4 },
  deliveryDisclaimer: { color: '#6b7280', fontSize: 11, lineHeight: 16 },
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
  rateText: { color: '#fff', flex: 1, fontSize: 14 },
  weightRow: { flexDirection: 'row', gap: 8 },
  weightInput: { flex: 1 },
});

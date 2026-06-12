import React, { useEffect, useMemo, useState } from 'react';
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
  Modal,
  Share,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  DEFAULT_FROM_ADDRESS,
  emailShippingLabel,
  fetchShippingRates,
  formatRateLabel,
  generateShippingLabel,
  getPrintLabelBlockReason,
  getShippingToPackageBlockReason,
  loadStoredShipFromAddress,
  markShippingLabelCreated,
  mergeShipFromAddress,
  parseBuyerAddress,
  saveStoredShipFromAddress,
  type MobileSale,
  type ShippingAddress,
  type ShippingRate,
} from '../services/shipping';
import { printShippingLabelPdfUri } from '../services/labelPrint';
import {
  formatAddressBlock,
  formatCarrierService,
} from '../../../shared/shippingLabelTemplate';

type Props = {
  sale: MobileSale;
  onClose: () => void;
  onComplete: () => void;
};

function AddressFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: ShippingAddress;
  onChange: (next: ShippingAddress) => void;
}) {
  const set = (key: keyof ShippingAddress, v: string) =>
    onChange({ ...value, [key]: v });

  return (
    <>
      <Text style={styles.sectionLabel}>{title}</Text>
      <TextInput
        style={styles.input}
        placeholder="Full name"
        value={value.name ?? ''}
        onChangeText={(v) => set('name', v)}
        placeholderTextColor="#6b7280"
      />
      <TextInput
        style={styles.input}
        placeholder="Street address"
        value={value.line1 ?? ''}
        onChangeText={(v) => set('line1', v)}
        placeholderTextColor="#6b7280"
      />
      <TextInput
        style={styles.input}
        placeholder="Address line 2 (optional)"
        value={value.line2 ?? ''}
        onChangeText={(v) => set('line2', v)}
        placeholderTextColor="#6b7280"
      />
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.flex1]}
          placeholder="City"
          value={value.city ?? ''}
          onChangeText={(v) => set('city', v)}
          placeholderTextColor="#6b7280"
        />
        <TextInput
          style={[styles.input, styles.stateInput]}
          placeholder="State"
          value={value.state ?? ''}
          onChangeText={(v) => set('state', v)}
          placeholderTextColor="#6b7280"
          autoCapitalize="characters"
        />
      </View>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.flex1]}
          placeholder="ZIP"
          value={value.postalCode ?? ''}
          onChangeText={(v) => set('postalCode', v)}
          placeholderTextColor="#6b7280"
        />
        <TextInput
          style={[styles.input, styles.stateInput]}
          placeholder="Country"
          value={value.country ?? 'US'}
          onChangeText={(v) => set('country', v)}
          placeholderTextColor="#6b7280"
          autoCapitalize="characters"
        />
      </View>
    </>
  );
}

export default function ShippingLabelScreen({ sale, onClose, onComplete }: Props) {
  const [fromAddress, setFromAddress] = useState<ShippingAddress>(DEFAULT_FROM_ADDRESS);
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
  const [labelCarrier, setLabelCarrier] = useState<string | null>(null);
  const [labelServiceName, setLabelServiceName] = useState<string | null>(null);
  const [labelEstimatedDelivery, setLabelEstimatedDelivery] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [loadingRates, setLoadingRates] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [pdfModalVisible, setPdfModalVisible] = useState(false);

  useEffect(() => {
    void loadStoredShipFromAddress().then(setFromAddress);
  }, []);

  useEffect(() => {
    setToAddress(parseBuyerAddress(sale.buyerInfo));
  }, [sale.id, sale.buyerInfo]);

  useEffect(() => {
    void saveStoredShipFromAddress(fromAddress);
  }, [fromAddress]);

  const resolvedFrom = useMemo(
    () => mergeShipFromAddress(fromAddress, DEFAULT_FROM_ADDRESS),
    [fromAddress]
  );

  const ratesBlockReason = useMemo(
    () =>
      getShippingToPackageBlockReason({
        toAddress,
        weightLbs,
        weightOz,
        lengthIn,
        widthIn,
        heightIn,
      }),
    [toAddress, weightLbs, weightOz, lengthIn, widthIn, heightIn]
  );

  const printBlockReason = useMemo(
    () =>
      getPrintLabelBlockReason({
        fromAddress: resolvedFrom,
        toAddress,
        weightLbs,
        weightOz,
        lengthIn,
        widthIn,
        heightIn,
        selectedRateId,
        selectedService,
        defaultFromAddress: DEFAULT_FROM_ADDRESS,
      }),
    [
      resolvedFrom,
      toAddress,
      weightLbs,
      weightOz,
      lengthIn,
      widthIn,
      heightIn,
      selectedRateId,
      selectedService,
    ]
  );

  const canGetRates = ratesBlockReason == null;
  const canPrintLabel = printBlockReason == null;

  const handleGetRates = async () => {
    if (ratesBlockReason) {
      Alert.alert('Missing details', ratesBlockReason);
      return;
    }
    setLoadingRates(true);
    setRates([]);
    setSelectedRateId('');
    setSelectedService('');
    try {
      const result = await fetchShippingRates({
        fromAddress: resolvedFrom,
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
    if (printBlockReason) {
      Alert.alert('Cannot print label', printBlockReason);
      return;
    }
    setGenerating(true);
    try {
      const selectedRate = rates.find((r) => r.rateId === selectedRateId);
      const result = await generateShippingLabel({
        saleId: sale.id,
        fromAddress: resolvedFrom,
        toAddress,
        packageDetails: {
          weightLbs: parseFloat(weightLbs) || 1,
          lengthIn: parseFloat(lengthIn) || 10,
          widthIn: parseFloat(widthIn) || 10,
          heightIn: parseFloat(heightIn) || 10,
        },
        service: selectedService || selectedRate?.service || '',
        rateId: selectedRateId,
        carrier: selectedRate?.carrier,
        estimatedDelivery:
          selectedRate?.deliveryDate ?? selectedRate?.deliveryDays ?? undefined,
      });
      try {
        await markShippingLabelCreated(sale.id);
      } catch {
        /* label still generated in mock-only mode */
      }
      setLabelUrl(result.labelUrl);
      setTrackingNumber(result.trackingNumber);
      setLabelCarrier(result.carrier ?? selectedRate?.carrier ?? null);
      setLabelServiceName(result.service ?? selectedService);
      setLabelEstimatedDelivery(
        result.estimatedDelivery ??
          selectedRate?.deliveryDate ??
          selectedRate?.deliveryDays ??
          null
      );
      setPdfModalVisible(true);
      onComplete();
    } catch (error) {
      Alert.alert('Label failed', error instanceof Error ? error.message : 'Try again');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintLabel = async () => {
    if (!labelUrl || !trackingNumber) return;
    setPrinting(true);
    try {
      await printShippingLabelPdfUri(labelUrl, {
        fromAddress: resolvedFrom,
        toAddress,
        packageDetails: {
          weightLbs: parseFloat(weightLbs) || 1,
          lengthIn: parseFloat(lengthIn) || 10,
          widthIn: parseFloat(widthIn) || 10,
          heightIn: parseFloat(heightIn) || 10,
        },
        carrier: labelCarrier ?? 'Carrier',
        service: labelServiceName ?? selectedService,
        trackingNumber,
        estimatedDelivery: labelEstimatedDelivery ?? undefined,
      });
    } catch (error) {
      Alert.alert('Print failed', error instanceof Error ? error.message : 'Try again');
    } finally {
      setPrinting(false);
    }
  };

  const handleSharePdf = async () => {
    if (!labelUrl) return;
    try {
      await Share.share({ message: `Shipping label: ${labelUrl}`, url: labelUrl });
    } catch {
      void Linking.openURL(labelUrl);
    }
  };

  const handleEmailLabel = async () => {
    if (!labelUrl || !trackingNumber) return;
    if (!emailTo.trim()) {
      Alert.alert('Email required', 'Enter a recipient email address.');
      return;
    }
    setEmailing(true);
    try {
      const result = await emailShippingLabel({
        email: emailTo.trim(),
        labelUrl,
        trackingNumber,
      });
      Alert.alert(result.mock ? 'Email logged' : 'Email sent', result.message);
    } catch (error) {
      Alert.alert('Email failed', error instanceof Error ? error.message : 'Try again');
    } finally {
      setEmailing(false);
    }
  };

  const helperText = printBlockReason ?? ratesBlockReason;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Shipping Label</Text>
        <Text style={styles.subtitle}>{sale.productTitle ?? `Sale #${sale.id}`}</Text>

        <AddressFields title="Ship from" value={fromAddress} onChange={setFromAddress} />
        <AddressFields title="Ship to" value={toAddress} onChange={setToAddress} />

        <Text style={styles.sectionLabel}>Package weight</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex1]}
            value={weightLbs}
            onChangeText={setWeightLbs}
            keyboardType="decimal-pad"
            placeholder="lb"
            placeholderTextColor="#6b7280"
          />
          <TextInput
            style={[styles.input, styles.flex1]}
            value={weightOz}
            onChangeText={setWeightOz}
            keyboardType="decimal-pad"
            placeholder="oz"
            placeholderTextColor="#6b7280"
          />
        </View>

        <Text style={styles.sectionLabel}>Dimensions (inches)</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex1]}
            value={lengthIn}
            onChangeText={setLengthIn}
            keyboardType="decimal-pad"
            placeholder="L"
            placeholderTextColor="#6b7280"
          />
          <TextInput
            style={[styles.input, styles.flex1]}
            value={widthIn}
            onChangeText={setWidthIn}
            keyboardType="decimal-pad"
            placeholder="W"
            placeholderTextColor="#6b7280"
          />
          <TextInput
            style={[styles.input, styles.flex1]}
            value={heightIn}
            onChangeText={setHeightIn}
            keyboardType="decimal-pad"
            placeholder="H"
            placeholderTextColor="#6b7280"
          />
        </View>

        {helperText ? <Text style={styles.errorText}>{helperText}</Text> : null}

        <TouchableOpacity
          style={[styles.secondaryButton, (!canGetRates || loadingRates) && styles.buttonDisabled]}
          onPress={() => void handleGetRates()}
          disabled={loadingRates || !canGetRates}
        >
          {loadingRates ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Get Rates</Text>
          )}
        </TouchableOpacity>

        {shipDateLabel ? <Text style={styles.shipDateNote}>{shipDateLabel}</Text> : null}
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
            <View style={styles.radioOuter}>
              {selectedRateId === rate.rateId ? <View style={styles.radioInner} /> : null}
            </View>
            <Text style={styles.rateText}>
              {formatRateLabel(rate)}
              {rate.source === 'mock' ? ' est.' : ''}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.primaryButton, (!canPrintLabel || generating) && styles.buttonDisabled]}
          onPress={() => void handleGenerate()}
          disabled={generating || !canPrintLabel}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Print Label</Text>
          )}
        </TouchableOpacity>

        {labelUrl ? (
          <>
            <View style={styles.labelSummary}>
              <Text style={styles.summaryTitle}>Label summary</Text>
              <Text style={styles.summaryHeading}>Ship to</Text>
              <Text style={styles.summaryText}>{formatAddressBlock(toAddress)}</Text>
              <Text style={styles.summaryHeading}>From / return</Text>
              <Text style={styles.summaryText}>{formatAddressBlock(resolvedFrom)}</Text>
              {(labelCarrier || labelServiceName) && (
                <Text style={styles.summaryMeta}>
                  {formatCarrierService(labelCarrier ?? '', labelServiceName ?? '')}
                </Text>
              )}
              {labelEstimatedDelivery ? (
                <Text style={styles.summaryMeta}>Est. delivery: {labelEstimatedDelivery}</Text>
              ) : null}
              {trackingNumber ? (
                <Text style={styles.summaryMeta}>Tracking: {trackingNumber}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, printing && styles.buttonDisabled]}
              onPress={() => void handlePrintLabel()}
              disabled={printing}
            >
              {printing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Print Label</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setPdfModalVisible(true)}>
              <Text style={styles.buttonText}>Preview PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleSharePdf()}>
              <Text style={styles.buttonText}>Share PDF</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Email label to…"
              value={emailTo}
              onChangeText={setEmailTo}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#6b7280"
            />
            <TouchableOpacity
              style={[styles.secondaryButton, emailing && styles.buttonDisabled]}
              onPress={() => void handleEmailLabel()}
              disabled={emailing}
            >
              {emailing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Email PDF</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}

        <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={pdfModalVisible && Boolean(labelUrl)} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Label {trackingNumber ? `· ${trackingNumber}` : ''}
            </Text>
            <TouchableOpacity onPress={() => setPdfModalVisible(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          {labelUrl ? (
            <WebView source={{ uri: labelUrl }} style={styles.webview} startInLoadingState />
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
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
  row: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  stateInput: { width: 88 },
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
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontWeight: '600' },
  errorText: { color: '#f87171', fontSize: 13, lineHeight: 18 },
  shipDateNote: { color: '#93c5fd', fontSize: 13, marginTop: 4 },
  deliveryDisclaimer: { color: '#6b7280', fontSize: 11, lineHeight: 16 },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
  },
  rateRowSelected: { borderColor: '#3b82f6' },
  rateText: { color: '#fff', flex: 1, fontSize: 14 },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  modalContainer: { flex: 1, backgroundColor: '#0a0a0f' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  modalTitle: { color: '#fff', fontWeight: '600', flex: 1 },
  modalClose: { color: '#3b82f6', fontWeight: '600' },
  webview: { flex: 1, backgroundColor: '#111827' },
  labelSummary: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
    gap: 4,
  },
  summaryTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  summaryHeading: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 6,
  },
  summaryText: { color: '#e5e7eb', fontSize: 13, lineHeight: 18 },
  summaryMeta: { color: '#93c5fd', fontSize: 12, marginTop: 2 },
});

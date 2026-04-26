import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1 },
  { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.85 },
  { code: 'GBP', symbol: '£', name: 'British Pound', rate: 0.73 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', rate: 110.0 },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso', rate: 20.0 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', rate: 5.25 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rate: 1.35 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', rate: 1.25 },
];

const CARRIERS = ['USPS', 'FedEx', 'UPS', 'DHL'];

export default function ToolsScreen() {
  const [amount, setAmount] = useState('');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);

  const [weight, setWeight] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [destination, setDestination] = useState('');
  const [shippingResult, setShippingResult] = useState<{
    trackingNumber: string;
    estimatedCost: number;
    billableWeight: number;
  } | null>(null);

  const handleConvert = () => {
    const value = parseFloat(amount);
    if (isNaN(value)) {
      Alert.alert('Invalid Amount', 'Please enter a valid number');
      return;
    }

    const fromRate = CURRENCIES.find((c) => c.code === fromCurrency)?.rate || 1;
    const toRate = CURRENCIES.find((c) => c.code === toCurrency)?.rate || 1;
    const result = (value / fromRate) * toRate;
    setConvertedAmount(result);
  };

  const handleSwapCurrencies = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
    setConvertedAmount(null);
  };

  const handleGenerateLabel = () => {
    if (!weight || !destination) {
      Alert.alert('Missing Information', 'Please enter weight and destination');
      return;
    }

    // Calculate estimated shipping cost
    const weightNum = parseFloat(weight) || 1;
    const dimParts = (dimensions || '10x10x10').split('x').map((d) => parseFloat(d) || 10);
    const dimWeight = (dimParts[0] * dimParts[1] * dimParts[2]) / 139;
    const billableWeight = Math.max(weightNum, dimWeight);

    let estimatedCost = 4.99;
    if (billableWeight <= 1) estimatedCost = 4.99;
    else if (billableWeight <= 3) estimatedCost = 7.49;
    else if (billableWeight <= 5) estimatedCost = 9.99;
    else if (billableWeight <= 10) estimatedCost = 14.99;
    else if (billableWeight <= 20) estimatedCost = 19.99;
    else estimatedCost = 19.99 + (billableWeight - 20) * 0.75;

    const trackingNumber = `1Z${Math.random().toString(36).substring(2, 15).toUpperCase()}`;

    setShippingResult({
      trackingNumber,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      billableWeight: Math.round(billableWeight * 10) / 10,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="swap-horizontal" size={24} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Currency Converter</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="Enter amount"
              placeholderTextColor="#6b7280"
              keyboardType="decimal-pad"
            />

            <View style={styles.currencyRow}>
              <View style={styles.currencySelect}>
                <Text style={styles.label}>From</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.currencyChips}>
                    {CURRENCIES.map((currency) => (
                      <TouchableOpacity
                        key={currency.code}
                        style={[
                          styles.currencyChip,
                          fromCurrency === currency.code && styles.currencyChipActive,
                        ]}
                        onPress={() => {
                          setFromCurrency(currency.code);
                          setConvertedAmount(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.currencyChipText,
                            fromCurrency === currency.code && styles.currencyChipTextActive,
                          ]}
                        >
                          {currency.code}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity style={styles.swapButton} onPress={handleSwapCurrencies}>
              <Ionicons name="swap-vertical" size={20} color="#3b82f6" />
            </TouchableOpacity>

            <View style={styles.currencySelect}>
              <Text style={styles.label}>To</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.currencyChips}>
                  {CURRENCIES.map((currency) => (
                    <TouchableOpacity
                      key={currency.code}
                      style={[
                        styles.currencyChip,
                        toCurrency === currency.code && styles.currencyChipActive,
                      ]}
                      onPress={() => {
                        setToCurrency(currency.code);
                        setConvertedAmount(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.currencyChipText,
                          toCurrency === currency.code && styles.currencyChipTextActive,
                        ]}
                      >
                        {currency.code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <TouchableOpacity style={styles.convertButton} onPress={handleConvert}>
              <Text style={styles.convertButtonText}>Convert</Text>
            </TouchableOpacity>

            {convertedAmount !== null && (
              <View style={styles.resultContainer}>
                <Text style={styles.resultLabel}>Converted Amount</Text>
                <Text style={styles.resultValue}>
                  {CURRENCIES.find((c) => c.code === toCurrency)?.symbol}
                  {convertedAmount.toFixed(2)} {toCurrency}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cube" size={24} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Shipping Label Generator</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Package Weight (lbs)</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder="Enter weight"
              placeholderTextColor="#6b7280"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Dimensions (LxWxH in inches)</Text>
            <TextInput
              style={styles.input}
              value={dimensions}
              onChangeText={setDimensions}
              placeholder="e.g. 10x8x4"
              placeholderTextColor="#6b7280"
            />

            <Text style={styles.label}>Destination Country</Text>
            <TextInput
              style={styles.input}
              value={destination}
              onChangeText={setDestination}
              placeholder="Enter destination country"
              placeholderTextColor="#6b7280"
            />

            <Text style={styles.carriersLabel}>Available Carriers</Text>
            <View style={styles.carriersList}>
              {CARRIERS.map((carrier) => (
                <View key={carrier} style={styles.carrierBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={styles.carrierText}>{carrier}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.generateButton} onPress={handleGenerateLabel}>
              <Ionicons name="document-text" size={20} color="#ffffff" />
              <Text style={styles.generateButtonText}>Generate Labels</Text>
            </TouchableOpacity>

            {shippingResult && (
              <View style={styles.shippingResultContainer}>
                <View style={styles.shippingResultRow}>
                  <Text style={styles.shippingResultLabel}>Tracking:</Text>
                  <Text style={styles.shippingResultValue}>{shippingResult.trackingNumber}</Text>
                </View>
                <View style={styles.shippingCostContainer}>
                  <Text style={styles.shippingCostLabel}>Estimated Shipping Cost:</Text>
                  <Text style={styles.shippingCostValue}>${shippingResult.estimatedCost.toFixed(2)}</Text>
                </View>
                <View style={styles.shippingResultRow}>
                  <Text style={styles.shippingResultLabel}>Billable Weight:</Text>
                  <Text style={styles.shippingResultValue}>{shippingResult.billableWeight} lbs</Text>
                </View>
              </View>
            )}
          </View>
        </View>
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
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
  },
  label: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0a0a0f',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 16,
  },
  currencyRow: {
    marginBottom: 8,
  },
  currencySelect: {
    marginBottom: 16,
  },
  currencyChips: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1f2937',
  },
  currencyChipActive: {
    backgroundColor: '#3b82f6',
  },
  currencyChipText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  currencyChipTextActive: {
    color: '#ffffff',
  },
  swapButton: {
    alignSelf: 'center',
    padding: 8,
    marginBottom: 8,
  },
  convertButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  convertButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    marginTop: 16,
    backgroundColor: '#0a0a0f',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  resultLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 4,
  },
  resultValue: {
    color: '#10b981',
    fontSize: 24,
    fontWeight: 'bold',
  },
  carriersLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  carriersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  carrierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0a0a0f',
    borderRadius: 8,
  },
  carrierText: {
    color: '#ffffff',
    fontSize: 14,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 8,
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  shippingResultContainer: {
    marginTop: 16,
    backgroundColor: '#0a0a0f',
    padding: 16,
    borderRadius: 8,
  },
  shippingResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  shippingResultLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  shippingResultValue: {
    color: '#ffffff',
    fontSize: 14,
  },
  shippingCostContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#10b98120',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  shippingCostLabel: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  shippingCostValue: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

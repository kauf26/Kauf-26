import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  authenticateWithBiometric,
  enableBiometricAuth,
  getBiometricCapability,
  getStoredPin,
  isBiometricEnabled,
  storePin,
  type BiometricCapability,
} from '../auth/biometric';

interface PinAuthScreenProps {
  hasPin: boolean;
  onAuthenticate: () => void;
  onPinSet: () => void;
}

type SetupStep = 'create' | 'confirm' | 'biometric-offer';

export default function PinAuthScreen({
  hasPin,
  onAuthenticate,
  onPinSet,
}: PinAuthScreenProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupStep, setSetupStep] = useState<SetupStep>('create');
  const [biometricCap, setBiometricCap] = useState<BiometricCapability | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showPinPad, setShowPinPad] = useState(!hasPin);
  const [enablingBiometric, setEnablingBiometric] = useState(false);

  const loadBiometricState = useCallback(async () => {
    const [cap, enabled] = await Promise.all([
      getBiometricCapability(),
      isBiometricEnabled(),
    ]);
    setBiometricCap(cap);
    setBiometricEnabled(enabled);
    return { cap, enabled };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { cap, enabled } = await loadBiometricState();
      if (cancelled) return;

      if (hasPin && enabled && cap.available && cap.enrolled) {
        setShowPinPad(false);
        setBiometricLoading(true);
        try {
          const result = await authenticateWithBiometric();
          if (cancelled) return;
          if (result.ok) {
            onAuthenticate();
            return;
          }
        } catch {
          // Fall through to PIN pad
        }
        setShowPinPad(true);
        setBiometricLoading(false);
      } else {
        setShowPinPad(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasPin, onAuthenticate, loadBiometricState]);

  const handleNumberPress = async (num: string) => {
    if (hasPin) {
      const newPin = pin + num;
      setPin(newPin);

      if (newPin.length === 4) {
        const storedPin = await getStoredPin();
        if (newPin === storedPin) {
          onAuthenticate();
        } else {
          Alert.alert('Incorrect PIN', 'Please try again');
          setPin('');
        }
      }
    } else if (setupStep === 'create') {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        setSetupStep('confirm');
      }
    } else if (setupStep === 'confirm') {
      const newConfirm = confirmPin + num;
      setConfirmPin(newConfirm);
      if (newConfirm.length === 4) {
        if (newConfirm === pin) {
          await storePin(pin);
          const cap = await getBiometricCapability();
          setBiometricCap(cap);
          if (cap.available && cap.enrolled) {
            setSetupStep('biometric-offer');
          } else {
            onPinSet();
          }
        } else {
          Alert.alert('PINs do not match', 'Please try again');
          setPin('');
          setConfirmPin('');
          setSetupStep('create');
        }
      }
    }
  };

  const handleDelete = () => {
    if (setupStep === 'confirm') {
      setConfirmPin(confirmPin.slice(0, -1));
    } else {
      setPin(pin.slice(0, -1));
    }
  };

  const handleEnableBiometric = async () => {
    setEnablingBiometric(true);
    try {
      const result = await enableBiometricAuth(pin);
      if (result.ok) {
        setBiometricEnabled(true);
        onPinSet();
      } else if (result.error !== 'Cancelled') {
        Alert.alert('Could not enable biometrics', result.error);
      }
    } finally {
      setEnablingBiometric(false);
    }
  };

  const handleSkipBiometric = () => {
    onPinSet();
  };

  const handleUseBiometric = async () => {
    setBiometricLoading(true);
    try {
      const result = await authenticateWithBiometric();
      if (result.ok) {
        onAuthenticate();
      } else if (result.error && result.error !== 'Cancelled' && !result.cancelled) {
        Alert.alert('Authentication failed', 'Use your PIN instead.');
        setShowPinPad(true);
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  const biometricLabel = biometricCap?.label ?? 'Biometrics';
  const canOfferBiometric =
    Boolean(biometricCap?.available && biometricCap?.enrolled);

  if (hasPin && !showPinPad && biometricLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="storefront" size={48} color="#3b82f6" />
          <Text style={styles.appTitle}>Global Marketplace</Text>
          <Text style={styles.title}>Unlock with {biometricLabel}</Text>
        </View>
        <ActivityIndicator size="large" color="#3b82f6" />
        <TouchableOpacity
          style={styles.fallbackButton}
          onPress={() => {
            setBiometricLoading(false);
            setShowPinPad(true);
          }}
        >
          <Text style={styles.fallbackText}>Use PIN instead</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!hasPin && setupStep === 'biometric-offer') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="finger-print" size={48} color="#3b82f6" />
          <Text style={styles.appTitle}>PIN created</Text>
          <Text style={styles.title}>Enable {biometricLabel}?</Text>
          <Text style={styles.subtitle}>
            Unlock the app quickly with {biometricLabel}. Your PIN stays available as a fallback.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.biometricButton}
          onPress={() => void handleEnableBiometric()}
          disabled={enablingBiometric}
        >
          {enablingBiometric ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="finger-print" size={22} color="#fff" />
              <Text style={styles.biometricButtonText}>Use {biometricLabel}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkipBiometric}>
          <Text style={styles.skipText}>Skip — use PIN only</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentPin = setupStep === 'confirm' ? confirmPin : pin;
  const title = hasPin
    ? 'Enter PIN'
    : setupStep === 'confirm'
      ? 'Confirm PIN'
      : 'Create PIN';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="storefront" size={48} color="#3b82f6" />
        <Text style={styles.appTitle}>Global Marketplace</Text>
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.pinDisplay}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.pinDot, currentPin.length > i && styles.pinDotFilled]}
          />
        ))}
      </View>

      {hasPin && canOfferBiometric && biometricEnabled ? (
        <TouchableOpacity
          style={styles.biometricButtonCompact}
          onPress={() => void handleUseBiometric()}
          disabled={biometricLoading}
        >
          {biometricLoading ? (
            <ActivityIndicator color="#3b82f6" />
          ) : (
            <>
              <Ionicons name="finger-print" size={20} color="#3b82f6" />
              <Text style={styles.biometricCompactText}>Use {biometricLabel}</Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}

      <View style={styles.keypad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((key, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.key, key === null && styles.keyEmpty]}
            onPress={() => {
              if (key === 'del') {
                handleDelete();
              } else if (key !== null) {
                void handleNumberPress(key.toString());
              }
            }}
            disabled={key === null}
          >
            {key === 'del' ? (
              <Ionicons name="backspace-outline" size={24} color="#ffffff" />
            ) : key !== null ? (
              <Text style={styles.keyText}>{key}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 24,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    color: '#9ca3af',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  pinDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 16,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: '#3b82f6',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 220,
    justifyContent: 'center',
    marginBottom: 16,
  },
  biometricButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  biometricButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  biometricCompactText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipText: {
    color: '#9ca3af',
    fontSize: 15,
  },
  fallbackButton: {
    marginTop: 32,
    paddingVertical: 12,
  },
  fallbackText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '600',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 280,
    gap: 16,
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyEmpty: {
    backgroundColor: 'transparent',
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#ffffff',
  },
});

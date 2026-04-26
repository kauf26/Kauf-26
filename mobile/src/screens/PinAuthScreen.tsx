import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

interface PinAuthScreenProps {
  hasPin: boolean;
  onAuthenticate: () => void;
  onPinSet: () => void;
}

export default function PinAuthScreen({ hasPin, onAuthenticate, onPinSet }: PinAuthScreenProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const handleNumberPress = async (num: string) => {
    if (hasPin) {
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === 4) {
        const storedPin = await SecureStore.getItemAsync('userPin');
        if (newPin === storedPin) {
          onAuthenticate();
        } else {
          Alert.alert('Incorrect PIN', 'Please try again');
          setPin('');
        }
      }
    } else {
      if (!isConfirming) {
        const newPin = pin + num;
        setPin(newPin);
        if (newPin.length === 4) {
          setIsConfirming(true);
        }
      } else {
        const newConfirm = confirmPin + num;
        setConfirmPin(newConfirm);
        if (newConfirm.length === 4) {
          if (newConfirm === pin) {
            await SecureStore.setItemAsync('userPin', pin);
            onPinSet();
          } else {
            Alert.alert('PINs do not match', 'Please try again');
            setPin('');
            setConfirmPin('');
            setIsConfirming(false);
          }
        }
      }
    }
  };

  const handleDelete = () => {
    if (!isConfirming) {
      setPin(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const currentPin = isConfirming ? confirmPin : pin;
  const title = hasPin
    ? 'Enter PIN'
    : isConfirming
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
            style={[
              styles.pinDot,
              currentPin.length > i && styles.pinDotFilled,
            ]}
          />
        ))}
      </View>

      <View style={styles.keypad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((key, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.key, key === null && styles.keyEmpty]}
            onPress={() => {
              if (key === 'del') {
                handleDelete();
              } else if (key !== null) {
                handleNumberPress(key.toString());
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
  },
  pinDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
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

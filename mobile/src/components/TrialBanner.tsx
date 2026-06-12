import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import { getTrialBannerText } from '../../../shared/trialStatus';
import { fetchTrialStatus } from '../services/trialStatus';

type Props = {
  style?: StyleProp<TextStyle>;
  fallbackText?: string;
  /** Lowercase variant for mobile promo footer */
  variant?: 'uppercase' | 'sentence';
};

export default function TrialBanner({
  style,
  fallbackText = 'Free 14 day trial',
  variant = 'sentence',
}: Props) {
  const [text, setText] = useState<string | null>(fallbackText);

  useEffect(() => {
    let cancelled = false;
    void fetchTrialStatus().then((status) => {
      if (cancelled) return;
      if (!status) {
        setText(fallbackText);
        return;
      }
      if (status.expired || !status.isActive) {
        setText(null);
        return;
      }
      setText(
        getTrialBannerText(status, {
          uppercase: variant === 'uppercase',
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, [fallbackText, variant]);

  if (!text) return null;

  return <Text style={[styles.text, style]}>{text}</Text>;
}

const styles = StyleSheet.create({
  text: {
    textAlign: 'center',
  },
});

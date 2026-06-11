import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Switch,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import type { HomeStackParamList } from '../types/identify';
import {
  DEFAULT_IDENTIFY_MARKETPLACES,
  mapIdentifyResponseToEditPayload,
  postIdentify,
  type IdentifyImageInput,
} from '../services/identifyApi';
import {
  resolveVerificationMessage,
  shouldProceedToDraft,
} from '../../../shared/identifyFlow';

const LOGO_IMAGE = require('../../assets/icon.png');
const LOGO_SIZE = 96 * 2;
import {
  getAutoTranslateEnabled,
  setAutoTranslateEnabled,
} from '../services/translationPrefs';
import { IdentifyTheme as T } from '../theme/identifyTheme';

const PALETTE = {
  purple: '#8B5CF6',
  blue: '#3B82F6',
  pink: '#EC4899',
  accent: '#2563EB',
  secondary: '#1F2937',
  body: '#1F2937',
  muted: '#9CA3AF',
} as const;

const MAX_IMAGES = 5;
const ANGLE_ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'] as const;
/** Matches web ProductCamera JPEG quality. */
const PHOTO_CAPTURE_QUALITY = 0.85;
/** Photo-only camera — do not pass onBarcodeScanned (no QR/barcode scanning). */
const PRODUCT_CAMERA_VIEW_PROPS = {
  mode: 'picture' as const,
  facing: 'back' as const,
  barcodeScannerSettings: { barcodeTypes: [] as const },
};

type NavigationProp = StackNavigationProp<HomeStackParamList, 'Identify'>;

export default function IdentifyScreen() {
  const navigation = useNavigation<NavigationProp>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const successScale = useRef(new Animated.Value(0)).current;

  const [capturedImages, setCapturedImages] = useState<IdentifyImageInput[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [isCapturingMore, setIsCapturingMore] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [shutterPressed, setShutterPressed] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    void getAutoTranslateEnabled().then(setAutoTranslate);
    return () => clearProgressTimer();
  }, []);

  useEffect(() => {
    if (!showCamera) {
      setCameraReady(false);
      setIsCapturing(false);
    }
  }, [showCamera]);

  const clearProgressTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const startAnalyzeProgress = (total: number) => {
    clearProgressTimer();
    setAnalyzeStep(1);
    if (total <= 1) return;
    progressTimerRef.current = setInterval(() => {
      setAnalyzeStep((prev) => (prev < total ? prev + 1 : prev));
    }, 4500);
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('Could not access camera. Please check permissions.');
        return;
      }
    }
    setError(null);
    setShowCamera(true);
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || !cameraReady || isCapturing || isIdentifying) {
      return;
    }

    setIsCapturing(true);
    setError(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: PHOTO_CAPTURE_QUALITY,
        skipProcessing: false,
      });
      if (!photo?.uri) {
        setError('No image was captured. Please try again.');
        return;
      }
      setCapturedImages((prev) => {
        if (prev.length >= MAX_IMAGES) return prev;
        return [
          ...prev,
          {
            uri: photo.uri,
            mimeType: 'image/jpeg',
            fileName: `angle-${prev.length + 1}.jpg`,
          },
        ];
      });
      setShowCamera(false);
      setIsCapturingMore(false);
      setError(null);
    } catch {
      setError('Something went wrong while taking the photo.');
    } finally {
      setIsCapturing(false);
    }
  };

  const removeImage = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const retakeAll = () => {
    setCapturedImages([]);
    setIsCapturingMore(false);
    setShowCamera(false);
    setError(null);
  };

  const addAnotherAngle = () => {
    if (capturedImages.length >= MAX_IMAGES) return;
    setIsCapturingMore(true);
    void openCamera();
  };

  const playSuccessAnimation = () =>
    new Promise<void>((resolve) => {
      setShowSuccess(true);
      successScale.setValue(0);
      Animated.spring(successScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          setShowSuccess(false);
          resolve();
        }, 600);
      });
    });

  const runIdentify = async () => {
    if (capturedImages.length === 0) {
      setError('Take a photo with the camera first.');
      return;
    }

    setIsIdentifying(true);
    setError(null);
    startAnalyzeProgress(capturedImages.length);

    try {
      const response = await postIdentify(capturedImages, {
        autoTranslate,
        marketplaces: DEFAULT_IDENTIFY_MARKETPLACES,
      });

      const payload = mapIdentifyResponseToEditPayload(response);
      payload.verificationMessage =
        resolveVerificationMessage(response) ??
        (shouldProceedToDraft(response)
          ? payload.verificationMessage
          : "Here's our match, please review before publishing.");

      await playSuccessAnimation();
      navigation.navigate('Edit', { result: payload });
    } catch {
      setError('Failed to identify product. Check server connection.');
    } finally {
      clearProgressTimer();
      setAnalyzeStep(0);
      setIsIdentifying(false);
    }
  };

  const onToggleAutoTranslate = (value: boolean) => {
    setAutoTranslate(value);
    void setAutoTranslateEnabled(value);
  };

  const angleLabel =
    capturedImages.length < ANGLE_ORDINALS.length
      ? ANGLE_ORDINALS[capturedImages.length]
      : `${capturedImages.length + 1}th`;

  const captureLabel =
    capturedImages.length === 0 ? 'Take Photo' : `Take ${angleLabel} photo`;

  const showStartCamera =
    !showCamera && capturedImages.length === 0 && !isIdentifying;

  if (showCamera && permission?.granted) {
    const shutterDisabled = !cameraReady || isCapturing || isIdentifying;

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          {...PRODUCT_CAMERA_VIEW_PROPS}
          onCameraReady={() => setCameraReady(true)}
        >
          <View style={styles.cameraHud} pointerEvents="box-none">
            <SafeAreaView style={styles.cameraTopBar} edges={['top']}>
              <TouchableOpacity
                style={styles.cameraCloseButton}
                onPress={() => {
                  setShowCamera(false);
                  setIsCapturingMore(false);
                }}
                accessibilityLabel="Close camera"
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </SafeAreaView>

            <SafeAreaView style={styles.cameraBottomBar} edges={['bottom']}>
              <Text style={styles.captureHint}>
                {capturedImages.length === 0
                  ? 'Point at your product and tap the button to capture a photo.'
                  : `Capture your ${angleLabel} angle (${capturedImages.length + 1}/${MAX_IMAGES}).`}
              </Text>
              <Text style={styles.captureLabel}>{captureLabel}</Text>

              <TouchableOpacity
                activeOpacity={0.9}
                onPressIn={() => setShutterPressed(true)}
                onPressOut={() => setShutterPressed(false)}
                onPress={() => void capturePhoto()}
                disabled={shutterDisabled}
                accessibilityLabel={captureLabel}
                style={[
                  styles.shutterOuter,
                  shutterPressed && styles.shutterPressed,
                  shutterDisabled && styles.buttonDisabled,
                ]}
              >
                <View style={styles.shutterInner}>
                  {isCapturing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Ionicons name="camera" size={32} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>

              {capturedImages.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setShowCamera(false);
                    setIsCapturingMore(false);
                  }}
                >
                  <Text style={styles.doneAnglesText}>Done adding angles</Text>
                </TouchableOpacity>
              )}
            </SafeAreaView>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentColumn}>
          <View style={styles.logoCircle} accessibilityLabel="Kauf-AI logo">
            <Image
              source={LOGO_IMAGE}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View style={[styles.welcomeHeader, styles.sectionSpacing]}>
            <Text
              style={styles.brandTitle}
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.6}
            >
              KAUF-AI
            </Text>
            <View style={styles.brandTaglineRow}>
              <Text style={styles.taglinePurple}>PICTURE</Text>
              <Text style={styles.taglineDot}> · </Text>
              <Text style={styles.taglineBlue}>POST</Text>
              <Text style={styles.taglineDot}> · </Text>
              <Text style={styles.taglinePink}>SELL</Text>
            </View>
          </View>

          <View style={styles.cameraCard}>
            {error ? (
              <View style={[styles.errorBanner, styles.sectionSpacing]}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {showSuccess ? (
              <Animated.View
                style={[
                  styles.successBanner,
                  styles.sectionSpacing,
                  { transform: [{ scale: successScale }] },
                ]}
              >
                <Ionicons name="checkmark-circle" size={22} color={T.successText} />
                <Text style={styles.successText}>Product identified!</Text>
              </Animated.View>
            ) : null}

            {showStartCamera ? (
              <View style={styles.startActions}>
                <TouchableOpacity
                  style={[
                    styles.startCameraButton,
                    styles.sectionSpacing,
                    isIdentifying && styles.buttonDisabled,
                  ]}
                  onPress={() => void openCamera()}
                  disabled={isIdentifying}
                >
                  <Text style={styles.startCameraText}>Start Camera</Text>
                </TouchableOpacity>
              </View>
            ) : (
                <View style={[styles.reviewSection, styles.sectionSpacing]}>
                  <View style={[styles.imageGrid, styles.sectionSpacing]}>
                    {capturedImages.map((img, index) => (
                      <View key={`${index}-${img.uri}`} style={styles.thumbWrap}>
                        <View style={styles.thumbImageBox}>
                          <Image source={{ uri: img.uri }} style={styles.thumb} resizeMode="cover" />
                        </View>
                        <Text style={styles.thumbBadgeText}>Angle {index + 1}</Text>
                        <View style={styles.thumbActions}>
                          <TouchableOpacity
                            style={styles.thumbActionBtn}
                            onPress={() => {
                              removeImage(index);
                              setIsCapturingMore(true);
                              void openCamera();
                            }}
                            disabled={isIdentifying}
                          >
                            <Text style={styles.thumbActionText}>Replace</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.thumbActionBtn, styles.thumbRemoveBtn]}
                            onPress={() => removeImage(index)}
                            disabled={isIdentifying}
                          >
                            <Text style={styles.thumbActionText}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>

                  {capturedImages.length < MAX_IMAGES && (
                    <TouchableOpacity
                      style={[
                        styles.addAngleButton,
                        styles.sectionSpacing,
                        isIdentifying && styles.buttonDisabled,
                      ]}
                      onPress={addAnotherAngle}
                      disabled={isIdentifying}
                    >
                      <Text style={styles.addAngleText}>+ Add another angle</Text>
                    </TouchableOpacity>
                  )}

                  {isIdentifying && (
                    <View style={[styles.loadingRow, styles.sectionSpacing]}>
                      <ActivityIndicator color={PALETTE.accent} size="small" />
                      <Text style={styles.loadingText}>
                        Analyzing image {Math.min(analyzeStep || 1, capturedImages.length)}/
                        {capturedImages.length}… this may take up to a minute.
                      </Text>
                    </View>
                  )}

                  <View style={[styles.actionRow, styles.sectionSpacing]}>
                    <TouchableOpacity
                      style={[styles.secondaryAction, isIdentifying && styles.buttonDisabled]}
                      onPress={retakeAll}
                      disabled={isIdentifying}
                    >
                      <Text style={styles.secondaryActionText}>Start over</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryAction, isIdentifying && styles.buttonDisabled]}
                      onPress={() => void runIdentify()}
                      disabled={isIdentifying}
                    >
                      {isIdentifying ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : null}
                      <Text style={styles.primaryActionText}>
                        {isIdentifying
                          ? 'Analyzing…'
                          : capturedImages.length === 1
                            ? 'Identify'
                            : `Submit all (${capturedImages.length} photos)`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

            <View style={styles.translateRow}>
              <Text style={styles.translateLabel}>Auto-translate listings</Text>
              <View style={styles.switchWrap}>
                <Switch
                  value={autoTranslate}
                  onValueChange={onToggleAutoTranslate}
                  trackColor={{ false: '#FCA5A5', true: '#86EFAC' }}
                  thumbColor={autoTranslate ? '#22C55E' : '#EF4444'}
                  ios_backgroundColor="#FCA5A5"
                  disabled={isIdentifying}
                />
              </View>
            </View>
          </View>

          <View style={styles.promoFooter}>
            <Text style={styles.promoTrial}>Free 14 day trial</Text>
            <Text style={styles.promoTagline}>selling online made easy</Text>
            <Text style={styles.promoSold}>sold with KAUF – AI</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: T.pageBg },
  scroll: { flex: 1 },
  pageContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
    width: '100%',
  },
  contentColumn: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
  },
  logoCircle: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  logoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignSelf: 'center',
  },
  sectionSpacing: {
    marginBottom: 20,
  },
  welcomeHeader: {
    alignItems: 'center',
    width: '100%',
  },
  brandTitle: {
    fontSize: 48,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    width: '100%',
    marginBottom: 8,
  },
  brandTaglineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  taglinePurple: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    color: PALETTE.purple,
  },
  taglineBlue: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    color: PALETTE.purple,
  },
  taglinePink: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    color: PALETTE.purple,
  },
  taglineDot: {
    fontSize: 14,
    fontWeight: '800',
    color: PALETTE.purple,
  },
  cameraCard: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: PALETTE.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    ...Platform.select({
      ios: {
        shadowColor: T.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  errorBanner: {
    width: '100%',
    backgroundColor: T.errorBg,
    borderWidth: 1,
    borderColor: T.errorBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  errorText: { color: T.errorText, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: T.successBg,
    borderWidth: 1,
    borderColor: T.successBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  successText: { color: T.successText, fontSize: 13, fontWeight: '600' },
  startActions: { width: '100%', alignItems: 'center' },
  startCameraButton: {
    width: '100%',
    backgroundColor: PALETTE.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startCameraText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  reviewSection: { width: '100%', alignItems: 'center' },
  imageGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  thumbWrap: {
    width: '31%',
    alignItems: 'center',
    gap: 4,
  },
  thumbImageBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PALETTE.secondary,
  },
  thumb: { width: '100%', height: '100%' },
  thumbBadgeText: {
    color: PALETTE.body,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  thumbActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 4,
  },
  thumbActionBtn: {
    flex: 1,
    backgroundColor: PALETTE.accent,
    borderRadius: 4,
    paddingVertical: 4,
    alignItems: 'center',
  },
  thumbRemoveBtn: { backgroundColor: 'rgba(127,29,29,0.9)' },
  thumbActionText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  addAngleButton: {
    width: '100%',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: PALETTE.secondary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addAngleText: {
    color: PALETTE.body,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: PALETTE.body,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    flexShrink: 1,
  },
  actionRow: { width: '100%', flexDirection: 'row', gap: 12 },
  secondaryAction: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: PALETTE.secondary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryActionText: { color: PALETTE.body, fontSize: 14, fontWeight: '600' },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: PALETTE.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  translateRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: PALETTE.secondary,
    paddingTop: 16,
    marginTop: 4,
    minHeight: 48,
  },
  translateLabel: {
    flex: 1,
    flexShrink: 1,
    color: PALETTE.body,
    fontSize: 15,
    fontWeight: '600',
    marginRight: 12,
  },
  switchWrap: {
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }],
  },
  promoFooter: {
    width: '100%',
    alignItems: 'center',
    marginTop: 30,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  promoTrial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  promoTagline: {
    fontSize: 14,
    fontWeight: '400',
    color: PALETTE.body,
    textAlign: 'center',
    marginTop: 6,
  },
  promoSold: {
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.purple,
    textAlign: 'center',
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.4 },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraHud: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  cameraTopBar: {
    width: '100%',
    alignItems: 'center',
    padding: 16,
  },
  cameraCloseButton: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 24,
    padding: 8,
  },
  cameraBottomBar: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  captureHint: {
    color: T.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  captureLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: T.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  shutterPressed: { transform: [{ scale: 0.95 }], backgroundColor: T.emeraldDark },
  shutterInner: { alignItems: 'center', justifyContent: 'center' },
  doneAnglesText: {
    color: T.textMuted,
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

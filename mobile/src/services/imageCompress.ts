import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

/** Max long edge before upload (keeps JSON body under server limits). */
const MAX_IMAGE_DIMENSION = 1600;
/** JPEG quality for identify uploads (0–1). */
const JPEG_QUALITY = 0.72;

export type CompressedImage = {
  uri: string;
  mimeType: string;
  fileName?: string;
  width: number;
  height: number;
  bytes: number;
};

async function fileSizeBytes(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists) return 0;
  return typeof info.size === 'number' ? info.size : 0;
}

/**
 * Resize and compress a camera/library image before base64 JSON upload.
 */
export async function compressImageForUpload(
  uri: string,
  mimeType = 'image/jpeg'
): Promise<CompressedImage> {
  const normalized = uri.startsWith('file://') ? uri : uri;
  const beforeBytes = await fileSizeBytes(normalized);

  const result = await ImageManipulator.manipulateAsync(
    normalized,
    [{ resize: { width: MAX_IMAGE_DIMENSION } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    }
  );

  const afterBytes = await fileSizeBytes(result.uri);
  if (__DEV__) {
    console.log(
      `[Kauf26] Image compressed ${beforeBytes} → ${afterBytes} bytes (${result.width}×${result.height}, was ${mimeType})`
    );
  }

  return {
    uri: result.uri,
    mimeType: 'image/jpeg',
    width: result.width,
    height: result.height,
    bytes: afterBytes,
  };
}

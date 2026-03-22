/**
 * Smart Image Compression Utility
 *
 * Balances file size with visual quality. Uses adaptive quality to avoid
 * over-compression that causes color fade and loss of detail.
 */

export interface CompressionResult {
    file: File;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    width: number;
    height: number;
}

export interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    minQuality?: number;
    targetSizeKB?: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.88,        // 88% quality – preserves colors and detail
    minQuality: 0.7,      // Never go below 70% – avoids faded/washed-out look
    targetSizeKB: 500,    // Target ~500KB – balanced size vs quality
};

/**
 * Compress image while preserving visual quality and color.
 * Uses adaptive quality to hit target size without over-compression.
 */
export async function smartCompressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<CompressionResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const originalSize = file.size;

    // Skip if not an image or is GIF (GIFs lose animation when compressed)
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
        return {
            file,
            originalSize,
            compressedSize: file.size,
            compressionRatio: 0,
            width: 0,
            height: 0,
        };
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = async () => {
            try {
                // Calculate dimensions maintaining aspect ratio
                let { width, height } = img;
                const maxW = opts.maxWidth!;
                const maxH = opts.maxHeight!;

                if (width > maxW || height > maxH) {
                    const ratio = Math.min(maxW / width, maxH / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                canvas.width = width;
                canvas.height = height;

                // Draw with white background (for transparency)
                ctx!.fillStyle = '#FFFFFF';
                ctx!.fillRect(0, 0, width, height);
                ctx!.drawImage(img, 0, 0, width, height);

                // Adaptive compression - try to hit target size
                let quality = opts.quality!;
                let blob: Blob | null = null;
                let attempts = 0;
                const maxAttempts = 5;

                while (attempts < maxAttempts) {
                    blob = await new Promise<Blob | null>((res) => {
                        canvas.toBlob(res, 'image/jpeg', quality);
                    });

                    if (!blob) break;

                    // If we hit target size or quality is at minimum, stop
                    const sizeKB = blob.size / 1024;
                    if (sizeKB <= opts.targetSizeKB! || quality <= opts.minQuality!) {
                        break;
                    }

                    // Reduce quality further
                    quality = Math.max(quality * 0.7, opts.minQuality!);
                    attempts++;
                }

                if (!blob) {
                    throw new Error('Compression failed');
                }

                const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                });

                const compressedSize = compressedFile.size;
                const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);

                // Clean up
                URL.revokeObjectURL(img.src);

                resolve({
                    file: compressedFile,
                    originalSize,
                    compressedSize,
                    compressionRatio,
                    width,
                    height,
                });
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

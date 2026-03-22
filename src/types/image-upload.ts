/**
 * Image Upload Types for Smart Uploader
 */

export interface ImageMetadata {
    id: string;
    key: string;                    // R2 storage key
    url: string;                    // Public URL
    originalName: string;
    originalSize: number;           // Bytes
    compressedSize: number;         // Bytes
    compressionRatio: number;       // Percentage (0-100)
    width: number;
    height: number;
    mimeType: string;
    uploadedAt: Date;
    updatedAt?: Date;
}

export interface ImageUploadEvent {
    type: 'upload' | 'update' | 'delete';
    imageId: string;
    timestamp: Date;
    metadata?: {
        originalSize: number;
        compressedSize: number;
        compressionRatio: number;
    };
    previousMetadata?: {
        originalSize: number;
        compressedSize: number;
    };
}

export interface SmartUploaderState {
    images: ImageMetadata[];
    events: ImageUploadEvent[];
    totalOriginalSize: number;
    totalCompressedSize: number;
    totalSaved: number;
}

export interface UploadProgress {
    imageId: string;
    stage: 'compressing' | 'uploading' | 'complete' | 'error';
    progress: number;
    error?: string;
}

export interface ImageStats {
    count: number;
    totalOriginal: number;
    totalCompressed: number;
    totalSaved: number;
    avgCompression: number;
    formatted: {
        totalOriginal: string;
        totalCompressed: string;
        totalSaved: string;
    };
}

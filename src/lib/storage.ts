/**
 * Cloudflare R2 Storage Service with Smart Tracking
 * 
 * This module provides:
 * - Centralized R2 upload/delete functionality
 * - Storage usage tracking (before/after compression)
 * - Image compression utilities
 * - Storage analytics for the entire shop
 */

const R2_WORKER_URL = import.meta.env.VITE_R2_WORKER_URL || '';

// ============================================
// TYPES
// ============================================

export type UploadFolder =
    | 'damage-photos'
    | 'service-images'
    | 'pickup-photos'
    | 'delivery-photos'
    | 'receipts'
    | 'shop-assets'
    | 'payment-proofs'
    | 'profile-photos'
    /** Platform default catalog (Super Admin Items List); use with shopId "platform". */
    | 'default-catalog';

export interface UploadResult {
    key: string;
    url: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
}

export interface StorageRecord {
    id: string;
    shopId: string;
    key: string;
    url: string;
    folder: UploadFolder;
    filename: string;
    contentType: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    uploadedBy: string;
    uploadedAt: Date;
    deletedAt?: Date;
    isDeleted: boolean;
    metadata?: Record<string, string>;
}

export interface StorageStats {
    totalUploads: number;
    totalDeleted: number;
    activeFiles: number;
    totalOriginalBytes: number;
    totalCompressedBytes: number;
    totalSavedBytes: number;
    averageCompressionRatio: number;
    byFolder: Record<UploadFolder, {
        count: number;
        bytes: number;
    }>;
}

// ============================================
// STORAGE TRACKER (In-Memory for now, will sync to Firestore)
// ============================================

class StorageTracker {
    private records: Map<string, StorageRecord> = new Map();
    private listeners: Set<(stats: StorageStats) => void> = new Set();

    /**
     * Record a new upload
     */
    trackUpload(record: Omit<StorageRecord, 'id' | 'uploadedAt' | 'isDeleted'>): StorageRecord {
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const fullRecord: StorageRecord = {
            ...record,
            id,
            uploadedAt: new Date(),
            isDeleted: false,
        };

        this.records.set(id, fullRecord);
        this.notifyListeners();

        console.log('[StorageTracker] Upload tracked:', {
            key: record.key,
            originalSize: this.formatBytes(record.originalSize),
            compressedSize: this.formatBytes(record.compressedSize),
            saved: this.formatBytes(record.originalSize - record.compressedSize),
        });

        return fullRecord;
    }

    /**
     * Mark a file as deleted
     */
    trackDeletion(key: string): void {
        for (const [id, record] of this.records) {
            if (record.key === key && !record.isDeleted) {
                record.isDeleted = true;
                record.deletedAt = new Date();
                this.records.set(id, record);

                console.log('[StorageTracker] Deletion tracked:', key);
                this.notifyListeners();
                return;
            }
        }
    }

    /**
     * Get all records for a shop
     */
    getRecords(shopId: string): StorageRecord[] {
        return Array.from(this.records.values())
            .filter(r => r.shopId === shopId)
            .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    }

    /**
     * Get storage statistics for a shop
     */
    getStats(shopId: string): StorageStats {
        const records = Array.from(this.records.values()).filter(r => r.shopId === shopId);
        const active = records.filter(r => !r.isDeleted);

        const byFolder: StorageStats['byFolder'] = {
            'damage-photos': { count: 0, bytes: 0 },
            'service-images': { count: 0, bytes: 0 },
            'pickup-photos': { count: 0, bytes: 0 },
            'delivery-photos': { count: 0, bytes: 0 },
            'receipts': { count: 0, bytes: 0 },
            'shop-assets': { count: 0, bytes: 0 },
            'payment-proofs': { count: 0, bytes: 0 },
            'profile-photos': { count: 0, bytes: 0 },
            'default-catalog': { count: 0, bytes: 0 },
        };

        let totalOriginalBytes = 0;
        let totalCompressedBytes = 0;

        for (const record of active) {
            totalOriginalBytes += record.originalSize;
            totalCompressedBytes += record.compressedSize;

            if (byFolder[record.folder]) {
                byFolder[record.folder].count++;
                byFolder[record.folder].bytes += record.compressedSize;
            }
        }

        return {
            totalUploads: records.length,
            totalDeleted: records.filter(r => r.isDeleted).length,
            activeFiles: active.length,
            totalOriginalBytes,
            totalCompressedBytes,
            totalSavedBytes: totalOriginalBytes - totalCompressedBytes,
            averageCompressionRatio: totalOriginalBytes > 0
                ? totalCompressedBytes / totalOriginalBytes
                : 1,
            byFolder,
        };
    }

    /**
     * Subscribe to storage changes
     */
    subscribe(listener: (stats: StorageStats) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(): void {
        // For now, we pass empty stats since we don't have shopId in context
        // In real usage, components will call getStats with their shopId
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    /**
     * Export data for persistence (to Firestore)
     */
    exportRecords(): StorageRecord[] {
        return Array.from(this.records.values());
    }

    /**
     * Import data from persistence (from Firestore)
     */
    importRecords(records: StorageRecord[]): void {
        this.records.clear();
        for (const record of records) {
            this.records.set(record.id, record);
        }
    }
}

// Singleton instance
export const storageTracker = new StorageTracker();

// ============================================
// IMAGE COMPRESSION
// ============================================

export async function compressImage(
    file: File,
    maxWidth = 1200,
    quality = 0.8
): Promise<{ file: File; originalSize: number; compressedSize: number }> {
    const originalSize = file.size;

    // Skip compression for non-images or GIFs
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
        return { file, originalSize, compressedSize: originalSize };
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            let { width, height } = img;

            // Only resize if larger than maxWidth
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            ctx?.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
                        resolve({
                            file: compressedFile,
                            originalSize,
                            compressedSize: blob.size,
                        });
                    } else {
                        reject(new Error('Compression failed'));
                    }
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

// ============================================
// UPLOAD/DELETE FUNCTIONS
// ============================================

export async function uploadWithProgress(
    url: string,
    file: File,
    onProgress?: (progress: number) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
            } else {
                reject(new Error('Upload failed'));
            }
        };

        xhr.onerror = () => reject(new Error('Upload failed'));

        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
    });
}

/**
 * Smart upload to R2 with compression and tracking
 */
export async function smartUploadToR2(
    shopId: string,
    userId: string,
    folder: UploadFolder,
    file: File,
    options: {
        compress?: boolean;
        maxWidth?: number;
        quality?: number;
        onProgress?: (progress: number) => void;
        metadata?: Record<string, string>;
    } = {}
): Promise<UploadResult> {
    const {
        compress = true,
        maxWidth = 1200,
        quality = 0.8,
        onProgress,
        metadata
    } = options;

    // Validate file
    if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size exceeds 10MB limit');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
        throw new Error('File type not allowed');
    }

    // Compress if enabled and applicable
    let fileToUpload = file;
    let originalSize = file.size;
    let compressedSize = file.size;

    if (compress && file.type.startsWith('image/') && file.type !== 'image/gif') {
        const result = await compressImage(file, maxWidth, quality);
        fileToUpload = result.file;
        originalSize = result.originalSize;
        compressedSize = result.compressedSize;
    }

    // Get signed upload URL from worker
    const response = await fetch(`${R2_WORKER_URL}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            shopId,
            folder,
            filename: file.name,
            contentType: fileToUpload.type,
            size: fileToUpload.size,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get upload URL');
    }

    const { uploadUrl, key, publicUrl } = await response.json();

    // Upload with progress
    await uploadWithProgress(uploadUrl, fileToUpload, onProgress);

    // Track the upload
    storageTracker.trackUpload({
        shopId,
        key,
        url: publicUrl,
        folder,
        filename: file.name,
        contentType: fileToUpload.type,
        originalSize,
        compressedSize,
        compressionRatio: compressedSize / originalSize,
        uploadedBy: userId,
        metadata,
    });

    const compressionRatio = compressedSize / originalSize;

    return {
        key,
        url: publicUrl,
        originalSize,
        compressedSize,
        compressionRatio,
    };
}

/**
 * Delete file from R2 with tracking
 */
export async function deleteFromR2(key: string): Promise<void> {
    const response = await fetch(`${R2_WORKER_URL}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
    });

    if (!response.ok) {
        throw new Error('Failed to delete file');
    }

    // Track the deletion
    storageTracker.trackDeletion(key);
}

// ============================================
// UTILITY EXPORTS
// ============================================

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getCompressionSavingsText(original: number, compressed: number): string {
    const saved = original - compressed;
    const percentage = Math.round((1 - compressed / original) * 100);
    return `Saved ${formatBytes(saved)} (${percentage}%)`;
}

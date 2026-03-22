/**
 * Smart Upload Hook
 * 
 * Full-featured upload hook with:
 * - Smart 95% compression
 * - Upload, Update (replace), Delete operations
 * - Event tracking with history
 * - Progress stages (compressing, uploading, complete, error)
 * - Statistics calculation
 */

import { useState, useCallback, useRef } from 'react';
import { addDoc, collection, doc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/firebase';
import { smartCompressImage, formatFileSize } from '@/lib/image-compression';
import type { UploadFolder } from '@/lib/storage';
import type {
    ImageMetadata,
    ImageUploadEvent,
    SmartUploaderState,
    UploadProgress,
    ImageStats,
} from '@/types/image-upload';

const R2_WORKER_URL = import.meta.env.VITE_R2_WORKER_URL || '';

const STORAGE_STATS_DOC_ID = 'summary';

/** Log upload/delete to shop storage for Super Admin visibility */
function logStorageEvent(
    shopId: string,
    action: 'upload' | 'delete',
    data: { key: string; url?: string; folder: string; bytes: number }
): void {
    addDoc(collection(db, 'shops', shopId, 'storageEvents'), {
        action,
        key: data.key,
        ...(data.url != null && { url: data.url }),
        folder: data.folder,
        bytes: data.bytes,
        createdAt: serverTimestamp(),
    }).catch((err) => console.warn('Storage event log failed:', err));
}

/** Update shop storage summary (total bytes + image count) for Super Admin */
function updateStorageStats(shopId: string, action: 'upload' | 'delete', bytes: number): void {
    const ref = doc(db, 'shops', shopId, 'storageStats', STORAGE_STATS_DOC_ID);
    setDoc(
        ref,
        {
            totalBytes: increment(action === 'upload' ? bytes : -bytes),
            imageCount: increment(action === 'upload' ? 1 : -1),
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    ).catch((err) => console.warn('Storage stats update failed:', err));
}

interface UseSmartUploadOptions {
    folder: UploadFolder;
    shopId: string;
    maxFiles?: number;
    /** When true: compress on select but do not upload to R2 until uploadPendingImages() is called (avoids orphans if user cancels). */
    deferUpload?: boolean;
    onStateChange?: (state: SmartUploaderState) => void;
}

/**
 * Upload file to R2 via Worker (single POST with FormData)
 */
async function uploadToR2(
    shopId: string,
    folder: UploadFolder,
    file: File,
    onProgress?: (progress: number) => void
): Promise<{ key: string; url: string }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("shopId", shopId);
    formData.append("folder", folder);

    const xhr = new XMLHttpRequest();

    const result = await new Promise<{ key: string; publicUrl: string }>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve({ key: data.key, publicUrl: data.publicUrl });
                } catch {
                    reject(new Error("Invalid response"));
                }
            } else {
                try {
                    const err = JSON.parse(xhr.responseText);
                    reject(new Error(err.error || "Upload failed"));
                } catch {
                    reject(new Error("Upload failed"));
                }
            }
        };

        xhr.onerror = () => reject(new Error("Upload failed"));

        xhr.open("POST", `${R2_WORKER_URL}/upload`);
        xhr.send(formData);
    });

    return { key: result.key, url: result.publicUrl };
}

/**
 * Delete file from R2
 */
async function deleteFromR2(key: string): Promise<void> {
    const response = await fetch(`${R2_WORKER_URL}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
    });

    if (!response.ok) {
        throw new Error('Failed to delete file');
    }
}

export function useSmartUpload(options: UseSmartUploadOptions) {
    const { folder, shopId, maxFiles = 10, deferUpload = false, onStateChange } = options;

    const [images, setImages] = useState<ImageMetadata[]>([]);
    const [events, setEvents] = useState<ImageUploadEvent[]>([]);
    const [activeUploads, setActiveUploads] = useState<Map<string, UploadProgress>>(new Map());
    const pendingFilesRef = useRef<Map<string, File>>(new Map());
    const pendingDeletesRef = useRef<Map<string, number>>(new Map());

    // Calculate state for callback
    const getState = useCallback((): SmartUploaderState => {
        const totalOriginalSize = images.reduce((sum, img) => sum + img.originalSize, 0);
        const totalCompressedSize = images.reduce((sum, img) => sum + img.compressedSize, 0);
        return {
            images,
            events,
            totalOriginalSize,
            totalCompressedSize,
            totalSaved: totalOriginalSize - totalCompressedSize,
        };
    }, [images, events]);

    // Notify state change
    const notifyChange = useCallback(() => {
        onStateChange?.(getState());
    }, [getState, onStateChange]);

    // Notify with specific images (used when state hasn't committed yet, e.g. after remove)
    const notifyChangeWithImages = useCallback((imgs: ImageMetadata[]) => {
        const totalOriginalSize = imgs.reduce((sum, img) => sum + img.originalSize, 0);
        const totalCompressedSize = imgs.reduce((sum, img) => sum + img.compressedSize, 0);
        onStateChange?.({
            images: imgs,
            events,
            totalOriginalSize,
            totalCompressedSize,
            totalSaved: totalOriginalSize - totalCompressedSize,
        });
    }, [events, onStateChange]);

    // Add event to history
    const addEvent = useCallback((event: ImageUploadEvent) => {
        setEvents((prev) => [...prev, event]);
    }, []);

    // Update upload progress
    const setProgress = useCallback((imageId: string, progress: UploadProgress) => {
        setActiveUploads((prev) => {
            const next = new Map(prev);
            if (progress.stage === 'complete' || progress.stage === 'error') {
                next.delete(imageId);
            } else {
                next.set(imageId, progress);
            }
            return next;
        });
    }, []);

    /**
     * Upload new image with compression. When deferUpload is true, only compresses and stores for later upload.
     */
    const upload = useCallback(
        async (file: File): Promise<ImageMetadata | null> => {
            if (!shopId) return null;
            if (images.length >= maxFiles) {
                console.error('Max files reached');
                return null;
            }

            const imageId = uuidv4();

            try {
                setProgress(imageId, { imageId, stage: 'compressing', progress: 0 });

                const compressionOptions = folder === 'damage-photos'
                    ? { quality: 0.88, minQuality: 0.7, targetSizeKB: 600, maxWidth: 1920, maxHeight: 1920 }
                    : undefined;
                const compressed = await smartCompressImage(file, compressionOptions);

                setProgress(imageId, { imageId, stage: 'compressing', progress: 100 });

                if (deferUpload) {
                    const blobUrl = URL.createObjectURL(compressed.file);
                    pendingFilesRef.current.set(imageId, compressed.file);
                    const metadata: ImageMetadata = {
                        id: imageId,
                        key: '',
                        url: blobUrl,
                        originalName: file.name,
                        originalSize: compressed.originalSize,
                        compressedSize: compressed.compressedSize,
                        compressionRatio: compressed.compressionRatio,
                        width: compressed.width,
                        height: compressed.height,
                        mimeType: 'image/jpeg',
                        uploadedAt: new Date(),
                    };
                    setImages((prev) => [...prev, metadata]);
                    setProgress(imageId, { imageId, stage: 'complete', progress: 100 });
                    notifyChange();
                    return metadata;
                }

                setProgress(imageId, { imageId, stage: 'uploading', progress: 0 });
                const result = await uploadToR2(shopId, folder, compressed.file, (progress) => {
                    setProgress(imageId, { imageId, stage: 'uploading', progress });
                });

                const metadata: ImageMetadata = {
                    id: imageId,
                    key: result.key,
                    url: result.url,
                    originalName: file.name,
                    originalSize: compressed.originalSize,
                    compressedSize: compressed.compressedSize,
                    compressionRatio: compressed.compressionRatio,
                    width: compressed.width,
                    height: compressed.height,
                    mimeType: 'image/jpeg',
                    uploadedAt: new Date(),
                };

                setImages((prev) => [...prev, metadata]);
                addEvent({
                    type: 'upload',
                    imageId,
                    timestamp: new Date(),
                    metadata: {
                        originalSize: compressed.originalSize,
                        compressedSize: compressed.compressedSize,
                        compressionRatio: compressed.compressionRatio,
                    },
                });
                if (shopId !== 'platform') {
                    logStorageEvent(shopId, 'upload', {
                        key: result.key,
                        url: result.url,
                        folder,
                        bytes: compressed.compressedSize,
                    });
                    updateStorageStats(shopId, 'upload', compressed.compressedSize);
                }
                setProgress(imageId, { imageId, stage: 'complete', progress: 100 });
                // Notify with new images immediately (React state not updated yet)
                notifyChangeWithImages([...images, metadata]);
                return metadata;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Upload failed';
                setProgress(imageId, { imageId, stage: 'error', progress: 0, error: message });
                return null;
            }
        },
        [shopId, folder, images, maxFiles, deferUpload, addEvent, notifyChangeWithImages, setProgress]
    );

    /**
     * Update existing image (replace: delete old from R2 if it had a key, then compress/upload or store pending).
     */
    const update = useCallback(
        async (imageId: string, newFile: File): Promise<ImageMetadata | null> => {
            if (!shopId) return null;

            const existingImage = images.find((img) => img.id === imageId);
            if (!existingImage) {
                console.error('Image not found');
                return null;
            }

            try {
                setProgress(imageId, { imageId, stage: 'compressing', progress: 0 });

                const compressionOptions = folder === 'damage-photos'
                    ? { quality: 0.88, minQuality: 0.7, targetSizeKB: 600, maxWidth: 1920, maxHeight: 1920 }
                    : undefined;
                const compressed = await smartCompressImage(newFile, compressionOptions);

                setProgress(imageId, { imageId, stage: 'compressing', progress: 100 });

                if (deferUpload) {
                    if (existingImage.key) {
                        pendingDeletesRef.current.set(existingImage.key, existingImage.compressedSize);
                    }
                    if (existingImage.url.startsWith('blob:')) {
                        URL.revokeObjectURL(existingImage.url);
                    }
                    pendingFilesRef.current.delete(imageId);
                    const blobUrl = URL.createObjectURL(compressed.file);
                    pendingFilesRef.current.set(imageId, compressed.file);
                    const updatedMetadata: ImageMetadata = {
                        id: imageId,
                        key: '',
                        url: blobUrl,
                        originalName: newFile.name,
                        originalSize: compressed.originalSize,
                        compressedSize: compressed.compressedSize,
                        compressionRatio: compressed.compressionRatio,
                        width: compressed.width,
                        height: compressed.height,
                        mimeType: 'image/jpeg',
                        uploadedAt: existingImage.uploadedAt,
                        updatedAt: new Date(),
                    };
                    setImages((prev) =>
                        prev.map((img) => (img.id === imageId ? updatedMetadata : img))
                    );
                    setProgress(imageId, { imageId, stage: 'complete', progress: 100 });
                    notifyChange();
                    return updatedMetadata;
                }

                setProgress(imageId, { imageId, stage: 'uploading', progress: 0 });
                const result = await uploadToR2(shopId, folder, compressed.file, (progress) => {
                    setProgress(imageId, { imageId, stage: 'uploading', progress });
                });

                if (existingImage.key) {
                    deleteFromR2(existingImage.key).catch(console.error);
                    if (shopId !== 'platform') {
                        logStorageEvent(shopId, 'delete', {
                            key: existingImage.key,
                            folder,
                            bytes: existingImage.compressedSize,
                        });
                        updateStorageStats(shopId, 'delete', existingImage.compressedSize);
                    }
                }

                const updatedMetadata: ImageMetadata = {
                    id: imageId,
                    key: result.key,
                    url: result.url,
                    originalName: newFile.name,
                    originalSize: compressed.originalSize,
                    compressedSize: compressed.compressedSize,
                    compressionRatio: compressed.compressionRatio,
                    width: compressed.width,
                    height: compressed.height,
                    mimeType: 'image/jpeg',
                    uploadedAt: existingImage.uploadedAt,
                    updatedAt: new Date(),
                };

                setImages((prev) =>
                    prev.map((img) => (img.id === imageId ? updatedMetadata : img))
                );
                addEvent({
                    type: 'update',
                    imageId,
                    timestamp: new Date(),
                    metadata: {
                        originalSize: compressed.originalSize,
                        compressedSize: compressed.compressedSize,
                        compressionRatio: compressed.compressionRatio,
                    },
                    previousMetadata: {
                        originalSize: existingImage.originalSize,
                        compressedSize: existingImage.compressedSize,
                    },
                });
                if (shopId !== 'platform') {
                    logStorageEvent(shopId, 'upload', {
                        key: result.key,
                        url: result.url,
                        folder,
                        bytes: compressed.compressedSize,
                    });
                    updateStorageStats(shopId, 'upload', compressed.compressedSize);
                }
                setProgress(imageId, { imageId, stage: 'complete', progress: 100 });
                const newImages = images.map((img) => (img.id === imageId ? updatedMetadata : img));
                notifyChangeWithImages(newImages);
                return updatedMetadata;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Update failed';
                setProgress(imageId, { imageId, stage: 'error', progress: 0, error: message });
                return null;
            }
        },
        [shopId, folder, images, deferUpload, addEvent, notifyChangeWithImages, setProgress]
    );

    /**
     * Delete image (from R2 if it has key; revoke blob URL if pending).
     */
    const remove = useCallback(
        async (imageId: string): Promise<boolean> => {
            const image = images.find((img) => img.id === imageId);
            if (!image) return false;

            try {
                if (image.key) {
                    if (deferUpload) {
                        pendingDeletesRef.current.set(image.key, image.compressedSize);
                    } else {
                        await deleteFromR2(image.key);
                        if (shopId !== 'platform') {
                            logStorageEvent(shopId, 'delete', {
                                key: image.key,
                                folder,
                                bytes: image.compressedSize,
                            });
                            updateStorageStats(shopId, 'delete', image.compressedSize);
                        }
                    }
                }
                if (image.url.startsWith('blob:')) {
                    URL.revokeObjectURL(image.url);
                }
                pendingFilesRef.current.delete(imageId);

                const nextImages = images.filter((img) => img.id !== imageId);
                setImages(nextImages);
                addEvent({
                    type: 'delete',
                    imageId,
                    timestamp: new Date(),
                    previousMetadata: {
                        originalSize: image.originalSize,
                        compressedSize: image.compressedSize,
                    },
                });
                notifyChangeWithImages(nextImages);
                return true;
            } catch (error) {
                console.error('Delete failed:', error);
                return false;
            }
        },
        [shopId, folder, images, addEvent, notifyChangeWithImages]
    );

    /**
     * Initialize with existing images (for edit forms)
     */
    const initialize = useCallback((existingImages: ImageMetadata[]) => {
        setImages(existingImages);
        setEvents([]);
    }, []);

    /**
     * Upload all pending images (key === '') to R2. Only meaningful when deferUpload is true.
     * Call this when the user clicks Save/Submit. Returns final metadata with real URLs.
     */
    const uploadPendingImages = useCallback(async (): Promise<ImageMetadata[]> => {
        const pending = images.filter(
            (img) => !img.key && pendingFilesRef.current.has(img.id)
        );

        const updates: ImageMetadata[] = [];
        for (const img of pending) {
            const file = pendingFilesRef.current.get(img.id);
            if (!file) continue;
            try {
                setProgress(img.id, { imageId: img.id, stage: 'uploading', progress: 0 });
                const result = await uploadToR2(shopId, folder, file, (progress) => {
                    setProgress(img.id, { imageId: img.id, stage: 'uploading', progress });
                });
                if (img.url.startsWith('blob:')) {
                    URL.revokeObjectURL(img.url);
                }
                pendingFilesRef.current.delete(img.id);
                const updated: ImageMetadata = {
                    ...img,
                    key: result.key,
                    url: result.url,
                };
                updates.push(updated);
                if (shopId !== 'platform') {
                    logStorageEvent(shopId, 'upload', {
                        key: result.key,
                        url: result.url,
                        folder,
                        bytes: img.compressedSize,
                    });
                    updateStorageStats(shopId, 'upload', img.compressedSize);
                }
                setProgress(img.id, { imageId: img.id, stage: 'complete', progress: 100 });
            } catch (err) {
                console.error('Pending upload failed:', err);
                setProgress(img.id, { imageId: img.id, stage: 'error', progress: 0, error: String(err) });
            }
        }

        const finalImages = images.map((img) => {
            const u = updates.find((x) => x.id === img.id);
            return u || img;
        });
        setImages(finalImages);
        // Process queued deletes (deferUpload mode)
        if (pendingDeletesRef.current.size > 0) {
            for (const [key, bytes] of pendingDeletesRef.current.entries()) {
                try {
                    await deleteFromR2(key);
                    if (shopId !== 'platform') {
                        logStorageEvent(shopId, 'delete', {
                            key,
                            folder,
                            bytes,
                        });
                        updateStorageStats(shopId, 'delete', bytes);
                    }
                } catch (err) {
                    console.error('Pending delete failed:', err);
                }
            }
            pendingDeletesRef.current.clear();
        }
        notifyChange();
        return finalImages;
    }, [shopId, folder, images, setProgress, notifyChange]);

    /**
     * Get all URLs (for saving to database)
     */
    const getUrls = useCallback(() => {
        return images.map((img) => img.url);
    }, [images]);

    /**
     * Get all metadata (for saving to database)
     */
    const getMetadata = useCallback(() => {
        return images;
    }, [images]);

    /**
     * Get statistics
     */
    const getStats = useCallback((): ImageStats => {
        const totalOriginal = images.reduce((sum, img) => sum + img.originalSize, 0);
        const totalCompressed = images.reduce((sum, img) => sum + img.compressedSize, 0);
        const totalSaved = totalOriginal - totalCompressed;
        const avgCompression = images.length > 0
            ? Math.round(images.reduce((sum, img) => sum + img.compressionRatio, 0) / images.length)
            : 0;

        return {
            count: images.length,
            totalOriginal,
            totalCompressed,
            totalSaved,
            avgCompression,
            formatted: {
                totalOriginal: formatFileSize(totalOriginal),
                totalCompressed: formatFileSize(totalCompressed),
                totalSaved: formatFileSize(totalSaved),
            },
        };
    }, [images]);

    return {
        // State
        images,
        events,
        activeUploads: Array.from(activeUploads.values()),

        // Actions
        upload,
        update,
        remove,
        initialize,
        uploadPendingImages,

        // Getters
        getUrls,
        getMetadata,
        getStats,
        getState,

        // Computed
        canUpload: images.length < maxFiles,
        isUploading: activeUploads.size > 0,
    };
}

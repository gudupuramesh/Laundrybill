/**
 * Smart Image Uploader Component
 * 
 * Features:
 * - 95% compression with adaptive quality
 * - Shows original vs compressed size per image
 * - Upload, Replace (update), Delete operations
 * - Progress stages (compressing, uploading)
 * - Stats bar with total savings
 * - Optional event history log
 */

import React, { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSmartUpload } from '@/hooks/use-smart-upload';
import { formatFileSize } from '@/lib/image-compression';
import { LSpinner } from './LSpinner';
import { LConfirmDialog } from './LConfirmDialog';
import {
    Camera,
    Image as ImageIcon,
    Pencil,
    AlertCircle,
    CheckCircle2,
    TrendingDown,
    Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UploadFolder } from '@/lib/storage';
import type { ImageMetadata, SmartUploaderState } from '@/types/image-upload';

export interface LSmartImageUploaderRef {
    /** Upload any pending (compressed but not yet in R2) images. Call before Save when deferUpload is true. */
    uploadPendingImages: () => Promise<ImageMetadata[]>;
}

interface LSmartImageUploaderProps {
    folder: UploadFolder;
    shopId: string;
    value?: ImageMetadata[];
    onChange?: (metadata: ImageMetadata[]) => void;
    onStateChange?: (state: SmartUploaderState) => void;
    maxFiles?: number;
    showStats?: boolean;
    showEvents?: boolean;
    className?: string;
    label?: string;
    hint?: string;
    /** When true: compress on select but upload to R2 only when ref.uploadPendingImages() is called (e.g. on Save). Avoids orphan files. */
    deferUpload?: boolean;
}

export const LSmartImageUploader = forwardRef<LSmartImageUploaderRef, LSmartImageUploaderProps>(function LSmartImageUploader({
    folder,
    shopId,
    value = [],
    onChange,
    onStateChange,
    maxFiles = 5,
    showStats = true,
    showEvents = false,
    className,
    label,
    hint,
    deferUpload = false,
}, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const updateInputRef = useRef<HTMLInputElement>(null);
    const updateTargetRef = useRef<string | null>(null);
    const prevValueRef = useRef<ImageMetadata[]>(value);
    const userJustRemovedRef = useRef(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [imageIdToDelete, setImageIdToDelete] = useState<string | null>(null);

    const {
        images,
        events,
        activeUploads,
        upload,
        update,
        remove,
        initialize,
        uploadPendingImages,
        getStats,
        canUpload,
        isUploading,
    } = useSmartUpload({
        folder,
        shopId,
        maxFiles,
        deferUpload,
        onStateChange: (state) => {
            onChange?.(state.images);
            onStateChange?.(state);
        },
    });

    useImperativeHandle(ref, () => ({
        uploadPendingImages,
    }), [uploadPendingImages]);

    // Sync with value: load existing when form opens; don't overwrite after replace/upload or re-add after delete.
    useEffect(() => {
        if (value.length > 0) {
            prevValueRef.current = value;
            if (images.length === 0) {
                if (!userJustRemovedRef.current) {
                    initialize(value);
                } else {
                    userJustRemovedRef.current = false;
                }
                return;
            }
            if (images.length > 0 && value[0]?.url !== images[0]?.url) {
                return;
            }
            if (images.length > 0 && value[0]?.url === images[0]?.url) {
                return;
            }
            return;
        }
        if (images.length === 0) {
            prevValueRef.current = value;
            return;
        }
        if (prevValueRef.current.length > 0) {
            initialize([]);
        }
        prevValueRef.current = value;
    }, [value, images.length, images[0]?.url, value[0]?.url, initialize]);

    const stats = getStats();

    // Handle new file selection
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        for (const file of files) {
            if (!canUpload) break;
            await upload(file);
        }

        if (inputRef.current) inputRef.current.value = '';
    };

    // Handle update file selection
    const handleUpdateSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !updateTargetRef.current) return;

        await update(updateTargetRef.current, file);
        updateTargetRef.current = null;

        if (updateInputRef.current) updateInputRef.current.value = '';
    };

    // Trigger update for specific image
    const triggerUpdate = (imageId: string) => {
        updateTargetRef.current = imageId;
        updateInputRef.current?.click();
    };

    // Get upload progress for an image
    const getProgress = (imageId: string) => {
        return activeUploads.find((u) => u.imageId === imageId);
    };

    return (
        <div className={cn('space-y-4', className)}>
            {/* Label */}
            {label && (
                <label className="text-sm font-medium text-foreground">{label}</label>
            )}

            {/* Stats Bar */}
            {showStats && images.length > 0 && (
                <div className="flex items-center gap-4 p-3 bg-success-muted rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                        <TrendingDown className="h-5 w-5 text-success" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground font-medium">
                                {stats.avgCompression}% compressed
                            </span>
                            <span className="text-success font-medium">
                                Saved {stats.formatted.totalSaved}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{stats.formatted.totalOriginal}</span>
                            <span>→</span>
                            <span>{stats.formatted.totalCompressed}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Existing Images */}
                {images.map((image) => {
                    const progress = getProgress(image.id);
                    const isProcessing = !!progress;

                    return (
                        <div
                            key={image.id}
                            className="relative aspect-square rounded-xl overflow-hidden bg-muted group"
                        >
                            {/* Image */}
                            <img
                                src={image.url}
                                alt={image.originalName}
                                className={cn(
                                    'w-full h-full object-cover transition-opacity',
                                    isProcessing && 'opacity-50'
                                )}
                            />

                            {/* Processing Overlay */}
                            {isProcessing && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                                    <LSpinner size="md" className="text-white" />
                                    <span className="text-xs text-white mt-2 capitalize">
                                        {progress.stage}... {progress.progress}%
                                    </span>
                                </div>
                            )}

                            {/* Hover Actions */}
                            {!isProcessing && (
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => triggerUpdate(image.id)}
                                        className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                                        title="Edit image"
                                    >
                                        <Pencil className="h-5 w-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setImageIdToDelete(image.id);
                                            setDeleteConfirmOpen(true);
                                        }}
                                        className="w-10 h-10 rounded-full bg-white/20 hover:bg-destructive/80 flex items-center justify-center text-white transition-colors"
                                        title="Delete image"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                            )}

                            {/* Size Badge */}
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                <span className="px-2 py-0.5 bg-black/60 rounded text-[10px] text-white">
                                    {formatFileSize(image.compressedSize)}
                                </span>
                                <span className="px-2 py-0.5 bg-success/80 rounded text-[10px] text-white">
                                    -{image.compressionRatio}%
                                </span>
                            </div>
                        </div>
                    );
                })}

                {/* Active Uploads (new images being processed) */}
                <AnimatePresence>
                    {activeUploads
                        .filter((u) => !images.find((img) => img.id === u.imageId))
                        .map((uploadProgress) => (
                            <motion.div
                                key={uploadProgress.imageId}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="aspect-square rounded-xl bg-muted flex flex-col items-center justify-center"
                            >
                                {uploadProgress.stage === 'error' ? (
                                    <>
                                        <AlertCircle className="h-8 w-8 text-destructive" />
                                        <span className="text-xs text-destructive mt-2">
                                            {uploadProgress.error || 'Failed'}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <LSpinner size="md" />
                                        <span className="text-xs text-muted-foreground mt-2 capitalize">
                                            {uploadProgress.stage}...
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {uploadProgress.progress}%
                                        </span>
                                    </>
                                )}
                            </motion.div>
                        ))}
                </AnimatePresence>

                {/* Add Buttons */}
                {canUpload && !isUploading && (
                    <>
                        {/* Take Photo (Camera) */}
                        <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary-muted/50 transition-all flex flex-col items-center justify-center gap-2"
                        >
                            <Camera className="h-8 w-8 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Take Photo</span>
                            <span className="text-xs text-muted-foreground">
                                {images.length}/{maxFiles}
                            </span>
                        </button>

                        {/* Upload from Gallery */}
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary-muted/50 transition-all flex flex-col items-center justify-center gap-2"
                        >
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Upload from Gallery</span>
                            <span className="text-xs text-muted-foreground">
                                {images.length}/{maxFiles}
                            </span>
                        </button>
                    </>
                )}
            </div>

            {/* Events Log (optional) */}
            {showEvents && events.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-muted border-b border-border">
                        <span className="text-xs font-medium text-foreground">Upload History</span>
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                        {events
                            .slice()
                            .reverse()
                            .map((event, index) => (
                                <div
                                    key={index}
                                    className="px-3 py-2 border-b border-border last:border-b-0 flex items-center gap-2 text-xs"
                                >
                                    {event.type === 'upload' && (
                                        <CheckCircle2 className="h-3 w-3 text-success" />
                                    )}
                                    {event.type === 'update' && (
                                        <Pencil className="h-3 w-3 text-primary" />
                                    )}
                                    {event.type === 'delete' && (
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                    )}
                                    <span className="capitalize text-foreground">{event.type}</span>
                                    {event.metadata && (
                                        <span className="text-muted-foreground">
                                            ({formatFileSize(event.metadata.originalSize)} →{' '}
                                            {formatFileSize(event.metadata.compressedSize)})
                                        </span>
                                    )}
                                    <span className="text-muted-foreground ml-auto">
                                        {event.timestamp.toLocaleTimeString()}
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Hint */}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

            {/* Hidden Inputs */}
            {/* Gallery picker */}
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileSelect}
                className="hidden"
            />
            {/* Camera capture (mobile devices will offer camera directly) */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
            />
            <input
                ref={updateInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUpdateSelect}
                className="hidden"
            />

            {/* Delete confirmation */}
            <LConfirmDialog
                open={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setImageIdToDelete(null);
                }}
                onConfirm={async () => {
                    if (imageIdToDelete) {
                        userJustRemovedRef.current = true;
                        await remove(imageIdToDelete);
                        setImageIdToDelete(null);
                    }
                }}
                title="Delete image?"
                description="This image will be removed from the form. If it was already saved to storage, it will be deleted when you save."
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
            />
        </div>
    );
});

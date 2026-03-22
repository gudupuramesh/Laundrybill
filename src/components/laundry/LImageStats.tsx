/**
 * Image Stats Component
 * 
 * Displays compression statistics in compact or full mode
 */

import { formatFileSize } from '@/lib/image-compression';
import { TrendingDown, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LImageStatsProps {
    count: number;
    totalOriginal: number;
    totalCompressed: number;
    className?: string;
    compact?: boolean;
}

export function LImageStats({
    count,
    totalOriginal,
    totalCompressed,
    className,
    compact = false,
}: LImageStatsProps) {
    const saved = totalOriginal - totalCompressed;
    const compressionPercent = totalOriginal > 0
        ? Math.round((saved / totalOriginal) * 100)
        : 0;

    if (count === 0) return null;

    if (compact) {
        return (
            <div className={cn('flex items-center gap-2 text-xs', className)}>
                <ImageIcon className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{count} images</span>
                <span className="text-success">-{compressionPercent}%</span>
                <span className="text-muted-foreground">({formatFileSize(saved)} saved)</span>
            </div>
        );
    }

    return (
        <div className={cn('p-3 bg-muted rounded-xl', className)}>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success-muted flex items-center justify-center">
                    <TrendingDown className="h-5 w-5 text-success" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                            {count} image{count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-sm font-medium text-success">
                            {compressionPercent}% smaller
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                        <span>Original: {formatFileSize(totalOriginal)}</span>
                        <span>Saved: {formatFileSize(saved)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

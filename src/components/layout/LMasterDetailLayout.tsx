/**
 * Master-Detail Layout Component
 * 
 * Professional SaaS-style layout with list + detail side-by-side on desktop
 */

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { LAdSlot } from "@/components/laundry/LAdSlot";
import { AnimatePresence, motion } from "framer-motion";

interface LMasterDetailLayoutProps {
    listPanel: React.ReactNode;
    detailPanel: React.ReactNode;
    emptyState?: React.ReactNode;
    selectedId?: string | null;
    adPosition?: string;
    className?: string;
}

export function LMasterDetailLayout({
    listPanel,
    detailPanel,
    emptyState,
    selectedId,
    adPosition = "master-detail-sidebar",
    className,
}: LMasterDetailLayoutProps) {
    const isMobile = useIsMobile();

    // Mobile: Just render list (detail is separate route)
    if (isMobile) {
        return <>{listPanel}</>;
    }

    // Desktop: Side by side
    return (
        <div className={cn("flex h-[calc(100vh-64px)]", className)}>
            {/* List Panel */}
            <div className="flex-1 min-w-[320px] max-w-[400px] overflow-y-auto border-r border-border bg-card">
                {listPanel}
            </div>

            {/* Detail Panel with smooth transition */}
            <div className="flex-[1.5] min-w-[400px] overflow-y-auto bg-background">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={selectedId || "empty"}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="h-full"
                    >
                        {selectedId ? detailPanel : emptyState || <DefaultEmptyState />}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Ad Slot - xl screens only */}
            <LAdSlot variant="sidebar" position={adPosition} />
        </div>
    );
}

function DefaultEmptyState() {
    return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <span className="text-2xl">📋</span>
            </div>
            <p className="text-lg font-medium">Select an item</p>
            <p className="text-sm">Choose from the list to view details</p>
        </div>
    );
}

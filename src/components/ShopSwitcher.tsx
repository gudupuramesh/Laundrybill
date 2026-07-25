/**
 * Shop switcher — shows the ACTIVE shop name; multi-shop owners get a dropdown
 * to jump between their shops, open the All-shops overview, or add a shop.
 * Single-shop owners and team members see plain text (zero UI change).
 */
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronsUpDown, Check, LayoutGrid, Plus, Store } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useShopLimits } from "@/hooks/use-shop-limits";

export function ShopSwitcher({ className }: { className?: string }) {
    const { shopId, shopName, user, ownedShops, switchShop } = useAuth();
    const { plan } = useShopLimits();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    const label = shopName || user?.displayName || "My shop";

    // A multi-shop-capable plan (Franchise) unlocks the menu even with ONE shop —
    // otherwise there'd be no way to add shop #2. Team members (0 owned shops)
    // and single-shop owners on single-shop plans see plain text, like before.
    const multiShopPlan = (plan?.limits?.maxShops ?? 1) > 1;
    const showMenu = ownedShops.length > 1 || (ownedShops.length === 1 && multiShopPlan);
    if (!showMenu) {
        return <p className={className || "text-sm font-medium text-foreground truncate"}>{label}</p>;
    }

    return (
        <div ref={wrapRef} className="relative min-w-0">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 -mx-1.5 text-left hover:bg-muted transition-colors"
                title="Switch shop"
            >
                <span className="text-sm font-medium text-foreground truncate">{label}</span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>

            {open && (
                <div className="absolute bottom-full left-0 z-50 mb-2 w-60 rounded-xl border border-border bg-popover p-1.5 shadow-lg">
                    <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Your shops
                    </p>
                    {ownedShops.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                                switchShop(s.id);
                                setOpen(false);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted transition-colors"
                        >
                            <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate font-medium text-foreground">{s.name}</span>
                            {s.id === shopId && <Check className="h-4 w-4 shrink-0 text-primary" />}
                        </button>
                    ))}
                    <div className="my-1 border-t border-border" />
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            navigate("/shops");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted transition-colors"
                    >
                        <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium text-foreground">All shops</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            navigate("/shops/new");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted transition-colors"
                    >
                        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium text-foreground">Add shop</span>
                    </button>
                </div>
            )}
        </div>
    );
}

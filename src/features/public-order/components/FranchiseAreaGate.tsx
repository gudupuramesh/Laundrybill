/**
 * Franchise area gate — the first step on a multi-shop owner's public booking
 * page. The customer picks their area; that decides WHICH branch the whole
 * booking runs against (menu, prices, slots, and where the order lands).
 */
import { useMemo, useState } from "react";
import { MapPin, Search, Store, ChevronRight } from "lucide-react";
import type { FranchiseBranch } from "../hooks/use-franchise-branches";

export function FranchiseAreaGate({
  branches,
  onSelect,
}: {
  branches: FranchiseBranch[];
  onSelect: (branch: FranchiseBranch, area: string) => void;
}) {
  const [search, setSearch] = useState("");

  // Flatten to (area, branch) rows; if two branches serve the same area name,
  // the FIRST branch in the list wins (entry shop first, then oldest by name).
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: { area: string; branch: FranchiseBranch }[] = [];
    branches.forEach((b) => {
      b.areas.forEach((area) => {
        const key = area.trim().toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ area, branch: b });
      });
    });
    const q = search.trim().toLowerCase();
    return q ? out.filter((r) => r.area.toLowerCase().includes(q)) : out;
  }, [branches, search]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-4 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MapPin className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-lg font-bold text-foreground">Select your area</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll connect you to the branch that serves your area.
          </p>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your area…"
            className="w-full bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2 pb-8">
          {rows.map((r) => (
            <button
              key={`${r.branch.shop.id}_${r.area}`}
              type="button"
              onClick={() => onSelect(r.branch, r.area)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left shadow-sm transition-colors hover:border-primary/60"
            >
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{r.area}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Store className="h-3 w-3" />
                  <span className="truncate">{r.branch.shop.name}</span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
          {rows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No matching area. Try a different spelling, or contact the shop directly.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

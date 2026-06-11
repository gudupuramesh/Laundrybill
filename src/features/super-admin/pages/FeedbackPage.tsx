/**
 * Feedback Page (Super Admin)
 *
 * Lists feedback / issue reports submitted by shop owners from the mobile app
 * ("Send Feedback" in Settings). Super admins can mark items resolved/reopen
 * or delete them. Data lives in the top-level `feedback` collection.
 */

import { useEffect, useMemo, useState } from "react";
import { LCard, LButton, LPageLoader } from "@/components/laundry";
import {
  MessageSquare,
  Bug,
  Lightbulb,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Smartphone,
  Inbox,
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type FeedbackType = "issue" | "suggestion" | "other";
type FeedbackStatus = "new" | "resolved";

interface FeedbackItem {
  id: string;
  type?: FeedbackType;
  message?: string;
  shopId?: string | null;
  shopName?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  platform?: string;
  appVersion?: string;
  status?: FeedbackStatus;
  createdAt?: { toDate?: () => Date } | null;
}

const TYPE_META: Record<FeedbackType, { label: string; icon: typeof Bug; cls: string }> = {
  issue: { label: "Issue", icon: Bug, cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  suggestion: {
    label: "Suggestion",
    icon: Lightbulb,
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  other: {
    label: "Other",
    icon: MessageSquare,
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
};

function fmtDate(ts?: { toDate?: () => Date } | null): string {
  try {
    const d = ts?.toDate?.();
    if (!d) return "";
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function FeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | FeedbackStatus>("all");

  useEffect(() => {
    const q = query(collection(db, "feedback"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeedbackItem, "id">) })));
        setLoading(false);
      },
      (err) => {
        console.error("Feedback load failed:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const counts = useMemo(() => {
    const c = { all: items.length, new: 0, resolved: 0 };
    items.forEach((i) => {
      if ((i.status ?? "new") === "resolved") c.resolved++;
      else c.new++;
    });
    return c;
  }, [items]);

  const filtered = useMemo(
    () => items.filter((i) => (filter === "all" ? true : (i.status ?? "new") === filter)),
    [items, filter]
  );

  const setStatus = (id: string, status: FeedbackStatus) =>
    updateDoc(doc(db, "feedback", id), { status }).catch((e) => alert(e?.message || "Update failed"));

  const remove = (id: string) => {
    if (!window.confirm("Delete this feedback permanently?")) return;
    deleteDoc(doc(db, "feedback", id)).catch((e) => alert(e?.message || "Delete failed"));
  };

  if (loading) return <LPageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Feedback</h1>
          <p className="text-sm text-muted-foreground">Issues & suggestions from shop owners</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "all", label: `All (${counts.all})` },
          { key: "new", label: `New (${counts.new})` },
          { key: "resolved", label: `Resolved (${counts.resolved})` },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={
              "rounded-full px-4 py-1.5 text-sm font-semibold transition " +
              (filter === f.key
                ? "bg-blue-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/70")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <LCard className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground" />
          <p className="font-semibold text-foreground">No feedback here</p>
          <p className="text-sm text-muted-foreground">
            {filter === "all" ? "No feedback has been submitted yet." : `No ${filter} feedback.`}
          </p>
        </LCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const meta = TYPE_META[(item.type ?? "other") as FeedbackType] ?? TYPE_META.other;
            const Icon = meta.icon;
            const isResolved = (item.status ?? "new") === "resolved";
            return (
              <LCard key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold " + meta.cls}>
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                    {isResolved ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        New
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(item.createdAt)}</span>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{item.message}</p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {item.shopName ? <span className="font-medium text-foreground">{item.shopName}</span> : null}
                  {item.userEmail ? <span>{item.userEmail}</span> : null}
                  {item.platform ? (
                    <span className="inline-flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      {item.platform === "ios" ? "iOS" : item.platform} {item.appVersion ? `· v${item.appVersion}` : ""}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
                  {isResolved ? (
                    <LButton variant="ghost" size="sm" onClick={() => setStatus(item.id, "new")}>
                      <RotateCcw className="mr-1 h-4 w-4" /> Reopen
                    </LButton>
                  ) : (
                    <LButton variant="ghost" size="sm" onClick={() => setStatus(item.id, "resolved")}>
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Mark resolved
                    </LButton>
                  )}
                  <LButton variant="ghost" size="sm" onClick={() => remove(item.id)}>
                    <Trash2 className="mr-1 h-4 w-4 text-red-500" /> Delete
                  </LButton>
                </div>
              </LCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

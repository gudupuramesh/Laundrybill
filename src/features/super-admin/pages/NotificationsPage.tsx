/**
 * Push Notifications Management Page
 *
 * - Configure upgrade reminder settings (interval, message, enable/disable)
 * - Send custom notifications to user segments
 * - View notification history
 */

import { useEffect, useState } from "react";
import { LCard, LButton, LPageLoader } from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import { Bell, Send, Settings, Clock, Users, History, ToggleLeft, ToggleRight } from "lucide-react";
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";

interface NotificationConfig {
  upgradeRemindersEnabled: boolean;
  upgradeReminderIntervalDays: number;
  upgradeReminderTitle: string;
  upgradeReminderBody: string;
}

interface NotificationHistoryEntry {
  id: string;
  title: string;
  body: string;
  target: string;
  totalShops: number;
  totalSent: number;
  totalFailed: number;
  sentAt: any;
}

const DEFAULT_CONFIG: NotificationConfig = {
  upgradeRemindersEnabled: true,
  upgradeReminderIntervalDays: 2,
  upgradeReminderTitle: "Upgrade to Pro",
  upgradeReminderBody: "Get unlimited orders, reports & more. Upgrade to Pro today!",
};

const TARGET_OPTIONS = [
  { value: "all", label: "All Users", desc: "Every registered shop" },
  { value: "free", label: "Free Plan", desc: "Free tier users only" },
  { value: "trial", label: "Trial Users", desc: "Currently on trial" },
  { value: "pro", label: "Pro Users", desc: "Active Pro subscribers" },
];

export function NotificationsPage() {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [config, setConfig] = useState<NotificationConfig>(DEFAULT_CONFIG);
  const [history, setHistory] = useState<NotificationHistoryEntry[]>([]);

  // Send form
  const [sendTitle, setSendTitle] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sendTarget, setSendTarget] = useState("all");
  const [sendResult, setSendResult] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load config
      const configSnap = await getDoc(doc(db, "platformSettings", "notifications"));
      if (configSnap.exists()) {
        const d = configSnap.data();
        setConfig({
          upgradeRemindersEnabled: d.upgradeRemindersEnabled ?? true,
          upgradeReminderIntervalDays: d.upgradeReminderIntervalDays ?? 2,
          upgradeReminderTitle: d.upgradeReminderTitle ?? DEFAULT_CONFIG.upgradeReminderTitle,
          upgradeReminderBody: d.upgradeReminderBody ?? DEFAULT_CONFIG.upgradeReminderBody,
        });
      }

      // Load history
      const historySnap = await getDocs(
        query(
          collection(db, "platformSettings", "notifications", "history"),
          orderBy("sentAt", "desc"),
          limit(20)
        )
      );
      setHistory(historySnap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationHistoryEntry)));
    } catch (e) {
      console.error("Failed to load notification settings:", e);
    }
    setLoading(false);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "platformSettings", "notifications"), {
        ...config,
        updatedAt: new Date(),
      }, { merge: true });
    } catch (e) {
      console.error("Failed to save config:", e);
    }
    setSaving(false);
  };

  const handleSendNotification = async () => {
    if (!sendTitle.trim() || !sendBody.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      const fn = httpsCallable(functions, "sendAdminNotification");
      const result = await fn({ title: sendTitle.trim(), body: sendBody.trim(), target: sendTarget });
      const data = result.data as any;
      setSendResult(`Sent to ${data.totalShops} shops. ${data.totalSent} delivered, ${data.totalFailed} failed.`);
      setSendTitle("");
      setSendBody("");
      // Refresh history
      loadData();
    } catch (e: any) {
      setSendResult(`Error: ${e.message}`);
    }
    setSending(false);
  };

  const formatDate = (val: any) => {
    if (!val) return "—";
    const d = val.toDate ? val.toDate() : new Date(val.seconds ? val.seconds * 1000 : val);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return <LPageLoader />;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-blue-600" />
            Push Notifications
          </h1>
          <p className="text-sm text-muted-foreground">Configure reminders & send announcements</p>
        </div>
      </div>

      <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>

        {/* ─── Upgrade Reminders Config ─────────────────────── */}
        <LCard variant="elevated" padding={isMobile ? "md" : "lg"} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Settings className="h-4 w-4 text-orange-500" />
              Upgrade Reminders
            </h2>
            <button
              onClick={() => {
                const updated = { ...config, upgradeRemindersEnabled: !config.upgradeRemindersEnabled };
                setConfig(updated);
              }}
              className="flex items-center gap-1 text-sm font-medium"
            >
              {config.upgradeRemindersEnabled ? (
                <ToggleRight className="h-6 w-6 text-green-600" />
              ) : (
                <ToggleLeft className="h-6 w-6 text-gray-400" />
              )}
              <span className={config.upgradeRemindersEnabled ? "text-green-600" : "text-gray-400"}>
                {config.upgradeRemindersEnabled ? "ON" : "OFF"}
              </span>
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Interval (days)
              </label>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <select
                  value={config.upgradeReminderIntervalDays}
                  onChange={(e) => setConfig({ ...config, upgradeReminderIntervalDays: parseInt(e.target.value) })}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value={1}>Every day</option>
                  <option value={2}>Every 2 days</option>
                  <option value={3}>Every 3 days</option>
                  <option value={5}>Every 5 days</option>
                  <option value={7}>Every week</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</label>
              <input
                type="text"
                value={config.upgradeReminderTitle}
                onChange={(e) => setConfig({ ...config, upgradeReminderTitle: e.target.value })}
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message</label>
              <textarea
                value={config.upgradeReminderBody}
                onChange={(e) => setConfig({ ...config, upgradeReminderBody: e.target.value })}
                rows={3}
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>

            <LButton onClick={saveConfig} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Settings"}
            </LButton>
          </div>
        </LCard>

        {/* ─── Send Custom Notification ────────────────────── */}
        <LCard variant="elevated" padding={isMobile ? "md" : "lg"} className="space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Send className="h-4 w-4 text-blue-500" />
            Send Notification
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {TARGET_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSendTarget(opt.value)}
                    className={`text-left rounded-lg border p-2 transition-colors ${
                      sendTarget === opt.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-input hover:bg-accent"
                    }`}
                  >
                    <span className={`text-sm font-semibold ${sendTarget === opt.value ? "text-blue-700 dark:text-blue-300" : ""}`}>
                      {opt.label}
                    </span>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</label>
              <input
                type="text"
                value={sendTitle}
                onChange={(e) => setSendTitle(e.target.value)}
                placeholder="e.g. New Feature: QR Code Scanning"
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message</label>
              <textarea
                value={sendBody}
                onChange={(e) => setSendBody(e.target.value)}
                placeholder="e.g. Scan garment QR codes to instantly track items..."
                rows={3}
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>

            <LButton
              onClick={handleSendNotification}
              disabled={sending || !sendTitle.trim() || !sendBody.trim()}
              className="w-full"
            >
              {sending ? "Sending..." : "Send Now"}
            </LButton>

            {sendResult && (
              <div className={`text-sm p-2 rounded-md ${sendResult.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {sendResult}
              </div>
            )}
          </div>
        </LCard>
      </div>

      {/* ─── Notification History ───────────────────────────── */}
      <LCard variant="elevated" padding={isMobile ? "md" : "lg"}>
        <h2 className="text-base font-bold flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-purple-500" />
          Notification History
        </h2>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No notifications sent yet</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between p-3 rounded-lg bg-accent/50 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{entry.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{entry.body}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium capitalize">
                      {entry.target}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" /> {entry.totalShops} shops
                    </span>
                    <span className="text-xs text-green-600 font-medium">{entry.totalSent} sent</span>
                    {entry.totalFailed > 0 && (
                      <span className="text-xs text-red-500 font-medium">{entry.totalFailed} failed</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(entry.sentAt)}</span>
              </div>
            ))}
          </div>
        )}
      </LCard>
    </div>
  );
}

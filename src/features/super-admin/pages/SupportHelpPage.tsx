/**
 * Super Admin – Support & Help
 *
 * Single page to configure all help/support content:
 * - Contact (phone, WhatsApp, email, working hours)
 * - Welcome (first-time message + video link)
 * - Per-page video + doc links (New Order, Staff, Expenses, etc.)
 * - Optional: extra video tutorials and support docs list
 */

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  LCard,
  LButton,
  LTextInput,
  LTextArea,
  LPageLoader,
  useLToast,
} from "@/components/laundry";
import { useSuperAdmin } from "../SuperAdminAuthContext";
import {
  Phone,
  Mail,
  MessageCircle,
  Clock,
  Video,
  FileText,
  Save,
  HelpCircle,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  SupportVideo,
  SupportDoc,
  PageHelpEntry,
} from "@/types/support";
import {
  SUPPORT_PAGE_IDS,
  SUPPORT_PAGE_TITLES,
} from "@/types/support";

interface SupportHelpState {
  supportPhone: string;
  whatsappNumber: string;
  supportEmail: string;
  workingHours: string;
  welcomeMessage: string;
  gettingStartedVideoUrl: string;
  pageHelp: PageHelpEntry[];
  supportVideos: SupportVideo[];
  supportDocs: SupportDoc[];
}

const DEFAULT_PAGE_HELP: PageHelpEntry[] = SUPPORT_PAGE_IDS.map((pageId) => ({
  pageId,
  pageTitle: SUPPORT_PAGE_TITLES[pageId],
  videoUrl: "",
  docUrl: "",
}));

const DEFAULT_STATE: SupportHelpState = {
  supportPhone: "",
  whatsappNumber: "",
  supportEmail: "",
  workingHours: "",
  welcomeMessage: "",
  gettingStartedVideoUrl: "",
  pageHelp: DEFAULT_PAGE_HELP,
  supportVideos: [],
  supportDocs: [],
};

export function SupportHelpPage() {
  const { superAdmin } = useSuperAdmin();
  const { addToast } = useLToast();
  const [state, setState] = useState<SupportHelpState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [supportSnap, brandingSnap] = await Promise.all([
          getDoc(doc(db, "platformSettings", "support")),
          getDoc(doc(db, "platformSettings", "emailBranding")),
        ]);
        if (!mounted) return;

        const supportData = supportSnap.exists() ? supportSnap.data() : null;
        const branding = brandingSnap.exists() ? brandingSnap.data() : null;

        const pageHelp: PageHelpEntry[] = SUPPORT_PAGE_IDS.map((pageId) => {
          const existing = Array.isArray(supportData?.pageHelp)
            ? supportData.pageHelp.find((p: PageHelpEntry) => p.pageId === pageId)
            : null;
          return {
            pageId,
            pageTitle: SUPPORT_PAGE_TITLES[pageId],
            videoUrl: existing?.videoUrl ?? "",
            docUrl: existing?.docUrl ?? "",
          };
        });

        setState({
          supportPhone:
            supportData?.supportPhone ?? branding?.supportPhone ?? "",
          whatsappNumber:
            supportData?.whatsappNumber ?? branding?.whatsappNumber ?? "",
          supportEmail:
            supportData?.supportEmail ?? branding?.supportEmail ?? "",
          workingHours: supportData?.workingHours ?? "",
          welcomeMessage: supportData?.welcomeMessage ?? "",
          gettingStartedVideoUrl:
            supportData?.gettingStartedVideoUrl ?? "",
          pageHelp,
          supportVideos: Array.isArray(supportData?.supportVideos)
            ? supportData.supportVideos
            : [],
          supportDocs: Array.isArray(supportData?.supportDocs)
            ? supportData.supportDocs
            : [],
        });
      } catch (e) {
        if (mounted) addToast({ type: "error", title: "Failed to load" });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [addToast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "platformSettings", "support"),
        {
          supportPhone: state.supportPhone,
          whatsappNumber: state.whatsappNumber,
          supportEmail: state.supportEmail,
          workingHours: state.workingHours,
          welcomeMessage: state.welcomeMessage.trim() || null,
          gettingStartedVideoUrl: state.gettingStartedVideoUrl.trim() || null,
          pageHelp: state.pageHelp,
          supportVideos: state.supportVideos,
          supportDocs: state.supportDocs,
          updatedAt: serverTimestamp(),
          updatedBy: superAdmin?.id ?? "unknown",
        },
        { merge: true }
      );
      addToast({ type: "success", title: "Support & Help saved" });
    } catch (e) {
      addToast({ type: "error", title: "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const updatePageHelp = (index: number, field: "videoUrl" | "docUrl", value: string) => {
    setState((prev) => ({
      ...prev,
      pageHelp: prev.pageHelp.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      ),
    }));
  };

  const addSupportVideo = () => {
    setState((prev) => ({
      ...prev,
      supportVideos: [
        ...prev.supportVideos,
        { id: crypto.randomUUID(), title: "", url: "" },
      ],
    }));
  };
  const updateSupportVideo = (index: number, field: "title" | "url", value: string) => {
    setState((prev) => ({
      ...prev,
      supportVideos: prev.supportVideos.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      ),
    }));
  };
  const removeSupportVideo = (index: number) => {
    setState((prev) => ({
      ...prev,
      supportVideos: prev.supportVideos.filter((_, i) => i !== index),
    }));
  };

  const addSupportDoc = () => {
    setState((prev) => ({
      ...prev,
      supportDocs: [
        ...prev.supportDocs,
        { id: crypto.randomUUID(), title: "", url: "" },
      ],
    }));
  };
  const updateSupportDoc = (index: number, field: "title" | "url", value: string) => {
    setState((prev) => ({
      ...prev,
      supportDocs: prev.supportDocs.map((d, i) =>
        i === index ? { ...d, [field]: value } : d
      ),
    }));
  };
  const removeSupportDoc = (index: number) => {
    setState((prev) => ({
      ...prev,
      supportDocs: prev.supportDocs.filter((_, i) => i !== index),
    }));
  };

  if (loading) return <LPageLoader message="Loading Support & Help..." />;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Support & Help
            </h1>
            <p className="text-sm text-muted-foreground">
              Contact details, welcome message, and per-page video/docs for the Help page
            </p>
          </div>
        </div>
        <LButton
          onClick={handleSave}
          loading={saving}
          leftIcon={<Save className="h-4 w-4" />}
        >
          Save all
        </LButton>
      </div>

      {/* Contact */}
      <LCard className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Contact
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LTextInput
            label="Support phone"
            placeholder="+91 98765 43210"
            value={state.supportPhone}
            onChange={(e) => setState((s) => ({ ...s, supportPhone: e.target.value }))}
            leftIcon={<Phone className="h-4 w-4" />}
          />
          <LTextInput
            label="WhatsApp number"
            placeholder="919876543210"
            value={state.whatsappNumber}
            onChange={(e) => setState((s) => ({ ...s, whatsappNumber: e.target.value }))}
            hint="No + or spaces"
            leftIcon={<MessageCircle className="h-4 w-4" />}
          />
          <LTextInput
            label="Support email"
            type="email"
            placeholder="support@laundrybill.com"
            value={state.supportEmail}
            onChange={(e) => setState((s) => ({ ...s, supportEmail: e.target.value }))}
            leftIcon={<Mail className="h-4 w-4" />}
            className="md:col-span-2"
          />
          <LTextInput
            label="Working hours"
            placeholder="Mon–Fri 9:00 AM – 6:00 PM IST"
            value={state.workingHours}
            onChange={(e) => setState((s) => ({ ...s, workingHours: e.target.value }))}
            leftIcon={<Clock className="h-4 w-4" />}
            className="md:col-span-2"
          />
        </div>
      </LCard>

      {/* Welcome (first-time) */}
      <LCard className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          Welcome notification (first-time login)
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Shown once to new shop owners on the dashboard.
        </p>
        <div className="space-y-4">
          <LTextArea
            label="Welcome message"
            placeholder="Thank you for registering with LaundryBill! Watch the video below to place your first order and explore the dashboard."
            value={state.welcomeMessage}
            onChange={(e) => setState((s) => ({ ...s, welcomeMessage: e.target.value }))}
            rows={3}
          />
          <LTextInput
            label="Getting started / dashboard overview video URL"
            placeholder="https://youtube.com/watch?v=..."
            value={state.gettingStartedVideoUrl}
            onChange={(e) => setState((s) => ({ ...s, gettingStartedVideoUrl: e.target.value }))}
          />
        </div>
      </LCard>

      {/* Per-page video + doc */}
      <LCard className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Per-page help (video + documentation link)
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Each app page can have its own YouTube link and doc link. Users see these when they open Help or click the help icon on that page.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-foreground">
                  Page
                </th>
                <th className="text-left py-2 pr-4 font-medium text-foreground">
                  Video URL (e.g. YouTube)
                </th>
                <th className="text-left py-2 font-medium text-foreground">
                  Documentation URL
                </th>
              </tr>
            </thead>
            <tbody>
              {state.pageHelp.map((entry, index) => (
                <tr key={entry.pageId} className="border-b border-border/70">
                  <td className="py-3 pr-4 font-medium text-foreground align-top pt-3">
                    {entry.pageTitle}
                  </td>
                  <td className="py-2 pr-4 align-top">
                    <input
                      type="url"
                      placeholder="https://youtube.com/..."
                      value={entry.videoUrl}
                      onChange={(e) =>
                        updatePageHelp(index, "videoUrl", e.target.value)
                      }
                      className="w-full min-w-[200px] h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </td>
                  <td className="py-2 align-top">
                    <input
                      type="url"
                      placeholder="https://docs..."
                      value={entry.docUrl}
                      onChange={(e) =>
                        updatePageHelp(index, "docUrl", e.target.value)
                      }
                      className="w-full min-w-[200px] h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LCard>

      {/* Extra video tutorials (optional list) */}
      <LCard className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          Extra video tutorials
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Additional videos shown on the Help page (title + URL). Optional.
        </p>
        <div className="space-y-3">
          {state.supportVideos.map((v, i) => (
            <div key={v.id} className="flex gap-2 items-end flex-wrap">
              <LTextInput
                placeholder="Title"
                value={v.title}
                onChange={(e) => updateSupportVideo(i, "title", e.target.value)}
                className="flex-1 min-w-[140px]"
              />
              <LTextInput
                placeholder="URL"
                value={v.url}
                onChange={(e) => updateSupportVideo(i, "url", e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <LButton
                variant="ghost"
                size="icon"
                onClick={() => removeSupportVideo(i)}
                className="text-destructive shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </LButton>
            </div>
          ))}
          <LButton variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={addSupportVideo}>
            Add video
          </LButton>
        </div>
      </LCard>

      {/* Extra support docs (optional list) */}
      <LCard className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Extra support docs / links
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Additional doc links shown on the Help page. Optional.
        </p>
        <div className="space-y-3">
          {state.supportDocs.map((d, i) => (
            <div key={d.id} className="flex gap-2 items-end flex-wrap">
              <LTextInput
                placeholder="Title"
                value={d.title}
                onChange={(e) => updateSupportDoc(i, "title", e.target.value)}
                className="flex-1 min-w-[140px]"
              />
              <LTextInput
                placeholder="URL"
                value={d.url}
                onChange={(e) => updateSupportDoc(i, "url", e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <LButton
                variant="ghost"
                size="icon"
                onClick={() => removeSupportDoc(i)}
                className="text-destructive shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </LButton>
            </div>
          ))}
          <LButton variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={addSupportDoc}>
            Add doc
          </LButton>
        </div>
      </LCard>

      <div className="flex justify-end">
        <LButton size="lg" onClick={handleSave} loading={saving} leftIcon={<Save className="h-4 w-4" />}>
          Save all
        </LButton>
      </div>
    </div>
  );
}

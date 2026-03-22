/**
 * Fetch support settings for the Help page.
 *
 * 1. Tries platformSettings/support (the dedicated doc).
 * 2. If it doesn't exist or is empty, falls back to platformSettings/emailBranding
 *    where the Super Admin already stores support contacts and legacy video/docs URLs.
 *
 * Both docs are readable by any authenticated user (Firestore rule).
 */

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SupportSettings } from "@/types/support";

const DEFAULT_SUPPORT: SupportSettings = {
  supportPhone: "",
  whatsappNumber: "",
  supportEmail: "",
  workingHours: "",
  supportVideos: [],
  supportDocs: [],
  welcomeMessage: "",
  gettingStartedVideoUrl: "",
};

/** Check whether a SupportSettings-like object has any meaningful content */
function hasContent(d: SupportSettings | Record<string, unknown>): boolean {
  const hasPageHelp =
    Array.isArray(d.pageHelp) &&
    d.pageHelp.some(
      (p: { videoUrl?: string; docUrl?: string }) =>
        (p.videoUrl && p.videoUrl.trim()) || (p.docUrl && p.docUrl.trim())
    );
  return !!(
    d.supportPhone ||
    d.whatsappNumber ||
    d.supportEmail ||
    d.workingHours ||
    hasPageHelp ||
    (Array.isArray(d.supportVideos) && d.supportVideos.length > 0) ||
    (Array.isArray(d.supportDocs) && d.supportDocs.length > 0)
  );
}

/** Check if we have first-time welcome content to show */
export function hasWelcomeContent(d: SupportSettings): boolean {
  return !!(d.welcomeMessage?.trim() || d.gettingStartedVideoUrl?.trim());
}

/** Build SupportSettings from a Firestore doc snapshot data object */
function parseSupportDoc(d: Record<string, unknown>): SupportSettings {
  return {
    supportPhone: (d.supportPhone as string) ?? "",
    whatsappNumber: (d.whatsappNumber as string) ?? "",
    supportEmail: (d.supportEmail as string) ?? "",
    workingHours: (d.workingHours as string) ?? "",
    supportVideos: Array.isArray(d.supportVideos) ? d.supportVideos : [],
    supportDocs: Array.isArray(d.supportDocs) ? d.supportDocs : [],
    welcomeMessage: (d.welcomeMessage as string) ?? "",
    gettingStartedVideoUrl: (d.gettingStartedVideoUrl as string) ?? "",
    pageHelp: Array.isArray(d.pageHelp) ? d.pageHelp : [],
  };
}

/** Build SupportSettings from emailBranding doc (legacy fallback) */
function parseEmailBrandingDoc(d: Record<string, unknown>): SupportSettings {
  const videoUrl = ((d.videoTutorialUrl as string) ?? "").trim();
  const docsUrl = ((d.helpDocsUrl as string) ?? "").trim();

  return {
    supportPhone: (d.supportPhone as string) ?? "",
    whatsappNumber: (d.whatsappNumber as string) ?? "",
    supportEmail: (d.supportEmail as string) ?? "",
    workingHours: "",
    supportVideos: videoUrl
      ? [{ id: "legacy-video", title: "Video Tutorial", url: videoUrl }]
      : [],
    supportDocs: docsUrl
      ? [{ id: "legacy-doc", title: "Help Docs", url: docsUrl }]
      : [],
    welcomeMessage: "",
    gettingStartedVideoUrl: videoUrl || "",
    pageHelp: [],
  };
}

export function useSupportSettings() {
  const [data, setData] = useState<SupportSettings>(DEFAULT_SUPPORT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        // 1. Try dedicated support doc first
        const supportSnap = await getDoc(doc(db, "platformSettings", "support"));
        if (!mounted) return;

        if (supportSnap.exists() && hasContent(supportSnap.data())) {
          setData(parseSupportDoc(supportSnap.data()));
          return;
        }

        // 2. Fallback: read emailBranding (contains legacy support contacts + video/docs URLs)
        const brandingSnap = await getDoc(doc(db, "platformSettings", "emailBranding"));
        if (!mounted) return;

        if (brandingSnap.exists()) {
          const parsed = parseEmailBrandingDoc(brandingSnap.data());
          if (hasContent(parsed)) {
            setData(parsed);
            return;
          }
        }

        // Neither doc has content – leave default (empty → "No help content yet")
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load support info");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  return { data, loading, error };
}

/**
 * Help Quick Sheet – popup on Help icon click from any page.
 * Shows page-specific video preview + documentation link, "Go to Help page", and "Got it".
 */

import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSupportSettings } from "@/hooks/use-support-settings";
import { getYoutubeThumbnailUrl } from "@/lib/youtube-thumbnail";
import type { PageHelpEntry } from "@/types/support";
import { LButton, LResponsiveDialog, LSpinner } from "@/components/laundry";
import { FileText, ExternalLink } from "lucide-react";

const PLACEHOLDER_THUMB = "https://placehold.co/320x180?text=Video";

/** Map pathname to pageHelp pageId */
function pathnameToPageId(pathname: string): string | null {
  if (pathname.startsWith("/new-order")) return "newOrder";
  if (pathname.startsWith("/manage-staff")) return "staff";
  if (pathname.startsWith("/inventory")) return "services";
  if (pathname.startsWith("/expenses")) return "expenses";
  if (pathname.startsWith("/attendance")) return "attendance";
  if (pathname.startsWith("/payroll")) return "payroll";
  if (pathname.startsWith("/apps")) return "apps";
  if (pathname.includes("/public-page")) return "publicOrdering";
  return null;
}

interface HelpQuickSheetProps {
  open: boolean;
  onClose: () => void;
}

export function HelpQuickSheet({ open, onClose }: HelpQuickSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, loading } = useSupportSettings();

  const pageId = pathnameToPageId(location.pathname);
  const pageHelpEntries = (data.pageHelp ?? []).filter(
    (p: PageHelpEntry) => (p.videoUrl?.trim() || p.docUrl?.trim())
  );
  const pageEntry = pageId
    ? pageHelpEntries.find((p: PageHelpEntry) => p.pageId === pageId)
    : null;

  // Fallback: dashboard or unknown page – use getting started video or first video + first doc
  const fallbackVideoUrl = data.gettingStartedVideoUrl?.trim() ||
    data.supportVideos?.[0]?.url?.trim() ||
    "";
  const fallbackDocUrl = data.supportDocs?.[0]?.url?.trim() || "";
  const fallbackTitle = data.supportVideos?.[0]?.title || data.supportDocs?.[0]?.title || t("help.quickHelp", "Quick help");

  const videoUrl = pageEntry?.videoUrl?.trim() || fallbackVideoUrl;
  const docUrl = pageEntry?.docUrl?.trim() || fallbackDocUrl;
  const title = pageEntry?.pageTitle || fallbackTitle;

  const hasVideo = !!videoUrl;
  const hasDoc = !!docUrl;
  const hasAny = hasVideo || hasDoc;

  const goToHelpPage = () => {
    onClose();
    navigate("/help");
  };

  return (
    <LResponsiveDialog
      open={open}
      onClose={onClose}
      title={title}
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <LSpinner size="lg" />
        </div>
      ) : (
        <div className="space-y-4">
          {hasVideo && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">{t("help.videoPreview", "Video")}</p>
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-border overflow-hidden bg-muted hover:border-primary/50 transition-colors"
              >
                <div className="aspect-video relative">
                  <img
                    src={getYoutubeThumbnailUrl(videoUrl) || PLACEHOLDER_THUMB}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
                    <div className="rounded-full bg-white/90 p-2">
                      <ExternalLink className="h-5 w-5 text-foreground" />
                    </div>
                  </div>
                </div>
              </a>
            </div>
          )}
          {hasDoc && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">{t("help.documentation", "Documentation")}</p>
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground">{t("help.openDoc", "Open documentation")}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              </a>
            </div>
          )}
          {!hasAny && (
            <p className="text-sm text-muted-foreground">{t("help.noQuickContent", "Go to the Help page for support and guides.")}</p>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <LButton variant="outline" onClick={goToHelpPage}>
              {t("help.goToSupportPage", "Go to Help page")}
            </LButton>
            <LButton variant="primary" onClick={onClose}>
              {t("help.gotIt", "Got it")}
            </LButton>
          </div>
        </div>
      )}
    </LResponsiveDialog>
  );
}

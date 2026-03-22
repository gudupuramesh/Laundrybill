/**
 * Help page – support contact, working hours, videos, and docs
 * Data is configured by Super Admin in Platform Settings → Support & Help.
 */

import { useSupportSettings } from "@/hooks/use-support-settings";
import { getYoutubeThumbnailUrl } from "@/lib/youtube-thumbnail";
import {
  LCard,
  LPageLoader,
  LEmptyState,
} from "@/components/laundry";
import { Phone, Mail, MessageCircle, Clock, Video, FileText, ExternalLink } from "lucide-react";

const PLACEHOLDER_THUMB = "https://placehold.co/320x180?text=Video";

export function HelpPage() {
  const { data, loading, error } = useSupportSettings();

  if (loading) return <LPageLoader message="Loading help..." />;
  if (error) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <LEmptyState
          title="Unable to load help"
          description={error}
        />
      </div>
    );
  }

  const hasContact =
    data.supportPhone || data.whatsappNumber || data.supportEmail || data.workingHours;
  const hasVideos = data.supportVideos?.length > 0;
  const hasDocs = data.supportDocs?.length > 0;
  const pageHelpEntries = (data.pageHelp ?? []).filter(
    (p) => (p.videoUrl && p.videoUrl.trim()) || (p.docUrl && p.docUrl.trim())
  );
  const hasPageHelp = pageHelpEntries.length > 0;

  if (!hasContact && !hasVideos && !hasDocs && !hasPageHelp) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <LEmptyState
          title="No help content yet"
          description="Support contact and guides will appear here once configured by the platform."
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Help & Support</h1>
        <p className="text-muted-foreground mt-1">Contact us or browse guides and videos.</p>
      </div>

      {/* Contact */}
      {hasContact && (
        <LCard className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Contact support</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.supportPhone && (
              <a
                href={`tel:${data.supportPhone.replace(/\s/g, "")}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Call</p>
                  <p className="text-sm text-muted-foreground truncate">{data.supportPhone}</p>
                </div>
              </a>
            )}
            {data.whatsappNumber && (
              <a
                href={`https://wa.me/${data.whatsappNumber.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">WhatsApp</p>
                  <p className="text-sm text-muted-foreground truncate">{data.whatsappNumber}</p>
                </div>
              </a>
            )}
            {data.supportEmail && (
              <a
                href={`mailto:${data.supportEmail}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors sm:col-span-2"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Email</p>
                  <p className="text-sm text-muted-foreground truncate">{data.supportEmail}</p>
                </div>
              </a>
            )}
            {data.workingHours && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 sm:col-span-2">
                <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Working hours</p>
                  <p className="text-sm text-muted-foreground">{data.workingHours}</p>
                </div>
              </div>
            )}
          </div>
        </LCard>
      )}

      {/* Guides by page (per-page video + doc) */}
      {hasPageHelp && (
        <LCard className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Guides by page
          </h2>
          <ul className="space-y-3">
            {pageHelpEntries.map((p) => (
              <li key={p.pageId} className="border border-border rounded-lg p-4 bg-card">
                <p className="font-medium text-foreground text-sm mb-2">{p.pageTitle}</p>
                <div className="flex flex-wrap gap-2">
                  {p.videoUrl?.trim() && (
                    <a
                      href={p.videoUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <Video className="h-4 w-4" />
                      Video tutorial
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {p.docUrl?.trim() && (
                    <a
                      href={p.docUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      Documentation
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </LCard>
      )}

      {/* Videos */}
      {hasVideos && (
        <LCard className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Video className="h-5 w-5" />
            Video tutorials
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.supportVideos.map((v) => {
              const thumb = getYoutubeThumbnailUrl(v.url) || PLACEHOLDER_THUMB;
              const title = v.title || "Watch video";
              return (
                <a
                  key={v.id}
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-lg border border-border overflow-hidden bg-card hover:border-primary/50 transition-colors"
                >
                  <div className="aspect-video relative bg-muted">
                    <img
                      src={thumb}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                      <div className="rounded-full bg-white/90 p-2">
                        <ExternalLink className="h-5 w-5 text-foreground" />
                      </div>
                    </div>
                  </div>
                  <p className="p-3 text-sm font-medium text-foreground truncate" title={title}>
                    {title}
                  </p>
                </a>
              );
            })}
          </div>
        </LCard>
      )}

      {/* Docs */}
      {hasDocs && (
        <LCard className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Support docs
          </h2>
          <ul className="space-y-2">
            {data.supportDocs.map((d) => (
              <li key={d.id}>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm font-medium text-foreground truncate">
                    {d.title || "Document"}
                  </span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </LCard>
      )}
    </div>
  );
}

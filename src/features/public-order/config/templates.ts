/**
 * Public Ordering Page – Template Presets
 *
 * 5 themes for shop owners to differentiate their public pages.
 * Controls colors, radius, typography, and hero style.
 */

export type PublicTemplateId =
  | "minimal"
  | "warm"
  | "bold"
  | "pastel"
  | "corporate";

export interface PublicTemplatePreset {
  id: PublicTemplateId;
  name: string;
  description: string;
  /** Hero container classes */
  heroClasses: string;
  /** Logo wrapper classes */
  logoClasses: string;
  /** Shop name / title classes */
  titleClasses: string;
  /** Info text (address, phone, timing) classes */
  infoClasses: string;
  /** Icon color for info items */
  iconClasses: string;
  /** Main content area background */
  contentClasses: string;
}

export const PUBLIC_TEMPLATES: Record<PublicTemplateId, PublicTemplatePreset> = {
  minimal: {
    id: "minimal",
    name: "Clean Minimal",
    description: "White, subtle shadows, simple typography – premium feel",
    heroClasses:
      "bg-white border-b border-gray-200 shadow-sm",
    logoClasses:
      "rounded-lg border border-gray-200 bg-gray-50",
    titleClasses:
      "font-semibold text-gray-900 tracking-tight",
    infoClasses:
      "text-gray-600",
    iconClasses:
      "text-gray-500",
    contentClasses:
      "bg-gray-50/50",
  },

  warm: {
    id: "warm",
    name: "Warm & Friendly",
    description: "Warm orange/amber, rounded corners – family laundries",
    heroClasses:
      "bg-gradient-to-b from-amber-50 to-orange-50 border-b border-amber-200",
    logoClasses:
      "rounded-2xl border-2 border-amber-200 bg-white shadow-md",
    titleClasses:
      "font-bold text-amber-900",
    infoClasses:
      "text-amber-800/90",
    iconClasses:
      "text-amber-600",
    contentClasses:
      "bg-amber-50/30",
  },

  bold: {
    id: "bold",
    name: "Bold Modern",
    description: "Dark accent, strong contrast – urban, young audience",
    heroClasses:
      "bg-slate-900 text-white border-b border-slate-700",
    logoClasses:
      "rounded-xl border-2 border-slate-600 bg-slate-800",
    titleClasses:
      "font-bold text-white",
    infoClasses:
      "text-slate-300",
    iconClasses:
      "text-slate-400",
    contentClasses:
      "bg-slate-100",
  },

  pastel: {
    id: "pastel",
    name: "Soft Pastel",
    description: "Light pastel blues/greens – boutique, spa-style",
    heroClasses:
      "bg-gradient-to-br from-sky-50 via-teal-50/50 to-emerald-50 border-b border-sky-200",
    logoClasses:
      "rounded-2xl border border-sky-200 bg-white/80 shadow-sm",
    titleClasses:
      "font-semibold text-teal-800",
    infoClasses:
      "text-teal-700/90",
    iconClasses:
      "text-teal-600",
    contentClasses:
      "bg-sky-50/40",
  },

  corporate: {
    id: "corporate",
    name: "Corporate Trust",
    description: "Blue tones, structured layout – commercial, B2B",
    heroClasses:
      "bg-slate-800 text-white border-b-4 border-blue-500",
    logoClasses:
      "rounded-lg border border-slate-600 bg-white",
    titleClasses:
      "font-semibold text-white tracking-wide",
    infoClasses:
      "text-slate-300",
    iconClasses:
      "text-blue-400",
    contentClasses:
      "bg-slate-100",
  },
};

export function getPublicTemplate(
  id: PublicTemplateId | string | undefined
): PublicTemplatePreset {
  const key = (id || "minimal") as PublicTemplateId;
  return PUBLIC_TEMPLATES[key] ?? PUBLIC_TEMPLATES.minimal;
}

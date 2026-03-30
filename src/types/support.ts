/**
 * Support & Help settings – stored in platformSettings/support.
 * Read by Help page (shop owners); written by Super Admin.
 */

export interface SupportVideo {
  id: string;
  title: string;
  url: string;
}

export interface SupportDoc {
  id: string;
  title: string;
  url: string;
}

/** Per-page help: video + doc link for each app page (New Order, Staff, etc.) */
export interface PageHelpEntry {
  pageId: string;
  pageTitle: string;
  videoUrl: string;
  docUrl: string;
}

/** Fixed list of app pages that can have their own video + doc links */
export const SUPPORT_PAGE_IDS: PageHelpEntry["pageId"][] = [
  "newOrder",
  "staff",
  "apps",
  "expenses",
  "attendance",
  "payroll",
  "publicOrdering",
  "services",
  // Mobile app pages
  "mobile_home",
  "mobile_orders",
  "mobile_customers",
  "mobile_newOrder",
  "mobile_settings",
  "mobile_subscription",
  "mobile_expenses",
  "mobile_scan",
];

export const SUPPORT_PAGE_TITLES: Record<PageHelpEntry["pageId"], string> = {
  newOrder: "New Order",
  staff: "Staff & App Logins",
  apps: "Apps",
  expenses: "Add Expenses",
  attendance: "Attendance",
  payroll: "Payroll",
  publicOrdering: "Public Ordering Page",
  services: "Services & Time Slots",
  // Mobile app pages
  mobile_home: "Mobile — Home / Dashboard",
  mobile_orders: "Mobile — Orders",
  mobile_customers: "Mobile — Customers",
  mobile_newOrder: "Mobile — New Order",
  mobile_settings: "Mobile — Settings",
  mobile_subscription: "Mobile — Subscription",
  mobile_expenses: "Mobile — Expenses",
  mobile_scan: "Mobile — QR Scan",
};

export interface SupportSettings {
  supportPhone: string;
  whatsappNumber: string;
  supportEmail: string;
  workingHours: string;
  supportVideos: SupportVideo[];
  supportDocs: SupportDoc[];
  /** Shown once to new shop owners on dashboard (first-time welcome) */
  welcomeMessage?: string;
  /** Dashboard / getting started video URL (YouTube, etc.) */
  gettingStartedVideoUrl?: string;
  /** Per-page video + doc links (one entry per app page) */
  pageHelp?: PageHelpEntry[];
  updatedAt?: unknown;
  updatedBy?: string;
}

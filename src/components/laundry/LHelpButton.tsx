/**
 * Small help/tutorial button that navigates to the Help page.
 * Use on key pages (New Order, Staff, Expenses, etc.) so users can quickly open tutorials.
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LHelpButtonProps {
  /** Optional class for position (e.g. fixed bottom-right) */
  className?: string;
  /** Button size */
  size?: "sm" | "md" | "icon";
  /** Show as icon-only (default true for compact) */
  iconOnly?: boolean;
}

const sizeClasses = {
  sm: "p-2",
  md: "p-2.5",
  icon: "p-2",
};

export function LHelpButton({ className, size = "icon", iconOnly = true }: LHelpButtonProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => navigate("/help")}
      title={t("help.tutorialButtonTitle", "Help & tutorials")}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors",
        sizeClasses[size],
        className
      )}
      aria-label={t("help.tutorialButtonTitle", "Help & tutorials")}
    >
      <HelpCircle className={iconOnly ? "h-5 w-5" : "h-4 w-4"} />
      {!iconOnly && (
        <span className="ml-1.5 text-sm font-medium">{t("nav.help", "Help")}</span>
      )}
    </button>
  );
}

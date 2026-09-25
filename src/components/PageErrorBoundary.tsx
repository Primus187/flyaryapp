import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import PageContainer from "@/components/layout/PageContainer";
import { forceAppUpdate } from "@/lib/app-update";
import { reportError } from "@/lib/error-reporting";

function PageError() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <div className="flex flex-col items-center gap-3 pt-16 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
        <p className="font-semibold">{t("common.pageFailed")}</p>
        <p className="max-w-xs text-sm text-muted-foreground">{t("common.pageFailedHint")}</p>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => window.location.reload()}>{t("common.retry")}</Button>
          <Button onClick={async () => { if (!(await forceAppUpdate())) toast.error(t("more.updateAppOffline")); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("more.updateApp")}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

class Boundary extends Component<{ resetKey: string; children: ReactNode }, { failed: boolean; key: string }> {
  state = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  // React keeps a failed lazy import until the next page load, hence "retry" reloads.
  // Navigating to another page clears the error, so the bottom navigation always gets the user out.
  static getDerivedStateFromProps(props: { resetKey: string }, state: { failed: boolean; key: string }) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Page failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    reportError(message.includes("dynamically imported module") ? "chunk" : "render", error, info.componentStack);
  }

  render() {
    return this.state.failed ? <PageError /> : this.props.children;
  }
}

/**
 * Catches a page that fails to render – typically a lazy page file that vanished with a new deploy
 * while the device still runs the old version. Without it React drops the whole app: white screen,
 * no navigation. main.tsx already tries an automatic repair; this is the visible way out if that is not enough.
 */
export default function PageErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <Boundary resetKey={pathname}>{children}</Boundary>;
}

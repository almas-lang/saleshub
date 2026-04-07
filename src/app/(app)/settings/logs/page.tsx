import { SetBreadcrumb } from "@/components/layout/breadcrumb-context";
import { LogsViewer } from "@/components/settings/logs-viewer";

export default function LogsPage() {
  return (
    <>
      <SetBreadcrumb
        items={[
          { label: "Settings", href: "/settings" },
          { label: "System Logs" },
        ]}
      />
      <LogsViewer />
    </>
  );
}

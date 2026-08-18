import { HistoryView } from "@/components/history/HistoryView";
import { PageHeader } from "@/components/PageHeader";
import { STR } from "@/lib/ui/strings";

export const metadata = { title: `${STR.historyTitle} — ${STR.appName}` };

export default function HistoryPage() {
  return (
    <main className="screen-h">
      <PageHeader title={STR.historyTitle} />
      <HistoryView />
    </main>
  );
}

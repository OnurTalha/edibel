import { PageHeader } from "@/components/PageHeader";
import { SettingsView } from "@/components/settings/SettingsView";
import { STR } from "@/lib/ui/strings";

export const metadata = { title: `${STR.settingsTitle} — ${STR.appName}` };

export default function SettingsPage() {
  return (
    <main className="screen-h">
      <PageHeader title={STR.settingsTitle} />
      <SettingsView />
    </main>
  );
}

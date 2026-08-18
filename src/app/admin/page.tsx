import type { Metadata } from "next";
import { AdminView } from "@/components/admin/AdminView";
import { PageHeader } from "@/components/PageHeader";
import { STR } from "@/lib/ui/strings";

/* Uygulamanın korunan tek yolu (bkz. CLAUDE.md, Bölüm 13) */
export const metadata: Metadata = {
  title: `${STR.adminTitle} — ${STR.appName}`,
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="screen-h">
      <PageHeader title={STR.adminTitle} />
      <AdminView />
    </main>
  );
}

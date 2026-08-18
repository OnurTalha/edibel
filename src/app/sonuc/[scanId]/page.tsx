import { ResultView } from "@/components/result/ResultView";

/*
 * Sonuç sayfası. Kayıt kimliği adres satırındadır; sayfa yenilendiğinde de
 * aynı sonuç gösterilir. Veri /api/scans/[scanId] üzerinden çekilir.
 */
export default async function ResultPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  return <ResultView scanId={scanId} />;
}

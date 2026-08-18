/* Sonuç ekranındaki detay bölümlerinin ortak başlık çerçevesi */
export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

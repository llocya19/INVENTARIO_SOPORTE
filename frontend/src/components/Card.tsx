export default function Card({ title, children, actions }: { title?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
      {children}
      {actions && <div className="mt-3 flex justify-end">{actions}</div>}
    </section>
  );
}

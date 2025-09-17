export default function Table({
  headers,
  rows,
  emptyText = "Sin datos",
}: {
  headers: string[];
  rows: (string | number | React.ReactNode)[][];
  emptyText?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-900/70">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2 font-medium text-zinc-300 border-b border-zinc-800">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-6 text-center text-zinc-400">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="odd:bg-zinc-950/40">
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-2 border-b border-zinc-900">
                    {c as any}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

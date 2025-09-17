type Props = {
  kind?: "info" | "success" | "warning" | "error";
  title?: string;
  children?: React.ReactNode;
  onClose?: () => void;
};

const color: Record<NonNullable<Props["kind"]>, string> = {
  info: "bg-blue-900/40 border-blue-700 text-blue-100",
  success: "bg-green-900/40 border-green-700 text-green-100",
  warning: "bg-yellow-900/40 border-yellow-700 text-yellow-100",
  error: "bg-red-900/40 border-red-700 text-red-100",
};

export default function InlineAlert({ kind = "info", title, children, onClose }: Props) {
  return (
    <div className={`border rounded px-3 py-2 ${color[kind]} flex items-start gap-3`}>
      {title && <div className="font-semibold">{title}</div>}
      <div className="flex-1">{children}</div>
      {onClose && (
        <button className="ml-2 opacity-70 hover:opacity-100" onClick={onClose}>
          ✕
        </button>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: 'green' | 'red' | 'yellow' | 'blue' | 'default';
}
export function StatCard({ label, value, sub, highlight = 'default' }: StatCardProps) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    blue: 'bg-blue-50 border-blue-200',
    default: 'bg-white border-slate-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[highlight]}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

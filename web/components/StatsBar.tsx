import { Icon } from "./Icon";

type Stat = {
  label: string;
  value: string | number;
  sub?: string;
  iconName?: React.ComponentProps<typeof Icon>["name"];
  accent?: boolean;
};

export default function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className="card px-4 py-3.5 fade-up"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-wider text-mute font-medium">{s.label}</div>
            {s.iconName && (
              <div className={`w-6 h-6 rounded-md flex items-center justify-center ${s.accent ? "bg-amber-50 text-amber-700" : "bg-stone-50 text-stone-500"}`}>
                <Icon name={s.iconName} className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
            )}
          </div>
          <div className={`text-2xl font-semibold tabular leading-tight ${s.accent ? "text-amber-700" : "text-text"} ${
            typeof s.value === "string" && s.value.length > 12 ? "text-lg" : ""
          }`}>
            {s.value}
          </div>
          {s.sub && <div className="text-[11px] text-mute mt-1">{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

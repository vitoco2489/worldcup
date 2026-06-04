import { formatGroupLabel } from "@/lib/matchMeta";

type Props = {
  groupName?: string | null;
  round?: string | null;
};

export function MatchMetaBadges({ groupName, round }: Props) {
  const groupLabel = formatGroupLabel(groupName);
  const roundLabel = round?.trim() || null;

  if (!groupLabel && !roundLabel) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {groupLabel ? (
        <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-200 ring-1 ring-indigo-400/35">
          {groupLabel}
        </span>
      ) : null}
      {roundLabel ? (
        <span className="rounded-full bg-slate-600/45 px-2.5 py-0.5 text-xs font-medium text-slate-300">
          {roundLabel}
        </span>
      ) : null}
    </div>
  );
}

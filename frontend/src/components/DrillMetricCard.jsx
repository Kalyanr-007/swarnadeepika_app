import { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { ExternalLink, Loader2 } from "lucide-react";

/**
 * Metric card with a hover-triggered drill-down popover.
 *
 * Props:
 *   icon      Lucide icon component
 *   color     one of the keys in colorMap
 *   label     English label
 *   te        Telugu label
 *   value     formatted string (e.g. "₹12,000")
 *   sub       small caption below the value
 *   testid    data-testid for the outer card
 *
 *   drill = {
 *     title,                       // popover heading, e.g. "Revenue breakdown"
 *     fetcher: async () => rows,   // called once on first hover; cached
 *     renderRow: (r) => JSX,       // how to display each row
 *     emptyText,                   // shown when fetcher returns []
 *     seeAllHref,                  // e.g. "/reports"
 *     seeAllLabel,                 // "Open Reports"
 *     limit = 6,                   // rows to show inline before "N more"
 *     totalKey,                    // optional key to sum for a total footer line
 *     totalFormatter,              // (n) => "₹1,234" for the total footer
 *   }
 */
const colorMap = {
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  emerald: "bg-emerald-100 text-emerald-700",
  orange: "bg-orange-100 text-orange-700",
  red: "bg-red-100 text-red-600",
  yellow: "bg-yellow-100 text-yellow-700",
  slate: "bg-slate-100 text-slate-600",
  purple: "bg-purple-100 text-purple-700",
};

const DrillMetricCard = ({
  icon: Icon, color = "slate", label, te, value, sub, testid, drill,
}) => {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const loadOnce = async () => {
    if (rows !== null || loading || !drill?.fetcher) return;
    setLoading(true); setErr(null);
    try {
      const data = await drill.fetcher();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to load");
    } finally { setLoading(false); }
  };

  const cardBody = (
    <Card className="cursor-help transition hover:shadow-md hover:-translate-y-0.5" data-testid={testid}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.slate}`}>
            {Icon && <Icon className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 leading-tight truncate">{label}</p>
            {te && <p className="font-telugu text-[11px] text-slate-400 truncate">{te}</p>}
          </div>
        </div>
        <p className="font-heading text-xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );

  if (!drill) return cardBody;

  const limit = drill.limit ?? 6;
  const shown = (rows || []).slice(0, limit);
  const extra = Math.max(0, (rows?.length || 0) - shown.length);
  const total = drill.totalKey && rows
    ? rows.reduce((a, b) => a + (Number(b?.[drill.totalKey]) || 0), 0)
    : null;

  return (
    <HoverCard openDelay={150} closeDelay={80} onOpenChange={(open) => { if (open) loadOnce(); }}>
      <HoverCardTrigger asChild>{cardBody}</HoverCardTrigger>
      <HoverCardContent
        side="bottom" align="start"
        className="w-96 max-w-[95vw] p-0"
        data-testid={testid ? `${testid}-drill` : undefined}
      >
        <div className="p-3 border-b border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-slate-400">{drill.title || label}</p>
              <p className="font-heading text-lg font-bold text-slate-800 truncate">{value}</p>
            </div>
            {sub && <p className="text-xs text-slate-500 shrink-0 text-right max-w-[45%]">{sub}</p>}
          </div>
        </div>

        <div className="max-h-72 overflow-auto">
          {loading && (
            <div className="p-6 flex items-center justify-center text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading details…
            </div>
          )}
          {err && !loading && (
            <div className="p-4 text-sm text-red-600">Error: {err}</div>
          )}
          {!loading && !err && rows !== null && shown.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-sm">
              {drill.emptyText || "No details for this period."}
            </div>
          )}
          {!loading && !err && shown.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {shown.map((r, i) => (
                <li key={r?.id || r?._id || i} className="px-3 py-2 text-sm">
                  {drill.renderRow(r)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between rounded-b-md">
          <div className="text-xs text-slate-500">
            {rows && (
              <>
                Showing {shown.length} of {rows.length}
                {extra > 0 && <> · {extra} more</>}
                {total !== null && drill.totalFormatter && (
                  <> · Total {drill.totalFormatter(total)}</>
                )}
              </>
            )}
          </div>
          {drill.seeAllHref && (
            <a
              href={drill.seeAllHref}
              target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium text-green-700 hover:text-green-800 inline-flex items-center gap-1"
              data-testid={testid ? `${testid}-see-all` : undefined}
            >
              {drill.seeAllLabel || "Open section"}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default DrillMetricCard;

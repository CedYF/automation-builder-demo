import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, CheckCircle2, Clock3, MousePointerClick, TrendingDown } from "lucide-react";

const STARTS = 1240;
const FUNNEL = [
  { label: "Opened template", count: STARTS },
  { label: "Selected pages", count: 1054 },
  { label: "Configured rule", count: 930 },
  { label: "Previewed matches", count: 860 },
  { label: "Saved automation", count: 812 },
  { label: "Turned on", count: 684 },
] as const;

const DAILY_COMPLETIONS = [18, 21, 20, 25, 24, 29, 27, 31, 28, 34, 32, 39, 35, 38];
const completedRate = Math.round((FUNNEL.at(-1)!.count / STARTS) * 1000) / 10;

function MetricCard({ label, value, detail, icon: Icon }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof BarChart3;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span><Icon className="h-4 w-4" />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function AutomationAdminPage() {
  return (
    <main className="h-full overflow-y-auto bg-muted/20 px-5 py-7 md:px-9">
      <div className="mx-auto max-w-6xl space-y-7">
        <div>
          <Link href="/automation" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Automations
          </Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Admin analytics</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">Automation setup performance</h1>
              <p className="mt-1 text-sm text-muted-foreground">See where new automations succeed and where people leave the setup.</p>
            </div>
            <span className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">Sample data · Last 30 days</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Setup success rate" value={`${completedRate}%`} detail="Opened template → turned on" icon={CheckCircle2} />
          <MetricCard label="New automations saved" value="812" detail="65.5% of template starts" icon={BarChart3} />
          <MetricCard label="Setup drop-off" value={`${(100 - completedRate).toFixed(1)}%`} detail="Did not turn on during this period" icon={TrendingDown} />
          <MetricCard label="Median setup time" value="2m 18s" detail="Template open → saved" icon={Clock3} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Setup funnel</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">One Auto-hide negative comments journey · illustrative counts</p>
              </div>
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-6 space-y-4">
              {FUNNEL.map((stage, index) => {
                const dropped = index === 0 ? 0 : FUNNEL[index - 1]!.count - stage.count;
                return (
                  <div key={stage.label}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium">{stage.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {stage.count.toLocaleString()} <span className="ml-1">({Math.round(stage.count / STARTS * 100)}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${index === FUNNEL.length - 1 ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${stage.count / STARTS * 100}%` }} />
                    </div>
                    {dropped > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{dropped} left before this step</p>}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="text-base font-semibold">Largest drop-off</h2>
              <p className="mt-1 text-xs text-muted-foreground">From opening the template to selecting pages</p>
              <p className="mt-5 text-3xl font-semibold tracking-tight">186 <span className="text-base font-normal text-muted-foreground">people</span></p>
              <p className="mt-1 text-xs text-muted-foreground">15.0% of template starts</p>
              <div className="mt-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                First setup step is the main opportunity to improve completion.
              </div>
            </section>
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="text-base font-semibold">Recent completions</h2>
              <p className="mt-1 text-xs text-muted-foreground">Daily automations turned on · example trend</p>
              <div className="mt-5 flex h-24 items-end gap-1" role="img" aria-label="Illustrative daily completion trend increasing from 18 to 38">
                {DAILY_COMPLETIONS.map((count, index) => (
                  <div key={index} className="min-w-0 flex-1 rounded-t bg-primary/75" style={{ height: `${count / 40 * 100}%` }} title={`${count} completed`} />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>14 days ago</span><span>Today</span></div>
            </section>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">What to instrument next</h2>
          <p className="mt-1 text-xs text-muted-foreground">This page is a placeholder. These events would replace the sample figures.</p>
          <div className="mt-4 grid gap-3 text-xs md:grid-cols-3">
            <p className="rounded-lg bg-muted/40 p-3"><strong className="block">Template journey</strong><span className="mt-1 block text-muted-foreground">Opened, pages selected, rule changed, preview opened</span></p>
            <p className="rounded-lg bg-muted/40 p-3"><strong className="block">Completion</strong><span className="mt-1 block text-muted-foreground">Saved, activated, first successful run</span></p>
            <p className="rounded-lg bg-muted/40 p-3"><strong className="block">Failure and recovery</strong><span className="mt-1 block text-muted-foreground">Setup error, preview failure, returned and completed</span></p>
          </div>
        </div>
        <Link href="/automation?tab=templates&view=table" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          View the template <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  );
}

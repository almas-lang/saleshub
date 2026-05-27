import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Shadow-mode confidence gate. Reads `shadow_plan` events from journey_event_log
 * and surfaces which campaigns the v2 engine would route differently from the
 * legacy engine. Read-only — flipping a campaign to engine='v2' happens on the
 * campaign detail page once the divergent count here is comfortable.
 */
export default async function CampaignShadowPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseAdmin as any;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events } = await sb
    .from("journey_event_log")
    .select("run_id, contact_id, campaign_id, type, detail, created_at")
    .in("type", ["shadow_plan", "shadow_skipped", "shadow_error"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  type EvRow = { run_id: string | null; contact_id: string | null; campaign_id: string; type: string; detail: { divergent?: boolean; predicted?: unknown; legacy?: unknown; reason?: string; message?: string } | null; created_at: string };
  const rows = (events ?? []) as EvRow[];

  // Per-campaign roll-up
  const byCampaign = new Map<string, { campaignId: string; runs: number; divergent: number; errors: number; lastAt: string; latestDivergent: EvRow[] }>();
  for (const r of rows) {
    const e = byCampaign.get(r.campaign_id) ?? { campaignId: r.campaign_id, runs: 0, divergent: 0, errors: 0, lastAt: r.created_at, latestDivergent: [] };
    if (r.type === "shadow_plan") {
      e.runs++;
      if (r.detail?.divergent) {
        e.divergent++;
        if (e.latestDivergent.length < 5) e.latestDivergent.push(r);
      }
    } else if (r.type === "shadow_error" || r.type === "shadow_skipped") {
      e.errors++;
    }
    if (r.created_at > e.lastAt) e.lastAt = r.created_at;
    byCampaign.set(r.campaign_id, e);
  }

  const campaignIds = [...byCampaign.keys()];
  const { data: campaigns } = campaignIds.length
    ? await sb.from("unified_campaigns").select("id, name, status, engine").in("id", campaignIds)
    : { data: [] };
  const nameById = new Map<string, { name: string; status: string; engine: string }>(
    (campaigns ?? []).map((c: { id: string; name: string; status: string; engine: string }) => [c.id, { name: c.name, status: c.status, engine: c.engine }]),
  );

  const summary = [...byCampaign.values()].sort((a, b) => b.divergent - a.divergent || b.runs - a.runs);
  const totalRuns = summary.reduce((n, s) => n + s.runs, 0);
  const totalDivergent = summary.reduce((n, s) => n + s.divergent, 0);
  const totalErrors = summary.reduce((n, s) => n + s.errors, 0);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Campaign Engine — Shadow Mode</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The v2 engine runs in dryRun against active legacy enrollments daily at 04:00 UTC.
          A campaign is safe to flip to v2 when its divergent count is comfortably zero across several runs.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Enrollments shadowed (7d)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{totalRuns}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Divergent</CardTitle></CardHeader>
          <CardContent className={`text-2xl font-semibold ${totalDivergent ? "text-amber-600" : ""}`}>{totalDivergent}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Errors / skipped</CardTitle></CardHeader>
          <CardContent className={`text-2xl font-semibold ${totalErrors ? "text-red-600" : ""}`}>{totalErrors}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Per-campaign roll-up</CardTitle></CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No shadow data yet. The cron writes its first batch at 04:00 UTC; you can also trigger it manually:
              <code className="ml-2 px-2 py-0.5 bg-muted rounded text-xs">curl -H &quot;Authorization: Bearer $CRON_SECRET&quot; https://your-domain/api/cron/journey-shadow</code>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Engine</TableHead>
                  <TableHead className="text-right">Shadowed</TableHead>
                  <TableHead className="text-right">Divergent</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead>Last shadow</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((s) => {
                  const meta = nameById.get(s.campaignId);
                  return (
                    <TableRow key={s.campaignId}>
                      <TableCell>
                        <Link href={`/campaigns/${s.campaignId}`} className="hover:underline">
                          {meta?.name ?? s.campaignId.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell><Badge variant={meta?.engine === "v2" ? "default" : "secondary"}>{meta?.engine ?? "legacy"}</Badge></TableCell>
                      <TableCell className="text-right">{s.runs}</TableCell>
                      <TableCell className={`text-right ${s.divergent ? "text-amber-600 font-medium" : ""}`}>{s.divergent}</TableCell>
                      <TableCell className={`text-right ${s.errors ? "text-red-600" : ""}`}>{s.errors}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(s.lastAt).toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {summary.some((s) => s.latestDivergent.length > 0) && (
        <Card>
          <CardHeader><CardTitle>Recent divergent enrollments</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {summary.filter((s) => s.latestDivergent.length).map((s) => (
              <div key={s.campaignId}>
                <h3 className="font-medium mb-2">{nameById.get(s.campaignId)?.name ?? s.campaignId.slice(0, 8)}</h3>
                <div className="space-y-2">
                  {s.latestDivergent.map((r) => (
                    <details key={`${r.run_id}-${r.created_at}`} className="border rounded p-3 text-sm">
                      <summary className="cursor-pointer">
                        <span className="font-mono text-xs">{r.run_id?.slice(0, 8)}</span>
                        <span className="text-muted-foreground ml-2">{new Date(r.created_at).toLocaleString()}</span>
                      </summary>
                      <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(r.detail, null, 2)}</pre>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

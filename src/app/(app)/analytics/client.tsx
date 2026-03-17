"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsOverviewView } from "@/components/analytics/analytics-overview";
import { LeadAnalyticsView } from "@/components/analytics/lead-analytics";
import { PipelineAnalyticsView } from "@/components/analytics/pipeline-analytics";
import { CommunicationAnalyticsView } from "@/components/analytics/communication-analytics";
import { TeamAnalyticsView } from "@/components/analytics/team-analytics";
import type { AnalyticsOverview } from "@/types/analytics";

interface AnalyticsPageClientProps {
  overview: AnalyticsOverview;
  funnels: { id: string; name: string }[];
}

export function AnalyticsPageClient({
  overview,
  funnels,
}: AnalyticsPageClientProps) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="leads">Leads</TabsTrigger>
        <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        <TabsTrigger value="communication">Communication</TabsTrigger>
        <TabsTrigger value="team">Team</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-4">
        <AnalyticsOverviewView data={overview} />
      </TabsContent>
      <TabsContent value="leads" className="mt-4">
        <LeadAnalyticsView />
      </TabsContent>
      <TabsContent value="pipeline" className="mt-4">
        <PipelineAnalyticsView funnels={funnels} />
      </TabsContent>
      <TabsContent value="communication" className="mt-4">
        <CommunicationAnalyticsView />
      </TabsContent>
      <TabsContent value="team" className="mt-4">
        <TeamAnalyticsView />
      </TabsContent>
    </Tabs>
  );
}

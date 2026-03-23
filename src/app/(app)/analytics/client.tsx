"use client";

import {
  BarChart3,
  Users,
  GitBranch,
  MessageSquare,
  UserCog,
} from "lucide-react";
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
        <TabsTrigger value="overview">
          <BarChart3 className="size-4" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="leads">
          <Users className="size-4" />
          Leads
        </TabsTrigger>
        <TabsTrigger value="pipeline">
          <GitBranch className="size-4" />
          Pipeline
        </TabsTrigger>
        <TabsTrigger value="communication">
          <MessageSquare className="size-4" />
          Communication
        </TabsTrigger>
        <TabsTrigger value="team">
          <UserCog className="size-4" />
          Team
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-6">
        <AnalyticsOverviewView data={overview} />
      </TabsContent>
      <TabsContent value="leads" className="mt-6">
        <LeadAnalyticsView />
      </TabsContent>
      <TabsContent value="pipeline" className="mt-6">
        <PipelineAnalyticsView funnels={funnels} />
      </TabsContent>
      <TabsContent value="communication" className="mt-6">
        <CommunicationAnalyticsView />
      </TabsContent>
      <TabsContent value="team" className="mt-6">
        <TeamAnalyticsView />
      </TabsContent>
    </Tabs>
  );
}

import Link from "next/link";
import { Sparkles, ArrowLeft, Zap, BarChart3, Globe, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

const MODULE_TEASERS: Record<string, { icon: typeof Zap; features: string[] }> = {
  "Social Media": {
    icon: Globe,
    features: [
      "Schedule posts across Instagram, LinkedIn, and X",
      "Track engagement metrics in one dashboard",
      "AI-powered caption suggestions",
    ],
  },
  "AI Assistant": {
    icon: Bot,
    features: [
      "Auto-draft follow-up emails from call notes",
      "Smart lead scoring based on behavior",
      "AI-generated campaign copy",
    ],
  },
  "Advanced Analytics": {
    icon: BarChart3,
    features: [
      "Cohort analysis and LTV predictions",
      "Custom report builder with drag-and-drop",
      "Automated weekly insights via email",
    ],
  },
};

const DEFAULT_FEATURES = [
  "We're building something great for you",
  "Stay tuned for updates",
  "Your data and workflows will be ready when it launches",
];

export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module: moduleName } = await searchParams;
  const teaser = moduleName ? MODULE_TEASERS[moduleName] : null;
  const TeaserIcon = teaser?.icon ?? Zap;
  const features = teaser?.features ?? DEFAULT_FEATURES;

  return (
    <div className="page-enter flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="size-7 text-primary" />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-semibold tracking-tight">
          {moduleName ? `${moduleName} is coming soon` : "Coming soon"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {moduleName
            ? `The ${moduleName} module is under development and will be available in a future update.`
            : "This feature is under development and will be available soon."}
        </p>

        {/* Feature teasers */}
        <div className="mt-6 space-y-3 text-left">
          {features.map((feature) => (
            <div
              key={feature}
              className="flex items-start gap-3 rounded-lg border bg-card p-3"
            >
              <TeaserIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">{feature}</p>
            </div>
          ))}
        </div>

        {/* Back button */}
        <div className="mt-8">
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 size-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module: moduleName } = await searchParams;

  return (
    <div className="page-enter flex flex-1 items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <Clock className="size-6 text-muted-foreground" />
          </div>
          <CardTitle>
            {moduleName ? `${moduleName} is coming soon` : "Coming soon"}
          </CardTitle>
          <CardDescription>
            {moduleName
              ? `The ${moduleName} module is under development and will be available in a future update.`
              : "This feature is under development and will be available soon."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

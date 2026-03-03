import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  return (
    <Card className="w-full max-w-sm text-center">
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
        <CardDescription>
          Password reset is coming soon. Contact your admin for help.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to login</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

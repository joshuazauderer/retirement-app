import { validateResetToken } from "@/server/auth/passwordResetService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

interface ResetPasswordPageProps {
  params: { token: string };
}

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { token } = params;

  // Validate token server-side
  const validation = await validateResetToken(token);

  if (!validation.valid) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Link expired or invalid</CardTitle>
          <CardDescription>
            {validation.error ?? "This password reset link is no longer valid."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Password reset links expire after 60 minutes and can only be used once.
          </p>
          <Link
            href="/forgot-password"
            className="text-primary hover:underline text-sm font-medium"
          >
            Request a new reset link
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Choose a new password</CardTitle>
        <CardDescription>
          Your new password must be at least 8 characters and include an uppercase letter and a
          number.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token} />
      </CardContent>
    </Card>
  );
}

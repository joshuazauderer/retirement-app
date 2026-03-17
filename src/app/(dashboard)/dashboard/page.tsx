import { auth } from "@/lib/auth";
import { householdService } from "@/services/householdService";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const household = await householdService.getHouseholdByUserId(session.user.id);

  if (!household) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">
          Welcome to RetirePlan
        </h1>
        <p className="text-slate-600 mb-8">
          Let&apos;s set up your household to get started with your retirement plan.
        </p>
        <Link href="/onboarding">
          <Button size="lg">Set Up Your Household</Button>
        </Link>
      </div>
    );
  }

  // Household exists — redirect to the full financial app
  redirect("/app/overview");
}

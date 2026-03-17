import { auth } from "@/lib/auth";
import { householdService } from "@/services/householdService";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

  const primaryMember = household.members.find((m) => m.relationshipType === "PRIMARY");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600">Welcome back, {session.user.name}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Household</CardDescription>
            <CardTitle className="text-lg">{household.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{household.planningMode}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Filing Status</CardDescription>
            <CardTitle className="text-lg text-sm">{household.filingStatus.replace(/_/g, " ")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{household.stateOfResidence}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Target Retirement Age</CardDescription>
            <CardTitle className="text-lg">{primaryMember?.retirementTargetAge ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{household.members.length} member(s)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Household Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {household.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{m.firstName} {m.lastName}</p>
                  <p className="text-sm text-slate-600">{m.relationshipType}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">Retire at {m.retirementTargetAge}</p>
                  <p className="text-sm text-slate-600">Life exp. {m.lifeExpectancy}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

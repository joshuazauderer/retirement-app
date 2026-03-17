import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="font-bold text-lg text-slate-900">
            RetirePlan
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{session.user?.name || session.user?.email}</span>
            <SignOutButton />
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";

const CopilotDrawerWrapper = dynamic(
  () => import("@/components/copilot/CopilotDrawerWrapper"),
  { ssr: false }
);

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <AppShell
        userName={session.user?.name ?? null}
        userEmail={session.user?.email ?? null}
      >
        {children}
      </AppShell>
      <CopilotDrawerWrapper />
    </>
  );
}

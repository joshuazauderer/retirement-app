import { AppTopNav } from "@/components/layout/AppTopNav";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppFooter } from "@/components/layout/AppFooter";

type AppShellProps = {
  children: React.ReactNode;
  userName: string | null;
  userEmail: string | null;
};

export function AppShell({ children, userName, userEmail }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppTopNav userName={userName} userEmail={userEmail} />
      <div className="flex flex-1 max-w-[1400px] mx-auto w-full">
        <AppSidebar />
        <main className="flex-1 px-6 py-8 min-w-0">
          {children}
        </main>
      </div>
      <AppFooter />
    </div>
  );
}

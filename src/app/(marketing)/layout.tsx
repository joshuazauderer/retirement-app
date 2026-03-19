import { PublicTopNav } from "@/components/layout/PublicTopNav";
import { AppFooter } from "@/components/layout/AppFooter";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicTopNav />
      <main className="flex-1">{children}</main>
      <AppFooter />
    </div>
  );
}

import Sidebar from "@/components/dashboard/Sidebar";
import Navbar from "@/components/dashboard/Navbar";
import DashboardUserProvider from "@/components/auth/DashboardUserProvider";
import DashboardNetworkGuard from "@/components/system/DashboardNetworkGuard";
import SessionExpiryGuard from "@/components/system/SessionExpiryGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardUserProvider>
      <div className="flex h-screen overflow-hidden bg-[#f1f5f9] font-sans">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f1f5f9]">
          <Navbar />
          <main className="min-h-0 flex-1 overflow-y-auto bg-[#f1f5f9] p-3 md:p-6 lg:p-8">
            <SessionExpiryGuard>
              <DashboardNetworkGuard>{children}</DashboardNetworkGuard>
            </SessionExpiryGuard>
          </main>
        </div>
      </div>
    </DashboardUserProvider>
  );
}



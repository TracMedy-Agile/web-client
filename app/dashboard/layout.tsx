import Sidebar from "@/components/dashboard/Sidebar";
import Navbar from "@/components/dashboard/Navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9] font-sans">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f1f5f9]">
        <Navbar />
        <main className="min-h-0 flex-1 overflow-y-auto bg-[#f1f5f9] p-3 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}



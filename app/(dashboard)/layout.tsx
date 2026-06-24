import Sidebar from "@/components/layout/Sidebar";
import { PortalCountProvider } from "@/contexts/PortalCountContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalCountProvider>
      <div
        className="min-h-screen lg:pl-56 overflow-x-hidden"
        style={{ backgroundColor: "#e8f0f6" }}
      >
        <Sidebar />
        {/* pt-16 en mobile para no quedar detrás del botón hamburguesa */}
        <main className="min-h-screen p-4 pt-16 lg:pt-5 lg:p-5 xl:p-6">
          {children}
        </main>
      </div>
    </PortalCountProvider>
  );
}

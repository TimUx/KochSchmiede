import Navbar from "./Navbar";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";
import AuthGuard from "./AuthGuard";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-zinc-50 dark:bg-[#1e1e2e]">
        {/* Desktop sidebar (hidden on mobile) */}
        <Sidebar />

        {/* Main area shifted right on desktop */}
        <div className="lg:ml-64 flex flex-col min-h-screen">
          {/* Mobile top navbar (hidden on desktop via lg:hidden inside Navbar) */}
          <Navbar />

          {/* Page content */}
          {children}
        </div>

        {/* Mobile bottom nav (hidden on desktop via lg:hidden inside BottomNav) */}
        <BottomNav />
      </div>
    </AuthGuard>
  );
}

"use client";

import { useState }           from "react";
import { NetworkProvider }    from "@/context/NetworkContext";
import HudTopBarWrapper       from "@/components/layout/HudTopBarWrapper";
import Sidebar                from "@/components/layout/Sidebar";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "#000814" }}>
      <HudTopBarWrapper onMobileMenuToggle={() => setMobileOpen(o => !o)} />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(2px)" }}
            onClick={() => setMobileOpen(false)}
          />
        )}

        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex-1 overflow-hidden min-w-0">{children}</div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <NetworkProvider>
      <DashboardShell>{children}</DashboardShell>
    </NetworkProvider>
  );
}

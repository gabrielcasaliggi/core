"use client";

import { useState }      from "react";
import { useNetwork }    from "@/context/NetworkContext";
import type { ViewId }   from "@/types/telemetry";
import {
  LayoutDashboard, Globe2, ShieldCheck, Network,
  Users, Zap, Settings, ChevronLeft, X,
} from "lucide-react";

const NAV: { id: ViewId; icon: React.ElementType; label: string }[] = [
  { id: "resiliencia",   icon: LayoutDashboard, label: "CORE-Map"       },
  { id: "sdwan",         icon: Globe2,          label: "Enlace SD-WAN"  },
  { id: "bunker",        icon: ShieldCheck,     label: "Búnker Digital" },
  { id: "nexus",         icon: Network,         label: "Nexus-Link VPN" },
  { id: "teletrabajo",   icon: Users,           label: "Teletrabajo"    },
  { id: "provisioning",  icon: Zap,             label: "Provisioning"   },
];

interface SidebarProps {
  /** Controlado desde el layout padre para el drawer mobile */
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const { activeView, setActiveView } = useNetwork();
  const [collapsed, setCollapsed]     = useState(false);

  function handleNav(id: ViewId) {
    setActiveView(id);
    onClose?.(); // cierra el drawer en mobile al navegar
  }

  const sidebarStyle: React.CSSProperties = {
    background:     "rgba(0,4,14,0.97)",
    backdropFilter: "blur(16px)",
    borderColor:    "rgba(79,70,229,0.12)",
  };

  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex relative flex-col h-full transition-all duration-300 border-r flex-shrink-0"
        style={{ ...sidebarStyle, width: collapsed ? 52 : 196 }}
      >
        <SidebarContent
          collapsed={collapsed}
          activeView={activeView}
          onNav={handleNav}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </aside>

      {/* ── Mobile drawer ──────────────────────────────────────────────── */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 flex flex-col border-r transition-transform duration-300 md:hidden`}
        style={{
          ...sidebarStyle,
          width: 220,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded"
          style={{ color: "rgba(79,70,229,0.6)", border: "1px solid rgba(79,70,229,0.2)" }}
        >
          <X size={13} />
        </button>

        <SidebarContent
          collapsed={false}
          activeView={activeView}
          onNav={handleNav}
          onToggleCollapse={undefined}
        />
      </aside>
    </>
  );
}

/* ── Contenido compartido ──────────────────────────────────────────────────── */
function SidebarContent({
  collapsed,
  activeView,
  onNav,
  onToggleCollapse,
}: {
  collapsed: boolean;
  activeView: ViewId;
  onNav: (id: ViewId) => void;
  onToggleCollapse?: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-4 border-b flex-shrink-0"
        style={{ borderColor: "rgba(79,70,229,0.12)" }}>
        <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
          style={{ border: "1px solid rgba(79,70,229,0.4)", background: "rgba(79,70,229,0.08)" }}>
          <span className="data-value text-[10px] font-bold"
            style={{ color: "#818cf8", textShadow: "0 0 8px rgba(79,70,229,0.8)" }}>VC</span>
        </div>
        {!collapsed && (
          <div>
            <p className="data-value text-xs font-bold tracking-widest" style={{ color: "#818cf8" }}>VERTIA</p>
            <p className="data-value text-[9px] tracking-widest" style={{ color: "rgba(79,70,229,0.45)" }}>CORE v1.0</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {NAV.map(({ id, icon: Icon, label }) => {
            const active = activeView === id;
            return (
              <li key={id}>
                <button
                  onClick={() => onNav(id)}
                  className="flex items-center gap-2.5 px-2.5 py-2.5 rounded text-xs transition-all duration-150 relative overflow-hidden w-full text-left"
                  style={{
                    color:      active ? "#818cf8" : "rgba(100,116,139,0.65)",
                    background: active ? "rgba(79,70,229,0.08)" : "transparent",
                    border:     active ? "1px solid rgba(79,70,229,0.22)" : "1px solid transparent",
                  }}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r"
                      style={{ background: "#4F46E5", boxShadow: "0 0 6px #4F46E5" }} />
                  )}
                  <Icon size={15} className="flex-shrink-0" />
                  {!collapsed && (
                    <span className="data-value tracking-wide">{label}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Settings */}
      <div className="border-t p-2 flex-shrink-0" style={{ borderColor: "rgba(79,70,229,0.10)" }}>
        <button
          className="flex items-center gap-2.5 px-2.5 py-2 rounded text-xs transition-colors w-full"
          style={{ color: "rgba(71,85,105,0.7)" }}
        >
          <Settings size={14} />
          {!collapsed && <span className="data-value">Configuración</span>}
        </button>
      </div>

      {/* Collapse toggle — solo desktop */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full flex items-center justify-center z-10 transition-colors"
          style={{ background: "#000814", border: "1px solid rgba(79,70,229,0.25)", color: "rgba(79,70,229,0.6)" }}
        >
          <ChevronLeft size={11}
            style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.3s" }} />
        </button>
      )}
    </>
  );
}

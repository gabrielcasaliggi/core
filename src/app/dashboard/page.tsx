"use client";

import { useNetwork }          from "@/context/NetworkContext";
import ResilienciaView         from "./views/ResilienciaView";
import SDWanView               from "./views/SDWanView";
import BunkerDigitalView       from "./views/BunkerDigitalView";
import NexusLinkView           from "./views/NexusLinkView";
import TeletrabajoView         from "./views/TeletrabajoView";
import ProvisioningView        from "./views/ProvisioningView";

// ── View router ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { activeView } = useNetwork();

  return (
    <div key={activeView} className="h-full overflow-hidden scan-in">
      {activeView === "resiliencia"  && <ResilienciaView   />}
      {activeView === "sdwan"        && <SDWanView         />}
      {activeView === "bunker"       && <BunkerDigitalView />}
      {activeView === "nexus"        && <NexusLinkView     />}
      {activeView === "teletrabajo"  && <TeletrabajoView   />}
      {activeView === "provisioning" && <ProvisioningView  />}
    </div>
  );
}

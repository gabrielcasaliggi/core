"use client";

import { useNetwork }  from "@/context/NetworkContext";
import HudTopBar       from "./HudTopBar";

interface Props {
  onMobileMenuToggle: () => void;
}

export default function HudTopBarWrapper({ onMobileMenuToggle }: Props) {
  const { snapshot, missionMode } = useNetwork();
  return (
    <HudTopBar
      alerts={snapshot.activeAlerts}
      globalScore={snapshot.globalResilienceScore}
      missionMode={missionMode}
      onMobileMenuToggle={onMobileMenuToggle}
    />
  );
}

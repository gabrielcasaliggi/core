import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "VERTIA CORE — Mando de Resiliencia",
  description: "Orquestador de Conectividad Soberana · SD-WAN · Cyber-War-Room",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ height: "100vh", overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceso — VERTIA CORE",
  description: "Autenticación del orquestador de conectividad",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

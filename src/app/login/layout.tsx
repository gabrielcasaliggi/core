import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Identificación de operador — VERTIA CORE",
  description: "Portal restringido de la plataforma de orquestación de conectividad Vertia.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

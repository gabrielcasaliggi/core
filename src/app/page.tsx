"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#000814",
        color: "#4F46E5",
        fontFamily: "monospace",
        letterSpacing: "0.2em",
        fontSize: 12,
      }}
    >
      VERTIA CORE — INICIANDO...
    </div>
  );
}

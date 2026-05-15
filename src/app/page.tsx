import { redirect } from "next/navigation";

/** Tras middleware: solo usuarios autenticados llegan aquí sin redirigir. */
export default function Home() {
  redirect("/dashboard");
}

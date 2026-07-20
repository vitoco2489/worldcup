"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { TournamentFinishedGate } from "@/components/TournamentFinishedGate";

export function Providers({ children }: { children: ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  if (!clientId) {
    return (
      <div className="min-h-screen bg-pitch px-4 py-8 text-center text-danger">
        <p className="font-semibold">Falta NEXT_PUBLIC_GOOGLE_CLIENT_ID</p>
        <p className="mt-2 text-sm text-slate-400">Configúralo en el entorno para habilitar el inicio de sesión con Google.</p>
      </div>
    );
  }
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <TournamentFinishedGate>{children}</TournamentFinishedGate>
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          className: "text-sm",
        }}
      />
    </GoogleOAuthProvider>
  );
}

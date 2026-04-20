"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  if (!clientId) {
    return (
      <div className="min-h-screen bg-pitch px-4 py-8 text-center text-danger">
        <p className="font-semibold">Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID</p>
        <p className="mt-2 text-sm text-slate-400">Set it in your environment to enable Google sign-in.</p>
      </div>
    );
  }
  return (
    <GoogleOAuthProvider clientId={clientId}>
      {children}
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

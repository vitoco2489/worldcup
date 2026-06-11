"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { clearAuthSession } from "@/lib/auth";

type Props = {
  onSuccess: (idToken: string) => void | Promise<void>;
  onError?: () => void;
};

export function GoogleSignIn({ onSuccess, onError }: Props) {
  const [loginKey, setLoginKey] = useState(0);

  function useAnotherAccount() {
    clearAuthSession();
    setLoginKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <GoogleLogin
        key={loginKey}
        onSuccess={async (cred) => {
          if (!cred.credential) return;
          await onSuccess(cred.credential);
        }}
        onError={() => onError?.()}
        useOneTap={false}
        auto_select={false}
      />
      <button
        type="button"
        onClick={useAnotherAccount}
        className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
      >
        Usar otra cuenta de Google
      </button>
    </div>
  );
}

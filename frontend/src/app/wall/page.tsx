"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WallPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/?tab=muro");
  }, [router]);
  return null;
}

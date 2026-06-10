"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GroupsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/?tab=grupos");
  }, [router]);
  return null;
}

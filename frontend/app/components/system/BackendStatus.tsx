"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/app/lib/api/health";

export default function BackendStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    const checkHealth = async () => {
      const ok = await getHealth();
      setIsOnline(ok);
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-black/5 px-2 py-1 rounded-full border border-black/5">
      <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
      <span>{isOnline ? 'Local backend connected' : 'Backend offline'}</span>
    </div>
  );
}

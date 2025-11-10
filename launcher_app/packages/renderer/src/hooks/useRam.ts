import { useEffect, useState } from "react";

type Configs = { [key: string]: any } | null;

export function useRam(configs: Configs, totalmem: number) {
  const [usingMem, setUsingMem] = useState<number>(0);

  useEffect(() => {
    if (!totalmem) return;
    const configuredRam = configs?.ram;
    const next =
      configuredRam === undefined || configuredRam > totalmem
        ? Math.floor(totalmem * 0.6)
        : configuredRam;
    setUsingMem(next);
  }, [configs, totalmem]);

  return { usingMem, setUsingMem };
}

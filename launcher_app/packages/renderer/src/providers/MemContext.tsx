import { createContext, useState, type ReactNode } from "react";

export const MemContext = createContext<number>(0);

export const MemProvider = ({ children }: { children: ReactNode }) => {
  const [mem] = useState<number>(0);
  return <MemContext.Provider value={mem}>{children}</MemContext.Provider>;
};

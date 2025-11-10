import React from "react";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Home from "./Home";
import Settings from "./Settings";
import Layout from "./Layout";
import { useRam } from "./hooks/useRam";
type Config = {
  name: string;
  value: any;
};

declare global {
  interface Window {
    launcherAPI: {
      getConfigs: () => Promise<{ [key: string]: any }>;
      runMinecraft: () => Promise<string>;
      openLauncherDir: () => Promise<void>;
      uiLoaded: () => Promise<void>;
      addToConfigs: (params: Config[]) => Promise<void>;
      getMemSize: () => Promise<number>;
      onError: (
        callback: (message: string, type: "error" | "notification") => void
      ) => void;
      onDownloadStatus: (
        callback: (
          message: string,
          progress: number,
          isDownloading: boolean
        ) => void
      ) => void;
      onMinecraft: (callback: (status: boolean) => void) => () => void;
      removeOnMinecraft: () => void;
      downloadMinecraft: () => Promise<boolean>;
      getStatus: () => Promise<boolean>;
    };
  }
}

function App() {
  const [totalmem, setTotalmem] = useState<number>(0);
  const [configs, setConfigs] = useState<{ [key: string]: any } | null>(null);
  const { usingMem, setUsingMem } = useRam(configs, totalmem);
  useEffect(() => {
    window.launcherAPI
      .getConfigs()
      .then((data) => setConfigs(data))
      .catch((e) => {
        console.error("Error loading configs: ", e);
        setConfigs({ nickname: "" });
      });
    console.log(configs);
  }, []);

  useEffect(() => {
    window.launcherAPI.getMemSize().then((data) => {
      setTotalmem(data);
    });
  }, []);
  if (!configs) {
    return <div>Загрузка...</div>;
  }
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/settings"
          element={
            <Settings
              totalmem={totalmem}
              onChange={setUsingMem}
              usingmem={usingMem}
              configs={configs}
              setConfigs={setConfigs}
            />
          }
        />
      </Routes>
      <Layout configs={configs} usingmem={usingMem} />
    </HashRouter>
  );
}

export default App;

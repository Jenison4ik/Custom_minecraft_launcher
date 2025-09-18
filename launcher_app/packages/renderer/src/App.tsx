import React from "react";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Home from "./Home";
import Settings from "./Settings";
import Layout from "./Layout";
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
      onError: (callback: (message: string) => void) => void;
      onDownloadStatus: (
        callback: (
          message: string,
          progress: number,
          isDownloading: boolean
        ) => void
      ) => void;
      onMinecraft: (callback: (status: boolean) => void) => void;
    };
  }
}

function App() {
  const [totalmem, setTotalmem] = useState<number>(0);
  const [configs, setConfigs] = useState<{ [key: string]: any } | null>(null);
  const [usingmem, setUsingmem] = useState<number>(0);
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
  useEffect(() => {
    if (configs && totalmem) {
      setUsingmem(
        configs.ram === undefined || configs.ram > totalmem
          ? Math.floor(totalmem * 0.6)
          : configs.ram
      );
    }
  }, [configs, totalmem]);
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
              onChange={(e) => setUsingmem(e)}
              usingmem={usingmem}
              configs={configs}
            />
          }
        />
      </Routes>
      <Layout configs={configs} usingmem={usingmem} />
    </HashRouter>
  );
}

export default App;

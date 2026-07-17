import React from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import Layout from "./components/Layout";
import { useRam } from "./hooks/useRam";

function App() {
  const [totalmem, setTotalmem] = useState<number>(0);
  const [configs, setConfigs] = useState<Record<string, unknown> | null>(null);
  const { usingMem, setUsingMem } = useRam(configs, totalmem);

  useEffect(() => {
    if (!window.launcherAPI) {
      console.error("launcherAPI is missing — preload failed to load");
      setConfigs({ nickname: "" });
      return;
    }

    window.launcherAPI
      .getConfigs()
      .then((data) => setConfigs(data))
      .catch((e) => {
        console.error("Error loading configs: ", e);
        setConfigs({ nickname: "" });
      });
  }, []);

  useEffect(() => {
    if (!window.launcherAPI) return;
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

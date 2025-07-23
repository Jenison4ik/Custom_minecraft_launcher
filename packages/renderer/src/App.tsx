import React, { useEffect, useState } from 'react';

declare global {
  interface Window {
    launcherAPI: {
      getLauncherName: () => Promise<string>;
      runMinecraft: () => Promise<string>;
    };
  }
}

function App() {
  const [launcherName, setLauncherName] = useState('');

  useEffect(() => {
    window.launcherAPI.getLauncherName().then(setLauncherName);
  }, []);

  return (
    <div>
      <h1>{launcherName}</h1>
      <button
        onClick={() => {
          try {
            window.launcherAPI.runMinecraft();
          } catch (e) {
            console.log(e);
          }
        }}
      >
        Запустить Minecraft
      </button>
    </div>
  );
}


export default App; 
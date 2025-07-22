import React, { useEffect, useState } from 'react';

declare global {
  interface Window {
    launcherAPI: {
      getLauncherName: () => Promise<string>;
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
      <button>Click me</button>
    </div>
  );
}


export default App; 
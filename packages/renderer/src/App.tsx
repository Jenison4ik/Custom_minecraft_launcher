import React, { useEffect, useState } from 'react';
import InputText from './input'

type Config = {
  name: string,
  value: any
}

declare global {
  interface Window {
    launcherAPI: {
      getLauncherName: () => Promise<string>;
      runMinecraft: () => Promise<string>;
      addToConfigs: (params: Config[]) => Promise<void>
    };
  }
}

function App() {
  const [launcherName, setLauncherName] = useState('');
  const [nickname, setNickname] = useState('');


  const handleInputChange = (value: string) => {
    setNickname(value);
  };


  useEffect(() => {
    window.launcherAPI.getLauncherName().then(setLauncherName);
  }, []);

  return (
    <div>
      <h1>{launcherName}</h1>
      <button
        onClick={() => {
          try {
            window.launcherAPI.addToConfigs([{name:'nickname',value:nickname}]);
            window.launcherAPI.runMinecraft();
          } catch (e) {
            console.log(e);
          }
        }}
      >
        Запустить Minecraft
      </button>
        <InputText placeholder='text' onChange={(val) => handleInputChange(val)}></InputText>
    </div>
  );
}


export default App; 
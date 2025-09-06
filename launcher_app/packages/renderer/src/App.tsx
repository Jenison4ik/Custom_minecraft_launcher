import React, { useEffect, useState, useRef } from 'react';
import InputText from './inputText'
import InputRam from './inputRam';
import ErrorToasts from './ErrorToasts';
import './styles/App.scss';
import DownloadBar from './DownloadBar';
import LaunchButton from './LaunchButton';

type Config = {
  name: string,
  value: any
}

declare global {
  interface Window {
    launcherAPI: {
      getConfigs: () => Promise<{ [key: string]: any }>;
      runMinecraft: () => Promise<string>;
      openLauncherDir: () => Promise<void>,
      addToConfigs: (params: Config[]) => Promise<void>;
      getMemSize: ()=> Promise<number>; 
      onError: (callback: (message: string) => void) => void;
      onDownloadStatus: (callback: (message: string, progress: number, isDownloading:boolean) => void) => void;
      onMinecraft: (callback:(status:boolean)=> void) => void;
    };
  }
}

function App() {
  const [configs, setConfigs] = useState<{ [key: string]: any } | null>(null);
  const [totalmem,setTotalmem] = useState<number>(0);
  const [usingmem, setUsingmem] = useState<number>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {//Получение config.json
    window.launcherAPI.getConfigs()
      .then((data) => setConfigs(data))
      .catch((e) => {
        console.error("Error loading configs: ", e);
        setConfigs({ nickname: '' }); // callback
      });
  }, []);
  useEffect(()=>{
    window.launcherAPI.getMemSize().then((data)=>{setTotalmem(data)})
  }, [])
  useEffect(()=>{ //Задать текущее значение по памяти из config.json
    if (configs && totalmem) {
      setUsingmem(configs.ram === undefined || configs.ram > totalmem ? Math.floor(totalmem*0.6) : configs.ram)
    }
  },[configs, totalmem]);


  async function handleRunMinecraft() : Promise<void> {
    try {
      const nickname = inputRef.current?.value ?? 'Steve';
      window.launcherAPI.addToConfigs([{ name: 'nickname', value: nickname },{name:'ram',value:usingmem ?? (totalmem < 2048 ? totalmem : 2048) }]);
      await window.launcherAPI.runMinecraft();
    } catch (e) {
      console.log(e);
    }
  }


  if (configs === null || totalmem === undefined) {//Отображение загрузки пока ожидается config.json
    return <div>Загрузка...</div>;
  }
  return (
    <div>
      <ErrorToasts/>
      <DownloadBar/>
      <h1>{configs['launcher-name']}</h1>
      <div className='controls'>
        
        <LaunchButton onClick={handleRunMinecraft}/>
        <InputText
          placeholder={'Nickname'}
          value={configs['nickname'] ?? 'Steve'}
          inputRef={inputRef}
        />
        <button title='Open Folder' onClick={window.launcherAPI.openLauncherDir} className='folder-button'> <img src='./folder.svg' alt="папка" /></button>
      </div>
      <InputRam defVal={ typeof configs.ram !== 'number' || configs.ram > totalmem ? Math.floor(totalmem*0.6) : configs.ram} maxVal={totalmem} onChange={(e)=> setUsingmem(e)}/>
      <p className='ram'>{usingmem} MB</p>
      
    </div>
  );
}


export default App; 
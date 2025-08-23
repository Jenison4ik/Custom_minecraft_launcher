import React, { useEffect, useState, useRef } from 'react';
import InputText from './input'
import InputRange from './inputRange';
import ErrorToasts from './ErrorToasts';
import './styles/App.scss';
import DownloadBar from './DownloadBar';

type Config = {
  name: string,
  value: any
}

declare global {
  interface Window {
    launcherAPI: {
      getConfigs: () => Promise<{ [key: string]: any }>;
      runMinecraft: () => Promise<string>;
      addToConfigs: (params: Config[]) => Promise<void>;
      getMemSize: ()=> Promise<number>; 
      onError: (callback: (message: string) => void) => void;
      onDownloadStatus: (callback: (message: string, progress: number, isDownloading:boolean) => void) => void;
    };
  }
}

function App() {
  const [configs, setConfigs] = useState<{ [key: string]: any } | null>(null);
  const [totalmem,setTotalmem] = useState<number>();
  const [usingmem, setUsingmem] = useState<number>();
  const [errors, setErrors] = useState<{id:number; message: string, isFade:boolean}[]>([]);
  const [download, setDownload] = useState<{message: string, progress:number, isDownloading: boolean}>({message: '', progress: 0, isDownloading: false});
  const inputRef = useRef<HTMLInputElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);

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
  useEffect(()=>{//Обработчик активных загрузок
    const handleDownloadStatus = (message: string, progress: number, isDownloading: boolean) => {
      setDownload({message: message, progress: progress, isDownloading: isDownloading})
    };
    
    window.launcherAPI.onDownloadStatus(handleDownloadStatus);

    return () => {
      // Отменяем подписку на загрузки при размонтировании компонента
      window.launcherAPI.onDownloadStatus(() => {});
    };
  }, [])
  useEffect(() => {//Обработчик ошибок
    window.launcherAPI.onError((message) => {
      const newErrorId = Date.now();
      setErrors((prevErrors) => [{ id: newErrorId, message, isFade:false }, ...prevErrors]);
      console.error("Error received from API: ", message);


      setTimeout(() => {
        setErrors((prevErrors) =>{
          return prevErrors.map((error) => {
            if (error.id === newErrorId) {
              return { ...error, isFade: true };
            }
            return error;
          });
        });

      setTimeout(()=>{setErrors((prevErrors) => prevErrors.filter((error) => error.id !== newErrorId));},700)}, 5000)
    });
    return () => { // Отменяем подписку на ошибки при размонтировании компонента
      window.launcherAPI.onError(() => {});
    }
  }, []);
  
  if (configs === null || totalmem === undefined) {//Отображение загрузки пока ожидается config.json
    return <div>Загрузка...</div>;
  }
  return (
    <div>
      <ErrorToasts errors={errors}/>
      <DownloadBar message={download.message} progress={download.progress} isDownloading={download.isDownloading}/>
      <h1>{configs['launcher-name']}</h1>
      <button
        onClick={() => {
          try {

            const nickname = inputRef.current?.value ?? 'Steve';
            window.launcherAPI.addToConfigs([{ name: 'nickname', value: nickname },{name:'ram',value:usingmem}]);
            window.launcherAPI.runMinecraft();
          } catch (e) {
            console.log(e);
          }
        }}
      >
        Запустить Minecraft
      </button>
      <InputText
        placeholder={'Nickname'}
        value={configs['nickname'] ?? 'Steve'}
        inputRef={inputRef}
      />
      <InputRange defVal={configs.ram === undefined || configs.ram > totalmem ? Math.floor(totalmem*0.6) : configs.ram} maxVal={totalmem} inputRef={rangeRef} onChange={(e)=> setUsingmem(e)}/>
      <p className='ram'>{usingmem} MB</p>
    </div>
  );
}


export default App; 
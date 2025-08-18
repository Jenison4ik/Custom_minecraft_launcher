import React, { useEffect, useState, useRef } from 'react';
import InputText from './input'
import InputRange from './inputRange';

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
    };
  }
}

function App() {
  const [configs, setConfigs] = useState<{ [key: string]: any } | null>(null);
  const [totalmem,setTotalmem] = useState<number>();
  const [usingmem, setUsingmem] = useState<number>();
  const inputRef = useRef<HTMLInputElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
  },[configs, totalmem])
  useEffect(() => {
    // Регистрируем обработчик ошибок только один раз при монтировании компонента
    window.launcherAPI.onError((message) => {
      console.log('pizda');
      
    });
    return () => { // Отменяем подписку на ошибки при размонтировании компонента
      window.launcherAPI.onError(() => {});
    }
  }, []);
  
  if (configs === null || totalmem === undefined) {
    // Можно показать спиннер или просто ничего не рендерить
    return <div>Загрузка...</div>;
  }
  return (
    <div>
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
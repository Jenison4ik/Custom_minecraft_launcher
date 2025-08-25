import React, { useState } from 'react';
import { useEffect } from 'react';
import './styles/LaunchButton.scss';

type LaunchButtonProps = {
  onClick: () => void;
};

export default function LaunchButton({ onClick }: LaunchButtonProps){
  const [isGameRunning, setIsGameRunning] = useState<boolean>(false);

  useEffect(()=>{
    window.launcherAPI.onMinecraft((status)=>{
      setIsGameRunning(status);
    })

    return ()=>{
      window.launcherAPI.onMinecraft(()=>{});
    }
  },[])


  return (
    <button onClick={onClick} disabled={isGameRunning} className='load-btn'>
      {isGameRunning ? 'В игре' : 'Запустить игру'}
    </button>
  )
}


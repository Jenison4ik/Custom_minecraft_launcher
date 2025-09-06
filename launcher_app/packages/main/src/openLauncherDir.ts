import {exec} from 'child_process';
import {app} from 'electron';
import sendError from './sendError';

export async function openLauncherDir() {
    try{
        const platform = process.platform
        const baseDir = app.getPath('userData');

        if(platform === 'win32'){//Windows
            exec(`start ${baseDir}`);
        }else if(platform === 'darwin'){//Mac os
            exec(`open "${baseDir}"`);
        }else{//Linux
            exec(`xdg-open ${baseDir}`);
        }
    }catch(e){
        sendError(`Can't open directory: ${e}`);
    }
}
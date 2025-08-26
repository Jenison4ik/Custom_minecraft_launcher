import {exec} from 'child_process';
import {app} from 'electron';

export async function openLauncherDir() {
    const platform = process.platform
    const baseDir = app.getPath('userData');

    if(platform === 'win32'){//Windows
        exec(`start ${baseDir}`);
    }else if(platform === 'darwin'){//Mac os
        exec(`open ${baseDir}`);
    }else{//Linux
        exec(`xdg-open ${baseDir}`);
    }
}
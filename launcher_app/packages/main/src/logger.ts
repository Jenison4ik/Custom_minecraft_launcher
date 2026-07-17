import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

class Logger {
  private logFilePath: string;

  constructor() {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.logFilePath = path.join(logsDir, `launcher-${new Date().toISOString().split('T')[0]}.log`);
  }

  private writeLog(level: string, message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message} ${args.length > 0 ? JSON.stringify(args) : ''}\n`;
    
    // Write to file
    try {
      fs.appendFileSync(this.logFilePath, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
    
    // Also output to console
    switch (level) {
      case 'ERROR':
        console.error(logEntry);
        break;
      case 'WARN':
        console.warn(logEntry);
        break;
      case 'INFO':
        console.info(logEntry);
        break;
      default:
        console.log(logEntry);
    }
  }

  info(message: string, ...args: any[]) {
    this.writeLog('INFO', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.writeLog('WARN', message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.writeLog('ERROR', message, ...args);
  }

  debug(message: string, ...args: any[]) {
    if (process.env.NODE_ENV === 'development') {
      this.writeLog('DEBUG', message, ...args);
    }
  }
}

export default new Logger();
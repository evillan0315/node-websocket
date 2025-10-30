import { atom } from 'nanostores';

interface LogEntry {
  timestamp: string;
  source: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
  details?: string;
  data?: any;
}

export const logStore = atom<LogEntry[]>([]);

export const addLog = (source: string, message: string, level: LogEntry['level'] = 'info', details?: string, data?: any) => {
  const newEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    source,
    message,
    level,
    details,
    data,
  };
  logStore.set([...logStore.get(), newEntry]);
  console.log(`[${level.toUpperCase()}] [${source}] ${message}`);
  if (details) console.log('Details:', details);
  if (data) console.log('Data:', data);
};

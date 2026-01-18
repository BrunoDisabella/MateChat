
export type LogLevel = 'log' | 'warn' | 'error' | 'info';

export interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: any;
  stack?: string;
}

export class HttpError extends Error {
  public status: number;
  public body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

type Listener = (message: LogMessage) => void;

class LoggerService {
  private listeners: Set<Listener> = new Set();
  private logs: LogMessage[] = [];

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.logs.forEach(log => listener(log));
    return () => this.listeners.delete(listener);
  }

  init() {
    window.onerror = (message, source, lineno, colno, error) => {
      this.emit({
        level: 'error',
        message: `Excepción no capturada: ${message}`,
        timestamp: new Date(),
        data: { source, lineno, colno },
        stack: error?.stack,
      });
      return true;
    };

    window.onunhandledrejection = (event: PromiseRejectionEvent) => {
      this.emit({
        level: 'error',
        message: `Promesa rechazada: ${event.reason?.message || 'Sin mensaje'}`,
        timestamp: new Date(),
        data: event.reason,
        stack: event.reason?.stack,
      });
    };
    this.info('Manejadores de error listos.');
  }

  private emit(message: LogMessage) {
    if (this.logs.length > 200) this.logs.shift();
    this.logs.push(message);
    this.listeners.forEach(listener => listener(message));
  }

  log(message: string, data?: any) {
    console.log(message, data || '');
    this.emit({ level: 'log', message, timestamp: new Date(), data });
  }

  error(message: string, data?: any, error?: Error) {
    console.error(message, data || '', error || '');
    this.emit({ level: 'error', message, timestamp: new Date(), data, stack: error?.stack || (error as any)?.toString() });
  }
  
  warn(message: string, data?: any) {
    console.warn(message, data || '');
    this.emit({ level: 'warn', message, timestamp: new Date(), data });
  }

  info(message: string, data?: any) {
    console.info(message, data || '');
    this.emit({ level: 'info', message, timestamp: new Date(), data });
  }

  clear() {
      this.logs = [];
      this.listeners.forEach(listener => listener({ level: 'info', message: 'CONSOLE_CLEARED', timestamp: new Date() }));
  }
}

export const Logger = new LoggerService();

export const instrumentedFetch = async (url: string, options?: RequestInit): Promise<any> => {
    const method = options?.method || 'GET';
    Logger.info(`[RED] 📡 Iniciando ${method} -> ${url}`);

    let response: Response;
    try {
        response = await fetch(url, options);
    } catch (networkError: any) {
        const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
        let diag = "Falla de conexión física.";
        if (isLocalhost) diag += " El servidor backend parece estar APAGADO o el puerto 3002 está bloqueado.";
        
        Logger.error(`[RED] ❌ Error de Red Crítico`, { 
            url, 
            diagnostico: diag,
            mensaje: networkError.message 
        });
        throw networkError;
    }

    const responseText = await response.text();

    if (!response.ok) {
        let errorBody;
        try { errorBody = JSON.parse(responseText); } catch { errorBody = responseText; }
        
        const errorData = {
            status: response.status,
            url,
            respuesta_servidor: errorBody,
        };
        
        Logger.error(`[RED] ⚠️ El Backend respondió con ERROR ${response.status}`, errorData);
        throw new HttpError(`Error ${response.status}`, response.status, responseText);
    }

    try {
        if (responseText.trim() === '') return null;
        const data = JSON.parse(responseText);
        Logger.info(`[RED] ✅ Respuesta exitosa del Backend`, { status: response.status, data });
        return data;
    } catch (parseError) {
        Logger.error('[RED] 🚫 El Backend envió datos que no son JSON', { texto: responseText.substring(0, 200) });
        throw new HttpError('Respuesta no es JSON', response.status, responseText);
    }
};

declare module "fix-js" {
  export interface FIXConnectionConfig {
    host: string;
    port: number;
    sender: string;
    target: string;
    heartbeatIntervalMs: number;
    useSSL: boolean;
    resetOnLogon: boolean;
    sessionStartTime: string;
    sessionEndTime: string;
    logPath: string;
    storePath: string;
  }

  export interface FIXMessage {
    type: string;
    fields: Record<string, string>;
    rawMessage: string;
    toString(): string;
  }

  export class FIXParser {
    constructor();
    parse(message: string): FIXMessage;
    format(message: FIXMessage): string;
  }

  export class FIXConnection extends EventEmitter {
    constructor(config: FIXConnectionConfig, parser: FIXParser);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    send(message: string | FIXMessage): Promise<void>;
    on(event: "connect", listener: () => void): this;
    on(event: "disconnect", listener: () => void): this;
    on(event: "message", listener: (message: FIXMessage) => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    on(event: "heartbeat", listener: () => void): this;
  }
}

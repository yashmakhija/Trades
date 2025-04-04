declare module "fix-protocol" {
  export interface SessionConfig {
    host: string;
    port: number;
    senderCompID: string;
    targetCompID: string;
    username: string;
    password: string;
    useSSL: boolean;
    resetOnLogon: boolean;
    sessionStartTime: string;
    sessionEndTime: string;
    heartbeatInterval: number;
    onMessage: (message: Message) => void;
    onError: (error: Error) => void;
    onConnect: () => void;
    onDisconnect: () => void;
  }

  export class Session {
    constructor(config: SessionConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    send(message: Message): Promise<void>;
    isConnected(): boolean;
  }

  export class Message {
    constructor(message?: string);
    setField(tag: number, value: string): void;
    getField(tag: number): string;
    toString(): string;
  }
}

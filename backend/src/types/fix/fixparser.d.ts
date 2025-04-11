declare module "fixparser" {
  export interface ConnectionConfig {
    host: string;
    port: number;
    protocol: "tcp" | "tls" | "websocket";
    sender: string;
    target: string;
    fixVersion: string;
    logging?: boolean;
    onReady?: () => void;
    onOpen?: () => void;
    onMessage?: (message: Message) => void;
    onError?: (error?: Error) => void;
    onClose?: () => void;
  }

  export class Message {
    constructor(message?: string);
    setField(tag: number, value: string): void;
    getField(tag: number): string;
    toString(): string;
    toFIXJSON(): Record<string, any>;
  }

  export class FIXParser {
    constructor();
    connect(config: ConnectionConfig): Promise<void>;
    disconnect(): Promise<void>;
    send(message: Message): Promise<void>;
    isConnected(): boolean;
    parse(message: string): Message[];
  }

  export class LicenseManager {
    static setLicenseKey(key: string): Promise<void>;
  }
}

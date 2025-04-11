declare module "fix-js" {
  import { EventEmitter } from "events";
  import { FixMessage } from "./config";

  interface FIXConnectionConfig {
    host: string;
    port: number;
    sender: string;
    target: string;
    username: string;
    password: string;
    version: string;
    useSSL?: boolean;
  }

  export class FIXConnection extends EventEmitter {
    constructor(config: FIXConnectionConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    send(message: FixMessage): Promise<void>;
    isConnected(): boolean;

    on(event: "connect", listener: () => void): this;
    on(event: "disconnect", listener: () => void): this;
    on(event: "message", listener: (message: FixMessage) => void): this;
    on(event: "error", listener: (error: Error) => void): this;
  }
}

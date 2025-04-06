declare module "nodefix" {
  export interface FixClientOptions {
    heartbeat?: number;
    credentials?: {
      username: string;
      password: string;
    };
    ssl?: boolean;
    resetOnLogon?: boolean;
  }

  export class FixClient {
    constructor(
      host: string,
      port: number,
      fixVersion: string,
      dictionary: any,
      senderCompID: string,
      targetCompID: string,
      options?: FixClientOptions
    );
    createConnection(
      callback: (error: Error | null, client: FixClient) => void
    ): void;
    sendMsg(msg: any, callback: (msg: any) => void): void;
    sendLogon(additional_tags?: any): void;
    sendLogoff(additional_tags?: any): void;
    destroyConnection(): void;
    modifyBehavior(data: any): void;
    on(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
  }
}

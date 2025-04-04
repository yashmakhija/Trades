declare module "quickfix" {
  export class Settings {
    set(key: string, value: string): void;
    get(key: string): string;
  }

  export class Initiator {
    constructor(settings: Settings);
    start(): Promise<void>;
    stop(): Promise<void>;
    send(message: string): Promise<void>;
  }

  export class Acceptor {
    constructor(settings: Settings);
    start(): Promise<void>;
    stop(): Promise<void>;
  }

  export class Message {
    constructor();
    setField(tag: number, value: string): void;
    getField(tag: number): string;
    toString(): string;
  }

  export class Session {
    static sendToTarget(
      message: Message,
      senderCompID: string,
      targetCompID: string
    ): Promise<void>;
  }
}

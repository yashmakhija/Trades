declare module "quickfix-node" {
  export class Dictionary {
    constructor();
    setString(key: string, value: string): void;
    getString(key: string): string;
  }

  export class SessionSettings {
    constructor(config: string);
    get(sessionID: SessionID, key: string): string;
    set(sessionID: SessionID, key: string, value: string): void;
  }

  export class SessionID {
    constructor(
      beginString: string,
      senderCompID: string,
      targetCompID: string
    );
    toString(): string;
  }

  export class Message {
    constructor(message?: string);
    setField(tag: number, value: string): void;
    getField(tag: number): string;
    toString(): string;
    getHeader(): Dictionary;
  }

  export class Application {
    onCreate(sessionID: SessionID): void;
    onLogon(sessionID: SessionID): void;
    onLogout(sessionID: SessionID): void;
    toAdmin(message: Message, sessionID: SessionID): void;
    fromAdmin(message: Message, sessionID: SessionID): void;
    toApp(message: Message, sessionID: SessionID): void;
    fromApp(message: Message, sessionID: SessionID): void;
  }

  export class Initiator {
    constructor(
      application: Application,
      storeFactory: FileStoreFactory,
      settings: SessionSettings,
      logFactory: FileLogFactory
    );
    start(): Promise<void>;
    stop(force: boolean): Promise<void>;
    isLoggedOn(): boolean;
    getSessions(): SessionID[];
  }

  export class FileStoreFactory {
    constructor(settings: SessionSettings);
  }

  export class FileLogFactory {
    constructor(settings: SessionSettings);
  }
}

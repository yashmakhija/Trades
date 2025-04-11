export interface FixConnectionConfig {
  host: string;
  port: number;
  sender: string;
  target: string;
  username: string;
  password: string;
  useSSL: boolean;
  resetOnLogon: boolean;
  heartbeatInterval: number;
  fixVersion: string;
  sessionStartTime: string;
  sessionEndTime: string;
}

export interface FixConfig {
  pricing: FixConnectionConfig;
  trading: FixConnectionConfig;
}

export interface FixSession {
  id: string;
  isConnected: boolean;
  lastHeartbeat: Date;
  messageCount: number;
  errorCount: number;
}

export interface FixMessage {
  // Standard header fields
  msgType: string;
  senderCompID: string;
  targetCompID: string;
  msgSeqNum: number;
  sendingTime: string;
  rawMessage: string;
  parsedMessage: Record<string, string>;

  // Market data fields
  MDReqID?: string;
  SubscriptionRequestType?: string;
  MarketDepth?: string;
  MDUpdateType?: string;
  NoMDEntryTypes?: string;
  MDEntryType?: string;
  NoRelatedSym?: string;
  Symbol?: string;
  SecurityExchange?: string;

  // Order fields
  ClOrdID?: string;
  Side?: string;
  TransactTime?: string;
  OrdType?: string;
  OrderQty?: string;
  Price?: string;
  StopPx?: string;
  TimeInForce?: string;

  // Allow any other FIX fields
  [tag: string]: string | number | Record<string, string> | undefined;
}

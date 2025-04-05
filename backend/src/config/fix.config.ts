import { FixConfig } from "../types/fix";

const commonDictionary = {
  fix: {
    header: {
      field: [
        { _name: "BeginString", _number: "8", _type: "string" },
        { _name: "BodyLength", _number: "9", _type: "int" },
        { _name: "MsgType", _number: "35", _type: "string" },
        { _name: "SenderCompID", _number: "49", _type: "string" },
        { _name: "TargetCompID", _number: "56", _type: "string" },
        { _name: "MsgSeqNum", _number: "34", _type: "int" },
        { _name: "SendingTime", _number: "52", _type: "utctimestamp" },
      ],
    },
    trailer: {
      field: [{ _name: "CheckSum", _number: "10", _type: "string" }],
    },
    messages: {
      message: [
        {
          _msgtype: "A",
          _name: "Logon",
          field: [
            { _name: "EncryptMethod", _number: "98", _type: "int" },
            { _name: "HeartBtInt", _number: "108", _type: "int" },
            { _name: "Username", _number: "553", _type: "string" },
            { _name: "Password", _number: "554", _type: "string" },
          ],
        },
        {
          _msgtype: "5",
          _name: "Logout",
          field: [{ _name: "Text", _number: "58", _type: "string" }],
        },
        {
          _msgtype: "0",
          _name: "Heartbeat",
          field: [{ _name: "TestReqID", _number: "112", _type: "string" }],
        },
        {
          _msgtype: "1",
          _name: "TestRequest",
          field: [{ _name: "TestReqID", _number: "112", _type: "string" }],
        },
      ],
    },
  },
};

const marketDataDictionary = {
  fix: {
    header: commonDictionary.fix.header,
    trailer: commonDictionary.fix.trailer,
    messages: {
      message: [
        ...commonDictionary.fix.messages.message,
        {
          _msgtype: "V",
          _name: "MarketDataRequest",
          field: [
            { _name: "MDReqID", _number: "262", _type: "string" },
            { _name: "SubscriptionRequestType", _number: "263", _type: "char" },
            { _name: "MarketDepth", _number: "264", _type: "int" },
            { _name: "Symbol", _number: "55", _type: "string" },
          ],
        },
        {
          _msgtype: "W",
          _name: "MarketDataSnapshotFullRefresh",
          field: [
            { _name: "Symbol", _number: "55", _type: "string" },
            { _name: "MDReqID", _number: "262", _type: "string" },
            { _name: "BidPx", _number: "132", _type: "price" },
            { _name: "OfferPx", _number: "133", _type: "price" },
            { _name: "BidSize", _number: "134", _type: "qty" },
            { _name: "OfferSize", _number: "135", _type: "qty" },
            { _name: "LastPx", _number: "31", _type: "price" },
            { _name: "Volume", _number: "32", _type: "qty" },
          ],
        },
      ],
    },
  },
};

const tradingDictionary = {
  fix: {
    header: commonDictionary.fix.header,
    trailer: commonDictionary.fix.trailer,
    messages: {
      message: [
        ...commonDictionary.fix.messages.message,
        {
          _msgtype: "D",
          _name: "NewOrderSingle",
          field: [
            { _name: "ClOrdID", _number: "11", _type: "string" },
            { _name: "Symbol", _number: "55", _type: "string" },
            { _name: "Side", _number: "54", _type: "char" },
            { _name: "OrdType", _number: "40", _type: "char" },
            { _name: "OrderQty", _number: "38", _type: "qty" },
            { _name: "Price", _number: "44", _type: "price" },
            { _name: "StopPx", _number: "99", _type: "price" },
            { _name: "TimeInForce", _number: "59", _type: "char" },
          ],
        },
        {
          _msgtype: "8",
          _name: "ExecutionReport",
          field: [
            { _name: "OrderID", _number: "37", _type: "string" },
            { _name: "ClOrdID", _number: "11", _type: "string" },
            { _name: "Symbol", _number: "55", _type: "string" },
            { _name: "Side", _number: "54", _type: "char" },
            { _name: "OrdType", _number: "40", _type: "char" },
            { _name: "OrderQty", _number: "38", _type: "qty" },
            { _name: "Price", _number: "44", _type: "price" },
            { _name: "StopPx", _number: "99", _type: "price" },
            { _name: "TimeInForce", _number: "59", _type: "char" },
            { _name: "OrdStatus", _number: "39", _type: "char" },
          ],
        },
      ],
    },
  },
};

export const fixConfig: FixConfig = {
  marketData: {
    host: "cntuk.centroidsol.com",
    port: 43510,
    fixVersion: "FIX.4.4",
    dictionary: marketDataDictionary,
    senderCompID: "MD_FX_Squad",
    targetCompID: "CENTROID_SOL",
    credentials: {
      username: "FX_Squad",
      password: "DS#U7m#8",
    },
    ssl: false,
    resetOnLogon: true,
    heartbeat: 30,
    session: {
      startDay: "Friday",
      startTime: "00:00:00",
      endDay: "Friday",
      endTime: "00:00:00",
    },
  },
  trading: {
    host: "cntuk.centroidsol.com",
    port: 43511,
    fixVersion: "FIX.4.4",
    dictionary: tradingDictionary,
    senderCompID: "TD_FX_Squad",
    targetCompID: "CENTROID_SOL",
    credentials: {
      username: "FX_Squad",
      password: "DS#U7m#8",
    },
    ssl: true,
    resetOnLogon: false,
    heartbeat: 30,
    session: {
      startDay: "Friday",
      startTime: "00:00:00",
      endDay: "Friday",
      endTime: "00:00:00",
    },
  },
  reconnect: {
    maxAttempts: 5,
    interval: 5000,
  },
  logging: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    file: "logs/fix.log",
  },
};

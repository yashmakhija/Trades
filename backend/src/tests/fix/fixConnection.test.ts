import { describe, it, expect, beforeAll, afterAll, mock } from "bun:test";
import { FixClient } from "../../fix/FixClient";
import { Socket } from "net";
import { EventEmitter } from "events";

// Mock the net.Socket class
class MockSocket extends EventEmitter {
  private _connected: boolean = false;

  constructor() {
    super();
  }

  connect(port: number, host: string): this {
    // Simulate successful connection
    setTimeout(() => {
      this._connected = true;
      this.emit("connect");
    }, 100);
    return this;
  }

  write(data: string | Uint8Array): boolean {
    // Simulate receiving a logon response
    if (data.toString().includes("35=A")) {
      setTimeout(() => {
        const logonResponse =
          "8=FIX.4.4|9=0|35=A|34=1|49=CNTUK|56=TRADER|52=20240315123456|98=0|108=30|141=Y|10=0";
        this.emit("data", Buffer.from(logonResponse.replace(/\|/g, "\x01")));
      }, 200);
    }
    // Simulate receiving a heartbeat
    else if (data.toString().includes("35=0")) {
      setTimeout(() => {
        const heartbeatResponse =
          "8=FIX.4.4|9=0|35=0|34=1|49=CNTUK|56=TRADER|52=20240315123456|10=0";
        this.emit(
          "data",
          Buffer.from(heartbeatResponse.replace(/\|/g, "\x01"))
        );
      }, 100);
    }
    return true;
  }

  end(): this {
    this._connected = false;
    this.emit("close");
    return this;
  }

  destroy(): this {
    this._connected = false;
    this.emit("close");
    return this;
  }

  setKeepAlive(): this {
    return this;
  }

  setNoDelay(): this {
    return this;
  }
}

// Mock the net module
mock.module("net", () => ({
  Socket: MockSocket,
}));

describe("FIX Connection Tests", () => {
  let marketDataClient: FixClient;
  let tradingClient: FixClient;

  beforeAll(() => {
    // Create market data client
    marketDataClient = new FixClient({
      host: "cntuk.centroidsol.com",
      port: 43510,
      senderCompID: "TRADER",
      targetCompID: "CNTUK",
      username: "testuser",
      password: "testpass",
      ssl: false,
      resetOnLogon: true,
    });

    // Create trading client
    tradingClient = new FixClient({
      host: "cntuk.centroidsol.com",
      port: 43511,
      senderCompID: "TRADER",
      targetCompID: "CNTUK",
      username: "testuser",
      password: "testpass",
      ssl: false,
      resetOnLogon: true,
    });
  });

  afterAll(() => {
    marketDataClient.disconnect();
    tradingClient.disconnect();
  });

  it("should connect to market data server", async () => {
    let connected = false;
    marketDataClient.on("logon", () => {
      connected = true;
    });

    await marketDataClient.connect();

    // Wait for connection and logon
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(connected).toBe(true);
  });

  it("should connect to trading server", async () => {
    let connected = false;
    tradingClient.on("logon", () => {
      connected = true;
    });

    await tradingClient.connect();

    // Wait for connection and logon
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(connected).toBe(true);
  });

  it("should receive heartbeats", async () => {
    let heartbeatReceived = false;
    marketDataClient.on("heartbeat", () => {
      heartbeatReceived = true;
    });

    // Simulate sending a heartbeat
    marketDataClient["socket"]?.write(
      "8=FIX.4.4|9=0|35=0|34=1|49=TRADER|56=CNTUK|52=20240315123456|10=0".replace(
        /\|/g,
        "\x01"
      )
    );

    // Wait for heartbeat
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(heartbeatReceived).toBe(true);
  });

  it("should handle disconnection", async () => {
    let disconnected = false;
    marketDataClient.on("disconnected", () => {
      disconnected = true;
    });

    marketDataClient.disconnect();

    // Wait for disconnection
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(disconnected).toBe(true);
  });
});

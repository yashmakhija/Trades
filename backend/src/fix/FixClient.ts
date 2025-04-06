import { Socket } from "net";
import { EventEmitter } from "events";

interface FixConfig {
  host: string;
  port: number;
  senderCompID: string;
  targetCompID: string;
  username: string;
  password: string;
  ssl: boolean;
  resetOnLogon: boolean;
}

export class FixClient extends EventEmitter {
  private socket: Socket | null = null;
  private config: FixConfig;
  private messageSequence: number = 1;
  private connected: boolean = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SOH = "\x01";
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  constructor(config: FixConfig) {
    super();
    this.config = config;
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new Socket();

        this.socket.on("connect", () => {
          console.log(`Connected to ${this.config.host}:${this.config.port}`);
          this.connected = true;
          this.sendLogon();
          this.startHeartbeat();
          resolve();
        });

        this.socket.on("data", (data: Buffer) => {
          this.handleMessage(data.toString());
        });

        this.socket.on("error", (error: Error) => {
          console.error("Socket error:", error);
          this.emit("error", error);
          reject(error);
        });

        this.socket.on("close", () => {
          console.log("Connection closed");
          this.connected = false;
          this.stopHeartbeat();
          this.emit("disconnected");
        });

        this.socket.connect(this.config.port, this.config.host);
      } catch (error) {
        reject(error);
      }
    });
  }

  private sendLogon(): void {
    const logonMessage = this.createLogonMessage();
    this.sendMessage(logonMessage);
  }

  private createLogonMessage(): string {
    const fields = [
      ["8", "FIX.4.4"],
      ["9", "0"], // Will be updated with body length
      ["35", "A"], // Logon message type
      ["34", this.messageSequence.toString()],
      ["49", this.config.senderCompID],
      ["56", this.config.targetCompID],
      ["52", this.getCurrentTimestamp()],
      ["98", "0"], // No encryption
      ["108", "30"], // Heartbeat interval
      ["141", this.config.resetOnLogon ? "Y" : "N"],
      ["553", this.config.username],
      ["554", this.config.password],
      ["10", "0"], // Will be updated with checksum
    ];

    return this.formatFixMessage(fields);
  }

  private formatFixMessage(fields: string[][]): string {
    let message = "";
    let bodyLength = 0;

    // Add all fields except body length and checksum
    for (let i = 0; i < fields.length; i++) {
      if (fields[i][0] !== "9" && fields[i][0] !== "10") {
        message += `${fields[i][0]}=${fields[i][1]}${this.SOH}`;
        bodyLength += message.length;
      }
    }

    // Calculate and insert body length
    const bodyLengthField = `9=${bodyLength}${this.SOH}`;
    message = message.replace("9=0", bodyLengthField);

    // Calculate and insert checksum
    const checksum = this.calculateChecksum(message);
    message += `10=${checksum}${this.SOH}`;

    return message;
  }

  private calculateChecksum(message: string): string {
    let sum = 0;
    for (let i = 0; i < message.length; i++) {
      sum += message.charCodeAt(i);
    }
    return (sum % 256).toString().padStart(3, "0");
  }

  private getCurrentTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace(/[-:]/g, "").split(".")[0];
  }

  private handleMessage(data: string): void {
    const messages = data.split(this.SOH);
    for (const message of messages) {
      if (!message.trim()) continue;

      const fields = this.parseFixMessage(message);
      const msgType = fields.get("35");

      switch (msgType) {
        case "A": // Logon
          this.handleLogon(fields);
          break;
        case "0": // Heartbeat
          this.handleHeartbeat(fields);
          break;
        case "1": // Test Request
          this.handleTestRequest(fields);
          break;
        case "3": // Reject
          this.handleReject(fields);
          break;
        case "5": // Logout
          this.handleLogout(fields);
          break;
        default:
          this.emit("message", fields);
      }
    }
  }

  private parseFixMessage(message: string): Map<string, string> {
    const fields = new Map<string, string>();
    const pairs = message.split(this.SOH);

    for (const pair of pairs) {
      const [tag, value] = pair.split("=");
      if (tag && value) {
        fields.set(tag, value);
      }
    }

    return fields;
  }

  private handleLogon(fields: Map<string, string>): void {
    console.log("Received Logon response");
    this.emit("logon", fields);
  }

  private handleHeartbeat(fields: Map<string, string>): void {
    console.log("Received Heartbeat");
    this.emit("heartbeat", fields);
  }

  private handleTestRequest(fields: Map<string, string>): void {
    const testReqID = fields.get("112");
    if (testReqID) {
      this.sendHeartbeat(testReqID);
    }
  }

  private handleReject(fields: Map<string, string>): void {
    console.error("Received Reject:", fields);
    this.emit("reject", fields);
  }

  private handleLogout(fields: Map<string, string>): void {
    console.log("Received Logout");
    this.emit("logout", fields);
    this.disconnect();
  }

  private sendHeartbeat(testReqID?: string): void {
    const fields = [
      ["8", "FIX.4.4"],
      ["9", "0"],
      ["35", "0"],
      ["34", this.messageSequence.toString()],
      ["49", this.config.senderCompID],
      ["56", this.config.targetCompID],
      ["52", this.getCurrentTimestamp()],
    ];

    if (testReqID) {
      fields.push(["112", testReqID]);
    }

    this.sendMessage(this.formatFixMessage(fields));
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public sendMessage(message: string): void {
    if (!this.socket || !this.connected) {
      throw new Error("Not connected to FIX server");
    }
    this.socket.write(message);
    this.messageSequence++;
  }

  public disconnect(): void {
    if (this.socket) {
      this.stopHeartbeat();
      this.socket.end();
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }
}

import { EventEmitter } from "events";
import { Socket } from "net";
import { TLSSocket, connect as tlsConnect } from "tls";
import { FixConnectionConfig, FixMessage } from "../../types/fix/config";
import { FixMessageBuilder } from "./utils/FixMessageBuilder";
import { FixMessageParser } from "./utils/FixMessageParser";
import { logger } from "../../utils/logger";

export class FixConnection extends EventEmitter {
  private socket: Socket | TLSSocket | null = null;
  private config: FixConnectionConfig;
  private messageParser: FixMessageParser;
  private messageBuffer: string = "";
  private isConnected: boolean = false;
  private seqNum: number = 1;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private testRequestTimeout: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly TEST_REQUEST_TIMEOUT = 5000; // 5 seconds

  constructor(config: FixConnectionConfig) {
    super();
    this.config = config;
    this.messageParser = new FixMessageParser();
  }

  public async connect(): Promise<void> {
    try {
      if (this.config.useSSL) {
        this.socket = tlsConnect({
          host: this.config.host,
          port: this.config.port,
          rejectUnauthorized: false, // TODO: Use proper SSL certificates
        });
      } else {
        this.socket = new Socket();
        await new Promise<void>((resolve, reject) => {
          this.socket!.connect(this.config.port, this.config.host, () =>
            resolve()
          );
          this.socket!.once("error", reject);
        });
      }

      this.setupSocketHandlers();
      await this.sendLogon();
      this.startHeartbeat();
    } catch (error) {
      logger.error("Failed to connect:", error);
      throw error;
    }
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on("data", (data) => {
      this.messageBuffer += data.toString();
      this.processMessages();
    });

    this.socket.on("close", () => {
      this.handleDisconnect();
    });

    this.socket.on("error", (error) => {
      logger.error("Socket error:", error);
      this.emit("error", error);
    });
  }

  private processMessages(): void {
    const messages = this.messageBuffer.split("\x01");
    this.messageBuffer = messages.pop() || "";

    for (const message of messages) {
      if (!message) continue;

      const fixMessage = this.messageParser.parse(message + "\x01");
      if (!this.messageParser.isValid(fixMessage.rawMessage)) {
        logger.error("Invalid FIX message:", fixMessage);
        continue;
      }

      this.handleMessage(fixMessage);
    }
  }

  private handleMessage(message: FixMessage): void {
    switch (message.type) {
      case "0": // Heartbeat
        this.handleHeartbeat(message);
        break;
      case "1": // Test Request
        this.handleTestRequest(message);
        break;
      case "2": // Resend Request
        this.handleResendRequest(message);
        break;
      case "3": // Reject
        this.handleReject(message);
        break;
      case "4": // Sequence Reset
        this.handleSequenceReset(message);
        break;
      case "5": // Logout
        this.handleLogout(message);
        break;
      case "A": // Logon
        this.handleLogon(message);
        break;
      default:
        this.emit("message", message);
    }
  }

  private handleHeartbeat(message: FixMessage): void {
    if (this.testRequestTimeout) {
      clearTimeout(this.testRequestTimeout);
      this.testRequestTimeout = null;
    }
    this.emit("heartbeat", message);
  }

  private handleTestRequest(message: FixMessage): void {
    const testReqID = message.parsedMessage["112"];
    if (testReqID) {
      this.sendHeartbeat(testReqID);
    }
  }

  private handleResendRequest(message: FixMessage): void {
    // TODO: Implement message resend logic
    logger.warn("Resend request not implemented:", message);
  }

  private handleReject(message: FixMessage): void {
    logger.error("Message rejected:", message);
    this.emit("reject", message);
  }

  private handleSequenceReset(message: FixMessage): void {
    const newSeqNo = parseInt(message.parsedMessage["36"]);
    if (!isNaN(newSeqNo)) {
      this.seqNum = newSeqNo;
    }
  }

  private handleLogout(message: FixMessage): void {
    logger.info("Received logout:", message);
    this.disconnect();
  }

  private handleLogon(message: FixMessage): void {
    this.isConnected = true;
    this.emit("connect");
  }

  private async sendLogon(): Promise<void> {
    const logon = FixMessageBuilder.createLogon(
      this.config.senderCompID,
      this.config.targetCompID,
      this.seqNum++,
      this.config.resetOnLogon
    );
    await this.send(logon);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL) as unknown as NodeJS.Timeout;
  }

  private async sendHeartbeat(testReqID?: string): Promise<void> {
    const heartbeat = FixMessageBuilder.createHeartbeat(
      this.config.senderCompID,
      this.config.targetCompID,
      this.seqNum++
    );
    if (testReqID) {
      heartbeat.parsedMessage["112"] = testReqID;
    }
    await this.send(heartbeat);
  }

  public async send(message: FixMessage): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error("Not connected");
    }

    return new Promise<void>((resolve, reject) => {
      this.socket!.write(message.rawMessage, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  public async disconnect(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.testRequestTimeout) {
      clearTimeout(this.testRequestTimeout);
      this.testRequestTimeout = null;
    }

    if (this.isConnected) {
      try {
        const logout = FixMessageBuilder.createLogout(
          this.config.senderCompID,
          this.config.targetCompID,
          this.seqNum++
        );
        await this.send(logout);
      } catch (error) {
        logger.error("Error sending logout message:", error);
      }
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.isConnected = false;
    this.emit("disconnect");
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.testRequestTimeout) {
      clearTimeout(this.testRequestTimeout);
      this.testRequestTimeout = null;
    }
    this.emit("disconnect");
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }
}

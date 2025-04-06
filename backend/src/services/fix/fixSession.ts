import { FixClient } from "nodefix";
import { FixConnectionConfig, FixMessage, FixError } from "../../types/fix";
import { logger } from "../../utils/logger";
import { EventEmitter } from "events";
import { Socket } from "net";

export class FixSession extends EventEmitter {
  private client: FixClient;
  private readonly config: FixConnectionConfig;
  private isConnected: boolean = false;
  private socket: Socket | null = null;

  constructor(config: FixConnectionConfig) {
    super();
    this.config = config;
    this.client = this.createClient();
  }

  private createClient(): FixClient {
    return new FixClient(
      this.config.host,
      this.config.port,
      this.config.fixVersion,
      this.config.dictionary,
      this.config.senderCompID,
      this.config.targetCompID,
      {
        heartbeat: this.config.heartbeat,
        credentials: this.config.credentials,
        ssl: this.config.ssl,
        resetOnLogon: this.config.resetOnLogon,
      }
    );
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.createConnection((error, client) => {
        if (error) {
          reject(error);
          return;
        }

        this.client = client;
        this.socket = client.socket;
        this.isConnected = true;

        this.client.on("connect", () => {
          this.emit("connect");
        });

        this.client.on("disconnect", () => {
          this.isConnected = false;
          this.emit("disconnect");
        });

        this.client.on("error", (error: Error) => {
          this.emit("error", error);
        });

        this.client.on("msg", (message: FixMessage) => {
          this.emit("message", message);
        });

        resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      try {
        // Send logoff message first
        await this.sendLogoff();

        // Wait a bit for the logoff to be processed
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Close the socket if it exists
        if (this.socket) {
          try {
            // End the socket (sends FIN packet)
            this.socket.end();

            // Wait for the socket to finish
            await new Promise((resolve) => {
              if (this.socket) {
                this.socket.once("close", resolve);

                // Force close after timeout
                setTimeout(() => {
                  if (this.socket) {
                    this.socket.destroy();
                    resolve(undefined);
                  }
                }, 1000);
              } else {
                resolve(undefined);
              }
            });
          } catch (error) {
            logger.error("Error closing socket:", error);
          }
        }

        // Cleanup client
        if (this.client) {
          try {
            this.client.removeAllListeners();
          } catch (error) {
            logger.error("Error cleaning up client:", error);
          }
        }
      } catch (error) {
        logger.error("Error during disconnect:", error);
      } finally {
        this.isConnected = false;
        this.socket = null;
        this.emit("disconnect");
      }
    }
  }

  async send(message: FixMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error("Not connected to FIX server"));
        return;
      }

      this.client.sendMsg(message, (response) => {
        resolve();
      });
    });
  }

  async sendLogon(): Promise<void> {
    if (!this.isConnected) {
      throw new Error("Not connected to FIX server");
    }
    this.client.sendLogon();
  }

  async sendLogoff(): Promise<void> {
    if (!this.isConnected) {
      throw new Error("Not connected to FIX server");
    }
    this.client.sendLogoff();
  }

  isSessionConnected(): boolean {
    return this.isConnected;
  }
}

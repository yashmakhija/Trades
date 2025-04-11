import { FixMessage } from "../../../types/fix/config";

export class FixMessageBuilder {
  private fields: Map<number, string>;
  private readonly SOH = "\x01";

  constructor() {
    this.fields = new Map();
  }

  public setField(tag: number, value: string): this {
    this.fields.set(tag, value);
    return this;
  }

  public setBeginString(value: string = "FIX.4.4"): this {
    return this.setField(8, value);
  }

  public setBodyLength(value: number): this {
    return this.setField(9, value.toString());
  }

  public setMsgType(value: string): this {
    return this.setField(35, value);
  }

  public setSenderCompID(value: string): this {
    return this.setField(49, value);
  }

  public setTargetCompID(value: string): this {
    return this.setField(56, value);
  }

  public setMsgSeqNum(value: number): this {
    return this.setField(34, value.toString());
  }

  public setSendingTime(value: Date = new Date()): this {
    return this.setField(52, this.formatDateTime(value));
  }

  public build(): FixMessage {
    const bodyFields = Array.from(this.fields.entries())
      .filter(([tag]) => tag !== 8 && tag !== 9 && tag !== 10)
      .sort(([a], [b]) => a - b)
      .map(([tag, value]) => `${tag}=${value}${this.SOH}`)
      .join("");

    const header = `8=FIX.4.4${this.SOH}9=${bodyFields.length}${this.SOH}`;
    const message = header + bodyFields;
    const checksum = this.calculateChecksum(message);
    const fullMessage = message + `10=${checksum}${this.SOH}`;

    return {
      msgType: this.fields.get(35) || "",
      senderCompID: this.fields.get(49) || "",
      targetCompID: this.fields.get(56) || "",
      msgSeqNum: parseInt(this.fields.get(34) || "0"),
      sendingTime: this.fields.get(52) || "",
      rawMessage: fullMessage,
      parsedMessage: Object.fromEntries(this.fields),
    };
  }

  private calculateChecksum(message: string): string {
    let sum = 0;
    for (let i = 0; i < message.length; i++) {
      sum += message.charCodeAt(i);
    }
    return (sum % 256).toString().padStart(3, "0");
  }

  private formatDateTime(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  }

  public static createLogon(
    senderCompID: string,
    targetCompID: string,
    seqNum: number,
    resetSeqNum: boolean = false
  ): FixMessage {
    return new FixMessageBuilder()
      .setBeginString()
      .setMsgType("A") // Logon
      .setSenderCompID(senderCompID)
      .setTargetCompID(targetCompID)
      .setMsgSeqNum(seqNum)
      .setSendingTime()
      .setField(98, "0") // EncryptMethod: None
      .setField(108, "30") // HeartBtInt: 30 seconds
      .setField(141, resetSeqNum ? "Y" : "N") // ResetSeqNumFlag
      .build();
  }

  public static createHeartbeat(
    senderCompID: string,
    targetCompID: string,
    seqNum: number
  ): FixMessage {
    return new FixMessageBuilder()
      .setBeginString()
      .setMsgType("0") // Heartbeat
      .setSenderCompID(senderCompID)
      .setTargetCompID(targetCompID)
      .setMsgSeqNum(seqNum)
      .setSendingTime()
      .build();
  }

  public static createTestRequest(
    senderCompID: string,
    targetCompID: string,
    seqNum: number,
    testReqID: string
  ): FixMessage {
    return new FixMessageBuilder()
      .setBeginString()
      .setMsgType("1") // Test Request
      .setSenderCompID(senderCompID)
      .setTargetCompID(targetCompID)
      .setMsgSeqNum(seqNum)
      .setSendingTime()
      .setField(112, testReqID) // TestReqID
      .build();
  }

  public static createResendRequest(
    senderCompID: string,
    targetCompID: string,
    seqNum: number,
    beginSeqNo: number,
    endSeqNo: number = 0
  ): FixMessage {
    return new FixMessageBuilder()
      .setBeginString()
      .setMsgType("2") // Resend Request
      .setSenderCompID(senderCompID)
      .setTargetCompID(targetCompID)
      .setMsgSeqNum(seqNum)
      .setSendingTime()
      .setField(7, beginSeqNo.toString()) // BeginSeqNo
      .setField(16, endSeqNo.toString()) // EndSeqNo
      .build();
  }

  public static createReject(
    senderCompID: string,
    targetCompID: string,
    seqNum: number,
    refSeqNum: number,
    reason: string
  ): FixMessage {
    return new FixMessageBuilder()
      .setBeginString()
      .setMsgType("3") // Reject
      .setSenderCompID(senderCompID)
      .setTargetCompID(targetCompID)
      .setMsgSeqNum(seqNum)
      .setSendingTime()
      .setField(45, refSeqNum.toString()) // RefSeqNum
      .setField(58, reason) // Text
      .build();
  }

  public static createLogout(
    senderCompID: string,
    targetCompID: string,
    seqNum: number,
    reason?: string
  ): FixMessage {
    const builder = new FixMessageBuilder()
      .setBeginString()
      .setMsgType("5") // Logout
      .setSenderCompID(senderCompID)
      .setTargetCompID(targetCompID)
      .setMsgSeqNum(seqNum)
      .setSendingTime();

    if (reason) {
      builder.setField(58, reason); // Text
    }

    return builder.build();
  }
}

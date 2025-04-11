import { FixMessage } from "../../../types/fix/config";

export class FixMessageParser {
  private readonly SOH = "\x01";

  public parse(message: string): FixMessage {
    const fields = new Map<string, string>();
    const pairs = message.split(this.SOH);

    for (const pair of pairs) {
      if (!pair) continue;
      const [tag, value] = pair.split("=");
      if (tag && value) {
        fields.set(tag, value);
      }
    }

    return {
      type: fields.get("35") || "",
      fields: Object.fromEntries(fields),
      rawMessage: message,
    };
  }

  public isValid(message: string): boolean {
    try {
      // Check if message starts with 8=FIX
      if (!message.startsWith("8=FIX")) {
        return false;
      }

      // Split into fields
      const fields = message.split(this.SOH);
      if (fields.length < 3) {
        return false;
      }

      // Extract body length
      const bodyLengthField = fields.find((f) => f.startsWith("9="));
      if (!bodyLengthField) {
        return false;
      }

      const bodyLength = parseInt(bodyLengthField.split("=")[1]);
      if (isNaN(bodyLength)) {
        return false;
      }

      // Extract checksum
      const checksumField = fields[fields.length - 2];
      if (!checksumField || !checksumField.startsWith("10=")) {
        return false;
      }

      const checksum = parseInt(checksumField.split("=")[1]);
      if (isNaN(checksum)) {
        return false;
      }

      // Calculate actual body length and checksum
      const bodyStart = message.indexOf("35=");
      const bodyEnd = message.lastIndexOf("10=");
      if (bodyStart === -1 || bodyEnd === -1) {
        return false;
      }

      const actualBody = message.substring(bodyStart, bodyEnd);
      const actualBodyLength = actualBody.length;

      if (actualBodyLength !== bodyLength) {
        return false;
      }

      const calculatedChecksum = this.calculateChecksum(
        message.substring(0, bodyEnd)
      );
      if (calculatedChecksum !== checksum) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  private calculateChecksum(message: string): number {
    let sum = 0;
    for (let i = 0; i < message.length; i++) {
      sum += message.charCodeAt(i);
    }
    return sum % 256;
  }

  public static getMsgType(message: string): string {
    const match = message.match(/35=([^\x01]+)/);
    return match ? match[1] : "";
  }

  public static getField(message: string, tag: number): string {
    const match = message.match(new RegExp(`${tag}=([^\x01]+)`));
    return match ? match[1] : "";
  }
}

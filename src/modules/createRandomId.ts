import { getRandomValues } from "crypto";

export default function createRandomId(length = 8): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from(getRandomValues(new Uint8Array(length)), b => chars[b % chars.length]).join("");
}
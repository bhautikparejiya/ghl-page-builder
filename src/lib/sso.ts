import CryptoJS from "crypto-js";
import { config } from "./config";

/** Shape of the user context HighLevel sends to Custom Pages (REQUEST_USER_DATA_RESPONSE). */
export interface GhlUserContext {
  userId: string;
  companyId: string;
  role: string;
  type: "agency" | "location";
  activeLocation?: string;
  userName?: string;
  email?: string;
}

/** Decrypts the AES payload using the app's Shared Secret (SSO key) from the Developer portal. */
export function decryptUserContext(encrypted: string): GhlUserContext {
  if (!config.ssoKey) throw new Error("GHL_SSO_KEY is not configured");
  const json = CryptoJS.AES.decrypt(encrypted, config.ssoKey).toString(CryptoJS.enc.Utf8);
  if (!json) throw new Error("Unable to decrypt user context (wrong SSO key?)");
  return JSON.parse(json) as GhlUserContext;
}

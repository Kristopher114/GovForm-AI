import { getOcrSettings, saveDesktopIp } from "./ocr-settings";

// Default or configured Firebase Project ID
// Can be set via EXPO_PUBLIC_FIREBASE_PROJECT_ID in .env
const FIREBASE_PROJECT_ID =
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "";

export interface RemoteServerConfig {
  url: string;
  updatedAt?: number;
}

/**
 * Fetches the active desktop/Cloudflare server URL from Google Cloud Firestore
 * using the lightweight REST API (zero extra npm packages required).
 */
export async function fetchRemoteServerUrl(
  projectId: string = FIREBASE_PROJECT_ID
): Promise<RemoteServerConfig | null> {
  const pid = projectId.trim();
  if (!pid) {
    return null;
  }

  const endpoint = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/settings/server`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`Firestore remote config returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    const fields = data?.fields;
    const desktopUrl = fields?.desktop_url?.stringValue;
    const updatedAt = fields?.updated_at?.integerValue
      ? parseInt(fields.updated_at.integerValue, 10)
      : undefined;

    if (desktopUrl && typeof desktopUrl === "string") {
      return {
        url: desktopUrl.trim(),
        updatedAt,
      };
    }

    return null;
  } catch (error) {
    console.warn("Failed to fetch remote server URL from Firestore:", error);
    return null;
  }
}

/**
 * Auto-sync helper: fetches the latest URL from Firestore and saves it
 * to local AsyncStorage if it's new. Returns the active URL.
 */
export async function syncRemoteServerUrl(
  projectId: string = FIREBASE_PROJECT_ID
): Promise<string | null> {
  const remote = await fetchRemoteServerUrl(projectId);
  if (remote?.url) {
    const current = await getOcrSettings();
    if (current.desktopIp !== remote.url) {
      await saveDesktopIp(remote.url);
      console.log(`[RemoteConfig] Updated desktop URL to: ${remote.url}`);
    }
    return remote.url;
  }
  return null;
}

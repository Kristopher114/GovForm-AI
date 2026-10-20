import { getOcrSettings, OcrMode, saveDesktopIp, saveOcrMode } from "./ocr-settings";

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

/**
 * Normalizes a server URL or IP address:
 * - If already starts with http:// or https://: preserves protocol and strips trailing slash.
 * - If an IP address or localhost (e.g. 192.168.137.1, 10.0.2.2, localhost):
 *   prepends http:// and adds port :8000 if no port is specified.
 * - If a domain name (e.g. *.trycloudflare.com):
 *   prepends https://.
 */
export function formatServerUrl(rawUrl?: string): string {
  let url = (rawUrl || "").trim().replace(/\/+$/, "");
  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Detect IP address (e.g. 192.168.137.1 or 192.168.137.1:8000) or localhost
  const isIpOrLocal =
    /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(url) ||
    url.startsWith("localhost") ||
    url.startsWith("127.0.0.1");

  if (isIpOrLocal) {
    if (!url.includes(":")) {
      url = `${url}:8000`;
    }
    return `http://${url}`;
  }

  // Domain name (e.g. Cloudflare tunnel)
  return `https://${url}`;
}

export interface PrimaryHostHealth {
  isAvailable: boolean;
  url: string;
  statusCode?: number;
  error?: string;
}

/**
 * Pings the primary processing host /health endpoint to verify connectivity.
 */
export async function checkPrimaryHostHealth(targetUrl?: string): Promise<PrimaryHostHealth> {
  let rawUrl = (targetUrl || "").trim();
  if (!rawUrl) {
    const settings = await getOcrSettings();
    rawUrl = settings.desktopIp.trim();
  }

  if (!rawUrl) {
    return { isAvailable: false, url: "", error: "No primary host URL configured" };
  }

  const url = formatServerUrl(rawUrl);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(`${url}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok || (response.status >= 200 && response.status < 500)) {
      return { isAvailable: true, url, statusCode: response.status };
    }
    return {
      isAvailable: false,
      url,
      statusCode: response.status,
      error: `Primary host returned status ${response.status}`,
    };
  } catch (e) {
    // If it was an IP without an explicit port that failed on 8000, test 5000 as fallback
    if (/^http:\/\/(\d{1,3}\.){3}\d{1,3}:8000$/.test(url)) {
      const fallbackUrl = url.replace(':8000', ':5000');
      try {
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 2000);
        const res2 = await fetch(`${fallbackUrl}/health`, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller2.signal,
        });
        clearTimeout(timeout2);
        if (res2.ok || (res2.status >= 200 && res2.status < 500)) {
          return { isAvailable: true, url: fallbackUrl, statusCode: res2.status };
        }
      } catch {
        // ignore fallback error
      }
    }

    return {
      isAvailable: false,
      url,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

let hasCheckedOnLaunch = false;

export interface StartupWorkflowResult {
  mode: OcrMode;
  isPrimaryAvailable: boolean;
  fallbackTriggered: boolean;
  url: string;
  error?: string;
}

/**
 * Thesis Operational Workflow:
 * Begins when the user launches the mobile application.
 * The system attempts to connect to the primary processing host.
 * If the backend server is down, offline, or temporarily unavailable,
 * the application immediately displays an informative service status alert
 * and seamlessly routes image processing to the on-device Google ML Kit engine
 * as a local client-side fallback.
 */
export async function runStartupHostWorkflow(options?: {
  force?: boolean;
}): Promise<StartupWorkflowResult> {
  if (hasCheckedOnLaunch && !options?.force) {
    const settings = await getOcrSettings();
    return {
      mode: settings.mode,
      isPrimaryAvailable: settings.mode === "desktop",
      fallbackTriggered: false,
      url: settings.desktopIp,
    };
  }
  hasCheckedOnLaunch = true;

  // 1. Sync remote server URL from Firestore (if available)
  let activeUrl: string | null = null;
  try {
    activeUrl = await syncRemoteServerUrl();
  } catch (err) {
    console.warn("[StartupWorkflow] Cloud remote sync failed:", err);
  }

  const settings = await getOcrSettings();
  const hostUrl = activeUrl || settings.desktopIp;

  // 2. Attempt to connect to primary processing host
  const health = await checkPrimaryHostHealth(hostUrl);

  if (health.isAvailable) {
    console.log(`[StartupWorkflow] Successfully connected to primary processing host (${health.url}).`);
    await saveOcrMode("desktop");
    return {
      mode: "desktop",
      isPrimaryAvailable: true,
      fallbackTriggered: false,
      url: health.url,
    };
  } else {
    console.warn(
      `[StartupWorkflow] Primary processing host is offline/unavailable (${health.error || "unreachable"}). Falling back to Google ML Kit.`
    );
    // Seamlessly route image processing to on-device Google ML Kit engine as local client-side fallback
    await saveOcrMode("native");
    return {
      mode: "native",
      isPrimaryAvailable: false,
      fallbackTriggered: true,
      url: health.url,
      error: health.error,
    };
  }
}


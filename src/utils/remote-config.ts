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
  let url = (targetUrl || "").trim();
  if (!url) {
    const settings = await getOcrSettings();
    url = settings.desktopIp.trim();
  }

  if (!url) {
    return { isAvailable: false, url: "", error: "No primary host URL configured" };
  }

  url = url.replace(/\/+$/, "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

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


/** Stable Monday.com integration identifiers used across OAuth, automations, and MCP. */
export const MONDAY_API_URL = "https://api.monday.com/v2";
export const MONDAY_AUTH_URL = "https://auth.monday.com/oauth2/authorize";
export const MONDAY_TOKEN_URL = "https://auth.monday.com/oauth2/token";
export const MONDAY_API_VERSION = "2024-10";
export const MONDAY_OAUTH_STATE_COOKIE = "monday_oauth_state";
export const MONDAY_OAUTH_EMAIL_COOKIE = "monday_oauth_email";
export const MONDAY_OAUTH_STATE_MAX_AGE_SEC = 600;
export const MONDAY_AUTH_FETCH_TIMEOUT_MS = 20_000;
export const MONDAY_API_FETCH_TIMEOUT_MS = 20_000;
/** Monday items_page max page size. */
export const MONDAY_ITEMS_PAGE_SIZE = 500;
/** Safety cap for Load media board scans. */
export const MONDAY_MAX_MEDIA_ITEMS = 5_000;
export const MONDAY_MAX_ITEM_PAGES = 20;

/**
 * Scopes the Monday Developer Center app must enable.
 * Authorize never sends `scope` (including when MONDAY_SCOPES is set), because
 * Monday rejects any list that does not exactly match the app configuration
 * (`invalid_scope` / "Invalid scope param").
 */
export const DEFAULT_MONDAY_SCOPES = [
  "me:read",
  "boards:read",
  "boards:write",
  "webhooks:read",
  "webhooks:write",
  "assets:read",
] as const;

export const MONDAY_CALLBACK_PATH = "/api/integrations/monday/callback";
export const MONDAY_FORCE_INSTALL_PARAM = "true";
export const MONDAY_INSTALL_RESPONSE_TYPE = "install";
/** Official Monday Developer Center “Add to monday.com” button artwork. */
export const MONDAY_ADD_TO_MONDAY_IMAGE_URL =
  "https://dapulse-res.cloudinary.com/image/upload/f_auto,q_auto/remote_mondaycom_static/uploads/Tal/4b5d9548-0598-436e-a5b6-9bc5f29ee1d9_Group12441.png";
export const MONDAY_ADD_TO_MONDAY_IMAGE_HEIGHT = 32;

export const MONDAY_AUTOMATION_TRIGGER = Object.freeze({
  service: "monday",
  event: "Status Changed",
  defaultStatusColumn: "Status",
});

export const MONDAY_ACTION_SERVICE = "monday";

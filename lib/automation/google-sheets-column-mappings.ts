export type GoogleSheetsColumnMappingSourceType = "static" | "trigger" | "action" | "template" | "spend";

export interface GoogleSheetsColumnMapping {
  column: string;
  sourceType: GoogleSheetsColumnMappingSourceType;
  value: string;
}

const COLUMN_MAPPING_SOURCE_TYPES = new Set<GoogleSheetsColumnMappingSourceType>([
  "static",
  "trigger",
  "action",
  "template",
  "spend",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isColumnMappingSourceType(value: unknown): value is GoogleSheetsColumnMappingSourceType {
  return typeof value === "string" && COLUMN_MAPPING_SOURCE_TYPES.has(value as GoogleSheetsColumnMappingSourceType);
}

function parseColumnMappingEntry(column: string, value: unknown): GoogleSheetsColumnMapping | null {
  const normalizedColumn = column.trim().toUpperCase();
  if (!normalizedColumn) return null;

  if (isRecord(value) && ("value" in value || "sourceType" in value)) {
    return {
      column:
        typeof value.column === "string" && value.column.trim() ? value.column.trim().toUpperCase() : normalizedColumn,
      sourceType: isColumnMappingSourceType(value.sourceType) ? value.sourceType : "static",
      value: typeof value.value === "string" ? value.value : String(value.value ?? ""),
    };
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return {
      column: normalizedColumn,
      sourceType: "static",
      value: String(value),
    };
  }

  return null;
}

/**
 * Normalizes Google Sheets column mappings from persisted automation config.
 * Supports the array schema used by the builder and legacy object maps like `{ "O": "Uploaded" }`.
 */
export function normalizeGoogleSheetsColumnMappings(raw: unknown): GoogleSheetsColumnMapping[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        if (!isRecord(entry)) return null;
        const column = typeof entry.column === "string" ? entry.column : "";
        return parseColumnMappingEntry(column, entry);
      })
      .filter((entry): entry is GoogleSheetsColumnMapping => entry !== null);
  }

  if (isRecord(raw)) {
    return Object.entries(raw)
      .map(([column, value]) => parseColumnMappingEntry(column, value))
      .filter((entry): entry is GoogleSheetsColumnMapping => entry !== null);
  }

  return [];
}

/** Normalizes legacy Google Sheets action config before it enters the builder panel. */
export function normalizeGoogleSheetsNodeConfig(config: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!config) return {};
  if (config.columnMappings == null || Array.isArray(config.columnMappings)) {
    return { ...config };
  }
  return {
    ...config,
    columnMappings: normalizeGoogleSheetsColumnMappings(config.columnMappings),
  };
}

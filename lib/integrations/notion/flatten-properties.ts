import { readNotionPropertyValue } from "./read-property-value";

const LAUNCH_PROPERTY_ALIASES: ReadonlyArray<{
  readonly names: ReadonlyArray<string>;
  readonly output: string;
}> = [
  { names: ["template", "template name", "ad template"], output: "templateName" },
  { names: ["headline"], output: "headline" },
  { names: ["body", "primary text", "description", "ad copy"], output: "description" },
  { names: ["url", "link", "destination", "destination url", "landing page"], output: "linkUrl" },
  { names: ["ad set", "adset", "ad set name", "adset name"], output: "adSetName" },
  { names: ["campaign", "campaign name"], output: "campaignName" },
  { names: ["ad name", "name"], output: "adName" },
  { names: ["ad id", "adid", "source ad", "source ad id", "duplicate ad"], output: "sourceAdId" },
];

const RESERVED_OUTPUT_KEYS = new Set([
  "provider",
  "eventType",
  "pageId",
  "databaseId",
  "pageUrl",
  "pageTitle",
  "statusProperty",
  "status",
  "assetId",
  "assetName",
  "mediaUrl",
  "fileUrl",
  "mediaType",
  "assets",
  "notionProperties",
  "mapped",
]);

export interface FlattenedNotionProperties {
  readonly mapped: Readonly<Record<string, string>>;
  readonly aliases: Readonly<Record<string, string>>;
  readonly camelCase: Readonly<Record<string, string>>;
}

/** Turns Notion webhook properties into launch-ready scalars and mapped pills. */
export function flattenNotionProperties(
  properties: Readonly<Record<string, unknown>>,
  templatePropertyName?: string,
): FlattenedNotionProperties {
  const mapped: Record<string, string> = {};
  const camelCase: Record<string, string> = {};

  for (const [propertyName, propertyValue] of Object.entries(properties)) {
    const scalar = readNotionPropertyValue(propertyValue);
    if (!scalar) continue;
    mapped[propertyName] = scalar;
    const camelKey = toCamelCaseKey(propertyName);
    if (camelKey && !RESERVED_OUTPUT_KEYS.has(camelKey)) camelCase[camelKey] = scalar;
  }

  const aliases = buildLaunchAliases(mapped, templatePropertyName);
  return { mapped, aliases, camelCase };
}

function buildLaunchAliases(
  mapped: Readonly<Record<string, string>>,
  templatePropertyName?: string,
): Readonly<Record<string, string>> {
  const aliases: Record<string, string> = {};
  for (const [propertyName, value] of Object.entries(mapped)) {
    const alias = findLaunchAlias(propertyName);
    if (alias && aliases[alias] === undefined) aliases[alias] = value;
  }

  const configuredTemplate = readMappedProperty(mapped, templatePropertyName);
  if (configuredTemplate) aliases.templateName = configuredTemplate;
  if (aliases.adSetName) aliases.adsetName = aliases.adSetName;
  return aliases;
}

function findLaunchAlias(propertyName: string): string | null {
  const normalizedName = propertyName.trim().toLocaleLowerCase();
  return LAUNCH_PROPERTY_ALIASES.find((alias) => alias.names.includes(normalizedName))?.output ?? null;
}

function readMappedProperty(mapped: Readonly<Record<string, string>>, propertyName?: string): string | null {
  if (!propertyName?.trim()) return null;
  const exact = mapped[propertyName];
  if (exact) return exact;
  const normalizedName = propertyName.trim().toLocaleLowerCase();
  const match = Object.entries(mapped).find(([name]) => name.trim().toLocaleLowerCase() === normalizedName);
  return match?.[1] ?? null;
}

function toCamelCaseKey(name: string): string {
  const parts = name
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  const [first, ...rest] = parts;
  return first.toLowerCase() + rest.map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase()).join("");
}

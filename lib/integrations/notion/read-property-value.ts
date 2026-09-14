/** Reads a scalar string from a Notion database property value. */

export function readNotionPropertyValue(propertyValue: unknown): string | null {
  const directValue = readNonEmptyString(propertyValue);
  if (directValue) return directValue;
  if (typeof propertyValue === "number" && Number.isFinite(propertyValue)) return String(propertyValue);
  if (typeof propertyValue === "boolean") return propertyValue ? "true" : "false";

  const property = readRecord(propertyValue);
  if (!property) return null;

  return (
    readNamedValue(property) ??
    readRichTextList(property.title) ??
    readRichTextList(property.rich_text) ??
    readSelectLike(property) ??
    readPrimitiveFields(property) ??
    readFormulaValue(property.formula) ??
    readUniqueId(property.unique_id) ??
    readNamedValue(property.status) ??
    readNamedValue(property.select) ??
    readNamedValue(property.value)
  );
}

function readSelectLike(property: Readonly<Record<string, unknown>>): string | null {
  return (
    readNamedList(property.multi_select) ??
    readNamedList(property.people) ??
    readNamedList(property.files) ??
    readDateStart(property.date)
  );
}

function readPrimitiveFields(property: Readonly<Record<string, unknown>>): string | null {
  return (
    readNonEmptyString(property.url) ??
    readNonEmptyString(property.email) ??
    readNonEmptyString(property.phone_number) ??
    readFiniteNumber(property.number) ??
    readCheckbox(property.checkbox)
  );
}

function readFormulaValue(value: unknown): string | null {
  const formula = readRecord(value);
  if (!formula) return null;
  return (
    readNonEmptyString(formula.string) ??
    readFiniteNumber(formula.number) ??
    readCheckbox(formula.boolean) ??
    readDateStart(formula.date)
  );
}

function readUniqueId(value: unknown): string | null {
  const uniqueId = readRecord(value);
  if (!uniqueId) return null;
  const number = readFiniteNumber(uniqueId.number);
  if (!number) return null;
  const prefix = readNonEmptyString(uniqueId.prefix);
  return prefix ? `${prefix}-${number}` : number;
}

function readNamedValue(value: unknown): string | null {
  const record = readRecord(value);
  return record ? readNonEmptyString(record.name) : null;
}

function readNamedList(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const names = value
    .map((item) => readNamedValue(item) ?? readNonEmptyString(item))
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.join(", ") : null;
}

function readRichTextList(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const text = value.map(readRichText).join("").trim();
  return text || null;
}

function readRichText(value: unknown): string {
  const richText = readRecord(value);
  const text = readRecord(richText?.text);
  if (typeof richText?.plain_text === "string") return richText.plain_text;
  if (typeof text?.content === "string") return text.content;
  return "";
}

function readDateStart(value: unknown): string | null {
  const date = readRecord(value);
  return date ? readNonEmptyString(date.start) : null;
}

function readCheckbox(value: unknown): string | null {
  return typeof value === "boolean" ? (value ? "true" : "false") : null;
}

function readFiniteNumber(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return isRecord(value) ? value : null;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

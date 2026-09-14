/** Match only the Sheets client's contextualized permission verdict, not all 403s. */
export function isSheetsPermissionFailure(message: string): boolean {
  return /^Spreadsheet "[^\r\n]+", sheet "[^\r\n]+": The caller does not have permission\.?$/.test(message.trim());
}

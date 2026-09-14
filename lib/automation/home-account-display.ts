import { pickHumanAccountName, resolveAutomationAccountDisplay } from "./automation-table-account-display";

export interface HomePageProfile {
  readonly name: string;
  readonly picture: string | null;
}

export interface HomeAccountCellModel {
  readonly label: string;
  readonly pictureUrl: string | null;
  readonly overflowCount: number;
  readonly title: string;
  readonly isPage: boolean;
}

const EMPTY_ACCOUNT_LABEL = "—";
const PLACEHOLDER_ACCOUNT_LABEL = "-";

function firstResolvedPage(
  pageIds: readonly string[],
  pageProfiles: ReadonlyMap<string, HomePageProfile>,
): HomePageProfile | null {
  for (const pageId of pageIds) {
    const profile = pageProfiles.get(pageId);
    if (profile) return profile;
  }
  return null;
}

function isUsableAccountLabel(value: string | null | undefined): value is string {
  return Boolean(value) && value !== PLACEHOLDER_ACCOUNT_LABEL;
}

function accountLabelFromDisplay(displayLabel: string, accountId: string | null): string {
  const humanName = pickHumanAccountName([displayLabel], accountId);
  if (isUsableAccountLabel(humanName)) return humanName;
  if (isUsableAccountLabel(displayLabel)) return displayLabel;
  return EMPTY_ACCOUNT_LABEL;
}

/**
 * What the home list's Ad account column shows.
 *
 * Comment automations run on a page, so a resolved page profile wins. Flow
 * automations (and comment rows whose pages have not loaded yet) show the
 * human ad-account name rather than a raw `act_` id.
 */
export function resolveHomeAccountCell(input: {
  readonly accountId: string | null;
  readonly accountName: string | null;
  readonly pageIds: readonly string[];
  readonly pageProfiles: ReadonlyMap<string, HomePageProfile>;
  readonly accountLookup: ReadonlyMap<string, string>;
}): HomeAccountCellModel {
  const page = firstResolvedPage(input.pageIds, input.pageProfiles);
  if (page) {
    const pageNames = input.pageIds.map((pageId) => input.pageProfiles.get(pageId)?.name ?? pageId);
    return {
      label: page.name,
      pictureUrl: page.picture,
      overflowCount: Math.max(0, input.pageIds.length - 1),
      title: pageNames.join(", "),
      isPage: true,
    };
  }

  const display = resolveAutomationAccountDisplay({
    accountId: input.accountId,
    accountName: input.accountName,
    lookup: input.accountLookup,
  });
  const label = accountLabelFromDisplay(display.label, input.accountId);
  return {
    label,
    pictureUrl: null,
    overflowCount: 0,
    title: label,
    isPage: false,
  };
}

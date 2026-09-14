export interface ComposerAttachment {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly imageUrl: string | null;
}

export interface ComposerDraft {
  readonly text: string;
  readonly attachment?: ComposerAttachment;
}

export type ChatSuggestion = string | ComposerDraft;

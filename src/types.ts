export type ChatMessage = {
  readonly id: string;
  readonly nickname: string;
  readonly content: string;
  readonly color: string;
  readonly createdAt: number;
};

export type ChatSnapshot = {
  readonly messages: readonly ChatMessage[];
  readonly anonymousMode: boolean;
  readonly pinnedNotice: ChatMessage | null;
  readonly chatActive: boolean;
  readonly version: number;
};

export type CommandResult =
  | { readonly ok: true; readonly error?: undefined }
  | { readonly ok: false; readonly error: string };

export type AppView =
  | 'start'
  | 'nickname_input'
  | 'chat'
  | 'admin_login'
  | 'admin_panel';

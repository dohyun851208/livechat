export interface ChatMessage {
  id: string;
  nickname: string;
  content: string;
  color: string;
}

export type AppView = 'start' | 'nickname_input' | 'chat' | 'admin_login' | 'admin_panel';

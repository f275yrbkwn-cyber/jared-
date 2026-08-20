export interface UserProfile {
  uid?: string;
  userId?: string;
  email: string | null;
  displayName: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  voice: string;
  createdAt: string;
  updatedAt?: string;
  durationSeconds?: number;
}

export interface Message {
  id: string;
  conversationId?: string;
  userId?: string;
  role: 'user' | 'model' | 'assistant' | 'system';
  text: string;
  timestamp?: string;
  createdAt?: string;
}

export interface Memory {
  id: string;
  userId: string;
  fact: string;
  createdAt: string;
}

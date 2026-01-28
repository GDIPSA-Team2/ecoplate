import { api } from "./api";

export interface Message {
  id: number;
  listingId: number;
  senderId: number;
  receiverId: number;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
}

export interface Conversation {
  listingId: number;
  listingTitle: string;
  otherUser: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface ConversationDetail {
  listing: {
    id: number;
    title: string;
    seller: {
      id: number;
      name: string;
      avatarUrl: string | null;
    };
  };
  messages: Message[];
}

export const messageService = {
  async getConversations(): Promise<Conversation[]> {
    return api.get<Conversation[]>("/marketplace/messages");
  },

  async getConversation(listingId: number): Promise<ConversationDetail> {
    return api.get<ConversationDetail>(`/marketplace/messages/${listingId}`);
  },

  async sendMessage(listingId: number, content: string): Promise<Message> {
    return api.post<Message>("/marketplace/messages", { listingId, content });
  },

  async markAsRead(messageIds: number[]): Promise<void> {
    await api.patch("/marketplace/messages/read", { messageIds });
  },

  async getUnreadCount(): Promise<{ count: number }> {
    return api.get<{ count: number }>("/marketplace/messages/unread-count");
  },
};

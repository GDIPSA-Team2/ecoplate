import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { messageService, Conversation } from "../services/messages";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { MessageCircle } from "lucide-react";

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
    // Poll for new messages every 5 seconds
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadConversations = async () => {
    try {
      const data = await messageService.getConversations();
      setConversations(data);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-gray-600">Your marketplace conversations</p>
        </div>
        {totalUnread > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">
            {totalUnread} unread
          </Badge>
        )}
      </div>

      {conversations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No conversations yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Start a conversation by messaging a seller on a listing
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <Link key={conv.listingId} to={`/messages/${conv.listingId}`}>
              <Card className={`hover:shadow-md transition-shadow ${conv.unreadCount > 0 ? 'border-primary bg-primary/5' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                        {conv.otherUser.name.charAt(0).toUpperCase()}
                      </div>
                      {conv.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {conv.unreadCount}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate ${conv.unreadCount > 0 ? 'font-bold' : 'font-medium'}`}>
                          {conv.otherUser.name}
                        </p>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        Re: {conv.listingTitle}
                      </p>
                      <p className={`text-sm truncate mt-1 ${conv.unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>
                        {conv.lastMessage}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

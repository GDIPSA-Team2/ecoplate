import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { messageService, ConversationDetail } from "../services/messages";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ArrowLeft, Send } from "lucide-react";
import { cn } from "../lib/utils";

export default function ConversationPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newMessageAlert, setNewMessageAlert] = useState(false);
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  // Load conversation and set up polling
  useEffect(() => {
    loadConversation();
    const interval = setInterval(loadConversation, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [listingId]);

  // Auto-scroll to bottom and show alert when new messages arrive
  useEffect(() => {
    if (conversation?.messages) {
      const currentCount = conversation.messages.length;
      if (prevMessageCount.current > 0 && currentCount > prevMessageCount.current) {
        // New message arrived
        const latestMessage = conversation.messages[0]; // Messages are sorted DESC
        if (latestMessage && latestMessage.senderId !== user?.id) {
          setNewMessageAlert(true);
          addToast("New message received!", "info");
          setTimeout(() => setNewMessageAlert(false), 3000);
        }
      }
      prevMessageCount.current = currentCount;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation?.messages]);

  const loadConversation = async () => {
    try {
      const data = await messageService.getConversation(Number(listingId));
      setConversation(data);
    } catch (error) {
      console.error("Failed to load conversation:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await messageService.sendMessage(Number(listingId), newMessage.trim());
      setNewMessage("");
      await loadConversation(); // Refresh messages
    } catch (error: any) {
      addToast(error.message || "Failed to send message", "error");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/messages")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Messages
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">Conversation not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Reverse messages to show oldest first (chat order)
  const sortedMessages = [...conversation.messages].reverse();

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <Card className={`mb-4 ${newMessageAlert ? 'ring-2 ring-primary animate-pulse' : ''}`}>
        <CardHeader className="py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/messages")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <CardTitle className="text-lg">{conversation.listing.title}</CardTitle>
              <p className="text-sm text-gray-500">
                with {conversation.listing.seller.name}
              </p>
            </div>
            {newMessageAlert && (
              <span className="text-xs text-primary font-medium animate-bounce">
                New message!
              </span>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Messages */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {sortedMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            sortedMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.senderId === user?.id ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[70%] rounded-lg px-4 py-2",
                    msg.senderId === user?.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="break-words">{msg.content}</p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      msg.senderId === user?.id
                        ? "text-primary-foreground/70"
                        : "text-gray-500"
                    )}
                  >
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Message Input */}
        <div className="border-t p-4">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={sending}
              className="flex-1"
            />
            <Button type="submit" disabled={sending || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

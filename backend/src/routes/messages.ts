import { Router, json, error, parseBody } from "../utils/router";
import { db } from "../index";
import { messages, marketplaceListings, users } from "../db/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "../middleware/auth";

const sendMessageSchema = z.object({
  listingId: z.number(),
  content: z.string().min(1).max(2000),
});

const markReadSchema = z.object({
  messageIds: z.array(z.number()).min(1),
});

interface ConversationType {
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

export function registerMessageRoutes(router: Router) {
  // Get all conversations for the current user
  router.get("/api/v1/marketplace/messages", async (req) => {
    try {
      const user = getUser(req);

      // Get all messages where user is sender or receiver
      const userMessages = await db.query.messages.findMany({
        where: or(
          eq(messages.senderId, user.id),
          eq(messages.receiverId, user.id)
        ),
        with: {
          listing: {
            columns: { id: true, title: true, sellerId: true },
          },
          sender: {
            columns: { id: true, name: true, avatarUrl: true },
          },
          receiver: {
            columns: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: [desc(messages.createdAt)],
      });

      // Group by listing and get latest message + unread count
      const conversationMap = new Map<number, ConversationType>();

      for (const msg of userMessages) {
        if (!conversationMap.has(msg.listingId)) {
          const otherUser = msg.senderId === user.id ? msg.receiver : msg.sender;
          conversationMap.set(msg.listingId, {
            listingId: msg.listingId,
            listingTitle: msg.listing.title,
            otherUser: {
              id: otherUser.id,
              name: otherUser.name,
              avatarUrl: otherUser.avatarUrl,
            },
            lastMessage: msg.content,
            lastMessageAt: msg.createdAt.toISOString(),
            unreadCount: 0,
          });
        }

        // Count unread messages where user is receiver
        if (msg.receiverId === user.id && !msg.isRead) {
          const conv = conversationMap.get(msg.listingId);
          if (conv) {
            conv.unreadCount++;
          }
        }
      }

      return json(Array.from(conversationMap.values()));
    } catch (e) {
      console.error("Get conversations error:", e);
      return error("Failed to fetch conversations", 500);
    }
  });

  // Get unread message count (must be before :listingId route)
  router.get("/api/v1/marketplace/messages/unread-count", async (req) => {
    try {
      const user = getUser(req);

      const unreadMessages = await db.query.messages.findMany({
        where: and(
          eq(messages.receiverId, user.id),
          eq(messages.isRead, false)
        ),
        columns: { id: true },
      });

      return json({ count: unreadMessages.length });
    } catch (e) {
      console.error("Get unread count error:", e);
      return error("Failed to get unread count", 500);
    }
  });

  // Get messages for a specific listing conversation
  router.get("/api/v1/marketplace/messages/:listingId", async (req, params) => {
    try {
      const user = getUser(req);
      const listingId = parseInt(params.listingId, 10);

      // Get the listing info
      const listing = await db.query.marketplaceListings.findFirst({
        where: eq(marketplaceListings.id, listingId),
        with: {
          seller: {
            columns: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      if (!listing) {
        return error("Listing not found", 404);
      }

      // Get all messages for this listing where user is part of the conversation
      const conversationMessages = await db.query.messages.findMany({
        where: and(
          eq(messages.listingId, listingId),
          or(
            eq(messages.senderId, user.id),
            eq(messages.receiverId, user.id)
          )
        ),
        with: {
          sender: {
            columns: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: [desc(messages.createdAt)],
      });

      // Mark messages as read where user is receiver
      const unreadIds = conversationMessages
        .filter((m) => m.receiverId === user.id && !m.isRead)
        .map((m) => m.id);

      if (unreadIds.length > 0) {
        await db
          .update(messages)
          .set({ isRead: true })
          .where(
            and(
              eq(messages.listingId, listingId),
              eq(messages.receiverId, user.id)
            )
          );
      }

      return json({
        listing: {
          id: listing.id,
          title: listing.title,
          seller: listing.seller,
        },
        messages: conversationMessages,
      });
    } catch (e) {
      console.error("Get conversation error:", e);
      return error("Failed to fetch messages", 500);
    }
  });

  // Send a message
  router.post("/api/v1/marketplace/messages", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);

      const result = sendMessageSchema.safeParse(body);
      if (!result.success) {
        const firstError = result.error.errors[0];
        return error(`${firstError.path.join(".")}: ${firstError.message}`, 400);
      }

      const { listingId, content } = result.data;

      // Get listing to determine receiver
      const listing = await db.query.marketplaceListings.findFirst({
        where: eq(marketplaceListings.id, listingId),
      });

      if (!listing) {
        return error("Listing not found", 404);
      }

      // Determine receiver
      let receiverId: number;

      if (listing.sellerId === user.id) {
        // User is seller - find the other participant from existing messages
        const existingMessage = await db.query.messages.findFirst({
          where: and(
            eq(messages.listingId, listingId),
            eq(messages.receiverId, user.id)
          ),
        });

        if (!existingMessage) {
          return error("No conversation exists to reply to", 400);
        }
        receiverId = existingMessage.senderId;
      } else {
        // User is buyer - receiver is seller
        receiverId = listing.sellerId;
      }

      const [message] = await db
        .insert(messages)
        .values({
          listingId,
          senderId: user.id,
          receiverId,
          content,
        })
        .returning();

      return json(message);
    } catch (e) {
      console.error("Send message error:", e);
      return error("Failed to send message", 500);
    }
  });

  // Mark messages as read
  router.patch("/api/v1/marketplace/messages/read", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);

      const result = markReadSchema.safeParse(body);
      if (!result.success) {
        const firstError = result.error.errors[0];
        return error(`${firstError.path.join(".")}: ${firstError.message}`, 400);
      }

      const { messageIds } = result.data;

      // Only mark messages where user is the receiver
      for (const id of messageIds) {
        await db
          .update(messages)
          .set({ isRead: true })
          .where(
            and(
              eq(messages.id, id),
              eq(messages.receiverId, user.id)
            )
          );
      }

      return json({ message: "Messages marked as read" });
    } catch (e) {
      console.error("Mark read error:", e);
      return error("Failed to mark messages as read", 500);
    }
  });
}

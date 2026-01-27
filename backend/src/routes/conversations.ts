import { Router, json, error, parseBody } from "../utils/router";
import { db } from "../index";
import {
  conversations,
  messages,
  users,
  marketplaceListings,
} from "../db/schema";
import { eq, and, desc, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "../middleware/auth";

const messageSchema = z.object({
  messageText: z.string().min(1).max(1000),
});

export function registerConversationRoutes(router: Router) {
  // Get all conversations for current user
  router.get("/api/v1/conversations", async (req) => {
    const user = getUser(req);

    const userConversations = await db.query.conversations.findMany({
      where: or(
        eq(conversations.sellerId, user.id),
        eq(conversations.buyerId, user.id)
      ),
      with: {
        listing: {
          columns: { id: true, title: true, status: true },
          with: {
            images: {
              columns: { imageUrl: true },
              limit: 1,
            },
          },
        },
        seller: {
          columns: { id: true, name: true, avatarUrl: true },
        },
        buyer: {
          columns: { id: true, name: true, avatarUrl: true },
        },
        messages: {
          orderBy: [desc(messages.createdAt)],
          limit: 1, // Get last message only
        },
      },
      orderBy: [desc(conversations.updatedAt)],
    });

    // Calculate unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      userConversations.map(async (conv) => {
        // Count unread messages (messages from other user after user's last read)
        const unreadCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conv.id),
              eq(messages.senderId, user.id === conv.sellerId ? conv.buyerId : conv.sellerId)
            )
          )
          .then((result) => Number(result[0]?.count || 0));

        // Determine the other user (who we're chatting with)
        const otherUser = user.id === conv.sellerId ? conv.buyer : conv.seller;

        return {
          ...conv,
          otherUser,
          lastMessage: conv.messages[0] || null,
          unreadCount,
        };
      })
    );

    return json(conversationsWithUnread);
  });

  // Get or create conversation between buyer and seller for a listing
  router.get(
    "/api/v1/conversations/:listingId/:otherUserId",
    async (req, params) => {
      const user = getUser(req);
      const listingId = parseInt(params.listingId, 10);
      const otherUserId = parseInt(params.otherUserId, 10);

      if (isNaN(listingId) || isNaN(otherUserId)) {
        return error("Invalid listing ID or user ID", 400);
      }

      // Get the listing to determine who is seller/buyer
      const listing = await db.query.marketplaceListings.findFirst({
        where: eq(marketplaceListings.id, listingId),
      });

      if (!listing) {
        return error("Listing not found", 404);
      }

      // Determine seller and buyer
      let sellerId: number, buyerId: number;
      if (listing.sellerId === user.id) {
        sellerId = user.id;
        buyerId = otherUserId;
      } else if (listing.sellerId === otherUserId) {
        sellerId = otherUserId;
        buyerId = user.id;
      } else {
        return error("Invalid user relationship to listing", 400);
      }

      // Check if conversation already exists
      let conversation = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.listingId, listingId),
          eq(conversations.sellerId, sellerId),
          eq(conversations.buyerId, buyerId)
        ),
        with: {
          listing: {
            with: {
              images: { limit: 1 },
            },
          },
          seller: {
            columns: { id: true, name: true, avatarUrl: true },
          },
          buyer: {
            columns: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      // If not exists, create it
      if (!conversation) {
        const [newConv] = await db
          .insert(conversations)
          .values({
            listingId,
            sellerId,
            buyerId,
          })
          .returning();

        // Fetch the complete conversation with relations
        conversation = await db.query.conversations.findFirst({
          where: eq(conversations.id, newConv.id),
          with: {
            listing: {
              with: {
                images: { limit: 1 },
              },
            },
            seller: {
              columns: { id: true, name: true, avatarUrl: true },
            },
            buyer: {
              columns: { id: true, name: true, avatarUrl: true },
            },
          },
        });
      }

      // Determine the other user
      const otherUser =
        user.id === conversation!.sellerId
          ? conversation!.buyer
          : conversation!.seller;

      return json({
        ...conversation,
        otherUser,
      });
    }
  );

  // Get conversation details by ID
  router.get("/api/v1/conversations/:id", async (req, params) => {
    const user = getUser(req);
    const conversationId = parseInt(params.id, 10);

    if (isNaN(conversationId)) {
      return error("Invalid conversation ID", 400);
    }

    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        or(
          eq(conversations.sellerId, user.id),
          eq(conversations.buyerId, user.id)
        )
      ),
      with: {
        listing: {
          with: {
            images: { limit: 1 },
          },
        },
        seller: {
          columns: { id: true, name: true, avatarUrl: true },
        },
        buyer: {
          columns: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    if (!conversation) {
      return error("Conversation not found", 404);
    }

    // Determine the other user
    const otherUser =
      user.id === conversation.sellerId
        ? conversation.buyer
        : conversation.seller;

    return json({
      ...conversation,
      otherUser,
    });
  });

  // Get messages in a conversation
  router.get("/api/v1/conversations/:id/messages", async (req, params) => {
    const user = getUser(req);
    const conversationId = parseInt(params.id, 10);

    if (isNaN(conversationId)) {
      return error("Invalid conversation ID", 400);
    }

    // Verify user is part of conversation
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        or(
          eq(conversations.sellerId, user.id),
          eq(conversations.buyerId, user.id)
        )
      ),
    });

    if (!conversation) {
      return error("Conversation not found or access denied", 404);
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const conversationMessages = await db.query.messages.findMany({
      where: eq(messages.conversationId, conversationId),
      with: {
        sender: {
          columns: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [desc(messages.createdAt)],
      limit,
      offset,
    });

    return json(conversationMessages.reverse()); // Return in chronological order
  });

  // Send message in a conversation
  router.post("/api/v1/conversations/:id/messages", async (req, params) => {
    try {
      const user = getUser(req);
      const conversationId = parseInt(params.id, 10);

      if (isNaN(conversationId)) {
        return error("Invalid conversation ID", 400);
      }

      // Verify user is part of conversation
      const conversation = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.id, conversationId),
          or(
            eq(conversations.sellerId, user.id),
            eq(conversations.buyerId, user.id)
          )
        ),
      });

      if (!conversation) {
        return error("Conversation not found or access denied", 404);
      }

      const body = await parseBody(req);
      const data = messageSchema.parse(body);

      const [message] = await db
        .insert(messages)
        .values({
          conversationId,
          senderId: user.id,
          messageText: data.messageText,
        })
        .returning();

      // Update conversation updatedAt
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));

      // Fetch message with sender info
      const messageWithSender = await db.query.messages.findFirst({
        where: eq(messages.id, message.id),
        with: {
          sender: {
            columns: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      return json(messageWithSender);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Send message error:", e);
      return error("Failed to send message", 500);
    }
  });

  // Delete message (sender only)
  router.delete("/api/v1/messages/:id", async (req, params) => {
    const user = getUser(req);
    const messageId = parseInt(params.id, 10);

    if (isNaN(messageId)) {
      return error("Invalid message ID", 400);
    }

    const message = await db.query.messages.findFirst({
      where: eq(messages.id, messageId),
    });

    if (!message) {
      return error("Message not found", 404);
    }

    if (message.senderId !== user.id) {
      return error("You can only delete your own messages", 403);
    }

    await db.delete(messages).where(eq(messages.id, messageId));

    return json({ message: "Message deleted successfully" });
  });
}

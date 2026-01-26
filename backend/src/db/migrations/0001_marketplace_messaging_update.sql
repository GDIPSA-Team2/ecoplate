-- Migration: Update schema for Marketplace and Messaging/Conversation
-- Add user_location to users table
ALTER TABLE users ADD COLUMN user_location TEXT;

-- Add buyer_id and completed_at to marketplace_listings
ALTER TABLE marketplace_listings ADD COLUMN buyer_id INTEGER REFERENCES users(id);
ALTER TABLE marketplace_listings ADD COLUMN completed_at INTEGER;

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Create new messages table with conversation_id
CREATE TABLE IF NOT EXISTS messages_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Migrate existing messages to new structure (if any exist)
-- Note: This will need manual data migration if there are existing messages
-- For now, we'll just drop the old table since this is early development
DROP TABLE IF EXISTS messages;

-- Rename new messages table
ALTER TABLE messages_new RENAME TO messages;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_listing_id ON conversations(listing_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller_id ON conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer_id ON conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_buyer_id ON marketplace_listings(buyer_id);

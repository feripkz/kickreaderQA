import { pgTable, text, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  usernameUnique: uniqueIndex('users_username_unique').on(table.username),
}));

export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  userIdIndex: index('sessions_user_id_idx').on(table.userId),
  expiresAtIndex: index('sessions_expires_at_idx').on(table.expiresAt),
}));

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  settings: jsonb('settings').notNull(),
  theme: text('theme').notNull().default('dark'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const preferences = pgTable('preferences', {
  id: text('id').primaryKey(),
  settings: jsonb('settings').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

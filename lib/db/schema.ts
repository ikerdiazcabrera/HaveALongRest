import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  jsonb,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

/** public: aparece en Explorar y cualquiera puede ver sus páginas públicas. private: solo miembros. */
export const campaignVisibility = pgEnum("campaign_visibility", ["public", "private"]);

/** open: entrar directamente. request: el máster aprueba. closed: no admite jugadores nuevos. */
export const joinPolicy = pgEnum("join_policy", ["open", "request", "closed"]);

export const campaignStatus = pgEnum("campaign_status", ["active", "paused", "finished"]);

/** owner: máster/creador (uno por campaña). editor: co-máster. player: jugador. */
export const memberRole = pgEnum("member_role", ["owner", "editor", "player"]);

export const memberStatus = pgEnum("member_status", ["active", "pending"]);

/**
 * public: cualquiera que pueda ver la campaña.
 * members: miembros activos.
 * restricted: solo los miembros de `allowedUserIds` (y el equipo de máster).
 * dm: solo owner/editores.
 */
export const pageVisibility = pgEnum("page_visibility", ["public", "members", "restricted", "dm"]);

// ─── Usuarios y sesiones ──────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio").notNull().default(""),
  favoriteGames: text("favorite_games").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("users_username_key").on(t.username),
  uniqueIndex("users_email_key").on(t.email),
]);

export const sessions = pgTable("sessions", {
  /** SHA-256 del token de la cookie: si se filtra la BD no se pueden secuestrar sesiones. */
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

// ─── Campañas ─────────────────────────────────────────────────────────────────

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull().default(""),
  /** Markdown que se muestra en la portada de la campaña. */
  description: text("description").notNull().default(""),
  gameSystem: text("game_system").notNull().default(""),
  coverImage: text("cover_image"),
  theme: text("theme").notNull().default("taberna"),
  /** Solo con theme = "custom": colores elegidos por el máster (hex validados). */
  customTheme: jsonb("custom_theme").$type<CustomTheme>(),
  visibility: campaignVisibility("visibility").notNull().default("public"),
  joinPolicy: joinPolicy("join_policy").notNull().default("request"),
  status: campaignStatus("status").notNull().default("active"),
  maxPlayers: integer("max_players"),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("campaigns_slug_key").on(t.slug),
  index("campaigns_listing_idx").on(t.visibility, t.status),
]);

export const campaignMembers = pgTable("campaign_members", {
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: memberRole("role").notNull().default("player"),
  status: memberStatus("status").notNull().default("active"),
  /** Último mensaje del chat leído, para el contador de no leídos. */
  lastReadMessageId: bigint("last_read_message_id", { mode: "number" }).notNull().default(0),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.campaignId, t.userId] }),
  index("campaign_members_user_idx").on(t.userId),
]);

// ─── Páginas (pestañas y subpáginas) ──────────────────────────────────────────

export const pages = pgTable("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  /** null = pestaña de primer nivel. */
  parentId: uuid("parent_id").references((): AnyPgColumn => pages.id, { onDelete: "set null" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  icon: text("icon").notNull().default(""),
  coverImage: text("cover_image"),
  /** Markdown. Los bloques `:::dm … :::` solo los ve el equipo de máster. */
  content: text("content").notNull().default(""),
  visibility: pageVisibility("visibility").notNull().default("members"),
  allowedUserIds: uuid("allowed_user_ids").array().notNull().default([]),
  spoilers: boolean("spoilers").notNull().default(false),
  position: integer("position").notNull().default(0),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("pages_campaign_slug_key").on(t.campaignId, t.slug),
  index("pages_tree_idx").on(t.campaignId, t.parentId, t.position),
]);

// ─── Chat de campaña ──────────────────────────────────────────────────────────

/**
 * Mensajes del chat. Sin `recipientId` es el chat de grupo; con él, un mensaje privado
 * entre `userId` y `recipientId` que solo ven esas dos personas (ni siquiera el máster).
 */
export const messages = pgTable("messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  /** null si el autor borró su cuenta (solo en el chat de grupo: los privados se borran). */
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  recipientId: uuid("recipient_id").references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  /** Solo en privados: cuándo lo leyó el destinatario. */
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("messages_campaign_idx").on(t.campaignId, t.id),
  index("messages_direct_idx").on(t.campaignId, t.recipientId, t.userId, t.id),
]);

// ─── Límites de peticiones ────────────────────────────────────────────────────

/** Contadores por ventana de tiempo (login, registro, chat…). En la BD para que funcionen en serverless. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export type CustomTheme = { accent: string; background: [string, string, string] };

export type User = typeof users.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type CampaignMember = typeof campaignMembers.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type MemberRole = (typeof memberRole.enumValues)[number];
export type PageVisibility = (typeof pageVisibility.enumValues)[number];

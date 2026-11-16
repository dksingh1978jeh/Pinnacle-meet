import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  mobile: text('mobile'),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('host'), // super_admin | host | co_host | participant
  status: text('status').notNull().default('active'), // active | suspended | blocked
  plan: text('plan').notNull().default('free'), // free | pro | business
  resetToken: text('reset_token'),
  resetExpiresAt: timestamp('reset_expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const meetings = pgTable('meetings', {
  id: serial('id').primaryKey(),
  meetingCode: text('meeting_code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  hostId: integer('host_id')
    .references(() => users.id)
    .notNull(),
  passwordHash: text('password_hash'),
  invitePasscode: text('invite_passcode'),
  isInstant: boolean('is_instant').notNull().default(false),
  isClassroomMode: boolean('is_classroom_mode').notNull().default(false),
  scheduledAt: timestamp('scheduled_at'),
  durationMinutes: integer('duration_minutes').notNull().default(40),
  recurrence: text('recurrence').notNull().default('none'), // none | daily | weekly | monthly
  waitingRoomEnabled: boolean('waiting_room_enabled').notNull().default(true),
  allowJoinBeforeHost: boolean('allow_join_before_host').notNull().default(false),
  chatDisabled: boolean('chat_disabled').notNull().default(false),
  isLocked: boolean('is_locked').notNull().default(false),
  status: text('status').notNull().default('scheduled'), // scheduled | live | ended
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  maxParticipants: integer('max_participants').notNull().default(10),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const meetingParticipants = pgTable('meeting_participants', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id')
    .references(() => meetings.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id),
  participantUid: text('participant_uid').notNull(),
  displayName: text('display_name').notNull(),
  email: text('email'),
  role: text('role').notNull().default('participant'), // host | co_host | participant
  status: text('status').notNull().default('joined'), // waiting | joined | rejected | removed | left
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  leftAt: timestamp('left_at'),
  durationSeconds: integer('duration_seconds').notNull().default(0),
});

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id')
    .references(() => meetings.id, { onDelete: 'cascade' })
    .notNull(),
  senderUid: text('sender_uid').notNull(),
  senderName: text('sender_name').notNull(),
  recipientUid: text('recipient_uid'),
  recipientName: text('recipient_name'),
  messageType: text('message_type').notNull().default('text'), // text | file | announcement
  content: text('content').notNull(),
  attachmentUrl: text('attachment_url'),
  attachmentName: text('attachment_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const whiteboardStrokes = pgTable('whiteboard_strokes', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id')
    .references(() => meetings.id, { onDelete: 'cascade' })
    .notNull(),
  strokeId: text('stroke_id').notNull(),
  authorUid: text('author_uid').notNull(),
  tool: text('tool').notNull(), // pen | highlighter | eraser | rect | circle | line | text
  color: text('color').notNull(),
  width: integer('width').notNull().default(3),
  pointsJson: text('points_json').notNull(),
  textContent: text('text_content'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const classroomPolls = pgTable('classroom_polls', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id')
    .references(() => meetings.id, { onDelete: 'cascade' })
    .notNull(),
  creatorUid: text('creator_uid').notNull(),
  question: text('question').notNull(),
  isQuiz: boolean('is_quiz').notNull().default(false),
  optionsJson: text('options_json').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const pollVotes = pgTable('poll_votes', {
  id: serial('id').primaryKey(),
  pollId: integer('poll_id')
    .references(() => classroomPolls.id, { onDelete: 'cascade' })
    .notNull(),
  voterUid: text('voter_uid').notNull(),
  voterName: text('voter_name').notNull(),
  optionId: text('option_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const classroomQuestions = pgTable('classroom_questions', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id')
    .references(() => meetings.id, { onDelete: 'cascade' })
    .notNull(),
  authorUid: text('author_uid').notNull(),
  authorName: text('author_name').notNull(),
  question: text('question').notNull(),
  answer: text('answer'),
  answeredBy: text('answered_by'),
  upvotes: integer('upvotes').notNull().default(0),
  isAnswered: boolean('is_answered').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const teachingMaterials = pgTable('teaching_materials', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id')
    .references(() => meetings.id, { onDelete: 'cascade' })
    .notNull(),
  uploaderUid: text('uploader_uid').notNull(),
  uploaderName: text('uploader_name').notNull(),
  title: text('title').notNull(),
  fileUrl: text('file_url').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const recordings = pgTable('recordings', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id')
    .references(() => meetings.id, { onDelete: 'cascade' })
    .notNull(),
  recordedByUserId: integer('recorded_by_user_id')
    .references(() => users.id)
    .notNull(),
  title: text('title').notNull(),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull().default(0),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  accessScope: text('access_scope').notNull().default('participants'), // host_only | participants | organization
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  plan: text('plan').notNull(), // free | pro | business
  amountInr: integer('amount_inr').notNull(),
  currency: text('currency').notNull().default('INR'),
  gateway: text('gateway').notNull().default('razorpay'),
  razorpayOrderId: text('razorpay_order_id'),
  razorpayPaymentId: text('razorpay_payment_id'),
  status: text('status').notNull().default('created'), // created | paid | failed
  validUntil: timestamp('valid_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id')
    .references(() => users.id)
    .notNull(),
  actorName: text('actor_name').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  hostedMeetings: many(meetings),
  recordings: many(recordings),
  subscriptions: many(subscriptions),
  auditLogs: many(adminAuditLogs),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  host: one(users, {
    fields: [meetings.hostId],
    references: [users.id],
  }),
  participants: many(meetingParticipants),
  chatMessages: many(chatMessages),
  recordings: many(recordings),
  polls: many(classroomPolls),
  questions: many(classroomQuestions),
  materials: many(teachingMaterials),
}));

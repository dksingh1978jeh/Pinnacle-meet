import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  adminAuditLogs,
  chatMessages,
  classroomPolls,
  classroomQuestions,
  meetingParticipants,
  meetings,
  pollVotes,
  recordings,
  subscriptions,
  teachingMaterials,
  users,
  whiteboardStrokes,
} from './schema.ts';

const SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL || 'dksingh1978.jeh@gmail.com'
).toLowerCase();

export const PLAN_LIMITS: Record<
  string,
  { maxParticipants: number; maxDurationMinutes: number; priceInr: number; label: string }
> = {
  free: { maxParticipants: 10, maxDurationMinutes: 40, priceInr: 0, label: 'Free' },
  pro: { maxParticipants: 100, maxDurationMinutes: 480, priceInr: 1299, label: 'Pro' },
  business: { maxParticipants: 500, maxDurationMinutes: 1440, priceInr: 3999, label: 'Business' },
};

function sanitizeUser(row: typeof users.$inferSelect) {
  return {
    id: row.id,
    uid: row.uid,
    name: row.name,
    email: row.email,
    mobile: row.mobile,
    avatarUrl: row.avatarUrl,
    role: row.role,
    status: row.status,
    plan: row.plan,
    createdAt: row.createdAt,
  };
}

export async function findUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] ? sanitizeUser(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed (findUserByUid):', error);
    throw new Error('Failed to load user profile.', { cause: error });
  }
}

export async function findUserRowByEmail(email: string) {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed (findUserRowByEmail):', error);
    throw new Error('Failed to verify account.', { cause: error });
  }
}

export async function upsertFirebaseUser(input: {
  uid: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}) {
  try {
    const normalizedEmail = input.email.toLowerCase().trim();
    const existingCountRes = await db.select({ value: count() }).from(users);
    const totalUsers = Number(existingCountRes[0]?.value || 0);
    const isAutoAdmin = totalUsers === 0 || normalizedEmail === SUPER_ADMIN_EMAIL;

    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingByEmail[0] && existingByEmail[0].uid !== input.uid) {
      const updated = await db
        .update(users)
        .set({
          uid: input.uid,
          avatarUrl: existingByEmail[0].avatarUrl || input.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      return sanitizeUser(updated[0]);
    }

    const result = await db
      .insert(users)
      .values({
        uid: input.uid,
        email: normalizedEmail,
        name: input.name.trim() || 'Pinnacle User',
        avatarUrl: input.avatarUrl,
        role: isAutoAdmin ? 'super_admin' : 'host',
        plan: isAutoAdmin ? 'business' : 'free',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          updatedAt: new Date(),
        },
      })
      .returning();

    return sanitizeUser(result[0]);
  } catch (error) {
    console.error('Database query failed (upsertFirebaseUser):', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function createLocalUser(input: {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role?: string;
}) {
  try {
    const normalizedEmail = input.email.toLowerCase().trim();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    if (existing[0]) {
      throw new Error('EMAIL_EXISTS');
    }

    const existingCountRes = await db.select({ value: count() }).from(users);
    const totalUsers = Number(existingCountRes[0]?.value || 0);
    const isAutoAdmin = totalUsers === 0 || normalizedEmail === SUPER_ADMIN_EMAIL;

    const passwordHash = await bcrypt.hash(input.password, 10);
    const uid = `pm_${crypto.randomUUID()}`;
    const safeRole = isAutoAdmin
      ? 'super_admin'
      : ['host', 'co_host', 'participant'].includes(input.role || '')
        ? String(input.role)
        : 'host';

    const inserted = await db
      .insert(users)
      .values({
        uid,
        name: input.name.trim(),
        email: normalizedEmail,
        mobile: input.mobile.trim(),
        passwordHash,
        role: safeRole,
        plan: isAutoAdmin ? 'business' : 'free',
      })
      .returning();

    return sanitizeUser(inserted[0]);
  } catch (error: any) {
    if (error?.message === 'EMAIL_EXISTS') throw error;
    console.error('Database query failed (createLocalUser):', error);
    throw new Error('Failed to create user account.', { cause: error });
  }
}

export async function updateUserProfile(
  userId: number,
  updates: { name?: string; mobile?: string; avatarUrl?: string | null }
) {
  try {
    const updated = await db
      .update(users)
      .set({
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.mobile !== undefined ? { mobile: updates.mobile.trim() } : {}),
        ...(updates.avatarUrl !== undefined ? { avatarUrl: updates.avatarUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated[0] ? sanitizeUser(updated[0]) : null;
  } catch (error) {
    console.error('Database query failed (updateUserProfile):', error);
    throw new Error('Failed to update profile.', { cause: error });
  }
}

export async function createPasswordResetToken(email: string) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    if (!rows[0]) return null;

    const resetCode = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db
      .update(users)
      .set({
        resetToken: resetCode,
        resetExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, rows[0].id));

    return { email: normalizedEmail, resetCode, expiresAt };
  } catch (error) {
    console.error('Database query failed (createPasswordResetToken):', error);
    throw new Error('Failed to initiate password recovery.', { cause: error });
  }
}

export async function resetUserPassword(input: {
  email: string;
  resetCode: string;
  newPassword: string;
}) {
  try {
    const normalizedEmail = input.email.toLowerCase().trim();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    const user = rows[0];
    if (
      !user ||
      !user.resetToken ||
      user.resetToken !== input.resetCode.trim() ||
      !user.resetExpiresAt ||
      user.resetExpiresAt.getTime() < Date.now()
    ) {
      return false;
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    await db
      .update(users)
      .set({
        passwordHash,
        resetToken: null,
        resetExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return true;
  } catch (error) {
    console.error('Database query failed (resetUserPassword):', error);
    throw new Error('Failed to reset password.', { cause: error });
  }
}

export function generateMeetingCode(): string {
  const seg1 = crypto.randomInt(100, 999);
  const seg2 = crypto.randomInt(1000, 9999);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let seg3 = '';
  for (let i = 0; i < 3; i++) {
    seg3 += chars[crypto.randomInt(0, chars.length)];
  }
  return `PM-${seg1}-${seg2}-${seg3}`;
}

export function generateSecurePasscode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

export async function createMeetingRecord(input: {
  hostId: number;
  hostPlan: string;
  title: string;
  description?: string;
  isInstant: boolean;
  isClassroomMode: boolean;
  scheduledAt?: Date | null;
  durationMinutes: number;
  recurrence: string;
  waitingRoomEnabled: boolean;
  allowJoinBeforeHost: boolean;
  requirePassword: boolean;
  customPasscode?: string;
}) {
  try {
    const limits = PLAN_LIMITS[input.hostPlan] || PLAN_LIMITS.free;
    const boundedDuration = Math.min(
      Math.max(15, input.durationMinutes),
      limits.maxDurationMinutes
    );

    let meetingCode = generateMeetingCode();
    for (let i = 0; i < 5; i++) {
      const exists = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(eq(meetings.meetingCode, meetingCode))
        .limit(1);
      if (!exists[0]) break;
      meetingCode = generateMeetingCode();
    }

    const passcode = input.requirePassword
      ? (input.customPasscode?.trim() || generateSecurePasscode())
      : null;
    const passwordHash = passcode ? await bcrypt.hash(passcode, 8) : null;

    const inserted = await db
      .insert(meetings)
      .values({
        meetingCode,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        hostId: input.hostId,
        passwordHash,
        invitePasscode: passcode,
        isInstant: input.isInstant,
        isClassroomMode: input.isClassroomMode,
        scheduledAt: input.scheduledAt || (input.isInstant ? new Date() : null),
        durationMinutes: boundedDuration,
        recurrence: input.recurrence || 'none',
        waitingRoomEnabled: input.waitingRoomEnabled,
        allowJoinBeforeHost: input.allowJoinBeforeHost,
        status: input.isInstant ? 'live' : 'scheduled',
        startedAt: input.isInstant ? new Date() : null,
        maxParticipants: limits.maxParticipants,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database query failed (createMeetingRecord):', error);
    throw new Error('Failed to create meeting.', { cause: error });
  }
}

export async function getMeetingByCode(meetingCode: string) {
  try {
    const rows = await db
      .select({
        meeting: meetings,
        hostName: users.name,
        hostEmail: users.email,
        hostUid: users.uid,
      })
      .from(meetings)
      .innerJoin(users, eq(meetings.hostId, users.id))
      .where(eq(meetings.meetingCode, meetingCode.trim().toUpperCase()))
      .limit(1);

    if (!rows[0]) return null;
    return {
      ...rows[0].meeting,
      hostName: rows[0].hostName,
      hostEmail: rows[0].hostEmail,
      hostUid: rows[0].hostUid,
    };
  } catch (error) {
    console.error('Database query failed (getMeetingByCode):', error);
    throw new Error('Failed to load meeting.', { cause: error });
  }
}

export async function listUserMeetings(userId: number) {
  try {
    const hosted = await db
      .select({
        meeting: meetings,
        hostName: users.name,
      })
      .from(meetings)
      .innerJoin(users, eq(meetings.hostId, users.id))
      .where(eq(meetings.hostId, userId))
      .orderBy(desc(meetings.createdAt))
      .limit(50);

    const participantCounts = await db
      .select({
        meetingId: meetingParticipants.meetingId,
        total: count(),
      })
      .from(meetingParticipants)
      .groupBy(meetingParticipants.meetingId);

    const countMap = new Map(
      participantCounts.map((r) => [r.meetingId, Number(r.total)])
    );

    return hosted.map((r) => ({
      ...r.meeting,
      hasPassword: Boolean(r.meeting.passwordHash),
      hostName: r.hostName,
      participantCount: countMap.get(r.meeting.id) || 0,
    }));
  } catch (error) {
    console.error('Database query failed (listUserMeetings):', error);
    throw new Error('Failed to fetch meetings.', { cause: error });
  }
}

export async function updateMeetingFields(
  meetingId: number,
  fields: Partial<{
    status: string;
    startedAt: Date | null;
    endedAt: Date | null;
    chatDisabled: boolean;
    isLocked: boolean;
    waitingRoomEnabled: boolean;
    hostId: number;
  }>
) {
  try {
    const updated = await db
      .update(meetings)
      .set(fields)
      .where(eq(meetings.id, meetingId))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed (updateMeetingFields):', error);
    throw new Error('Failed to update meeting state.', { cause: error });
  }
}

export async function upsertMeetingParticipant(input: {
  meetingId: number;
  userId: number | null;
  participantUid: string;
  displayName: string;
  email?: string | null;
  role: string;
  status: string;
}) {
  try {
    const existing = await db
      .select()
      .from(meetingParticipants)
      .where(
        and(
          eq(meetingParticipants.meetingId, input.meetingId),
          eq(meetingParticipants.participantUid, input.participantUid)
        )
      )
      .limit(1);

    if (existing[0]) {
      const updated = await db
        .update(meetingParticipants)
        .set({
          displayName: input.displayName,
          role: input.role,
          status: input.status,
          leftAt: null,
        })
        .where(eq(meetingParticipants.id, existing[0].id))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(meetingParticipants)
      .values({
        meetingId: input.meetingId,
        userId: input.userId,
        participantUid: input.participantUid,
        displayName: input.displayName,
        email: input.email || null,
        role: input.role,
        status: input.status,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed (upsertMeetingParticipant):', error);
    throw new Error('Failed to update participant attendance.', { cause: error });
  }
}

export async function markParticipantLeft(meetingId: number, participantUid: string) {
  try {
    const existing = await db
      .select()
      .from(meetingParticipants)
      .where(
        and(
          eq(meetingParticipants.meetingId, meetingId),
          eq(meetingParticipants.participantUid, participantUid)
        )
      )
      .limit(1);
    if (!existing[0]) return;
    const now = new Date();
    const elapsed = Math.max(
      0,
      Math.floor((now.getTime() - new Date(existing[0].joinedAt).getTime()) / 1000)
    );
    await db
      .update(meetingParticipants)
      .set({
        status: existing[0].status === 'removed' ? 'removed' : 'left',
        leftAt: now,
        durationSeconds: existing[0].durationSeconds + elapsed,
      })
      .where(eq(meetingParticipants.id, existing[0].id));
  } catch (error) {
    console.error('Database query failed (markParticipantLeft):', error);
  }
}

export async function listMeetingAttendance(meetingId: number) {
  try {
    return await db
      .select()
      .from(meetingParticipants)
      .where(eq(meetingParticipants.meetingId, meetingId))
      .orderBy(desc(meetingParticipants.joinedAt));
  } catch (error) {
    console.error('Database query failed (listMeetingAttendance):', error);
    throw new Error('Failed to load attendance.', { cause: error });
  }
}

export async function saveChatMessage(input: {
  meetingId: number;
  senderUid: string;
  senderName: string;
  recipientUid?: string | null;
  recipientName?: string | null;
  messageType?: string;
  content: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}) {
  try {
    const inserted = await db
      .insert(chatMessages)
      .values({
        meetingId: input.meetingId,
        senderUid: input.senderUid,
        senderName: input.senderName,
        recipientUid: input.recipientUid || null,
        recipientName: input.recipientName || null,
        messageType: input.messageType || 'text',
        content: input.content,
        attachmentUrl: input.attachmentUrl || null,
        attachmentName: input.attachmentName || null,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed (saveChatMessage):', error);
    throw new Error('Failed to save chat message.', { cause: error });
  }
}

export async function listChatMessagesForUser(meetingId: number, userUid: string) {
  try {
    return await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.meetingId, meetingId),
          or(
            sql`${chatMessages.recipientUid} IS NULL`,
            eq(chatMessages.senderUid, userUid),
            eq(chatMessages.recipientUid, userUid)
          )
        )
      )
      .orderBy(chatMessages.createdAt)
      .limit(200);
  } catch (error) {
    console.error('Database query failed (listChatMessagesForUser):', error);
    throw new Error('Failed to load chat history.', { cause: error });
  }
}

export async function saveWhiteboardStroke(input: {
  meetingId: number;
  strokeId: string;
  authorUid: string;
  tool: string;
  color: string;
  width: number;
  pointsJson: string;
  textContent?: string | null;
}) {
  try {
    const inserted = await db
      .insert(whiteboardStrokes)
      .values({
        meetingId: input.meetingId,
        strokeId: input.strokeId,
        authorUid: input.authorUid,
        tool: input.tool,
        color: input.color,
        width: input.width,
        pointsJson: input.pointsJson,
        textContent: input.textContent || null,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed (saveWhiteboardStroke):', error);
    throw new Error('Failed to save whiteboard stroke.', { cause: error });
  }
}

export async function listWhiteboardStrokes(meetingId: number) {
  try {
    return await db
      .select()
      .from(whiteboardStrokes)
      .where(eq(whiteboardStrokes.meetingId, meetingId))
      .orderBy(whiteboardStrokes.id);
  } catch (error) {
    console.error('Database query failed (listWhiteboardStrokes):', error);
    throw new Error('Failed to load whiteboard strokes.', { cause: error });
  }
}

export async function clearWhiteboardStrokes(meetingId: number) {
  try {
    await db.delete(whiteboardStrokes).where(eq(whiteboardStrokes.meetingId, meetingId));
  } catch (error) {
    console.error('Database query failed (clearWhiteboardStrokes):', error);
  }
}

export async function removeWhiteboardStrokeByStrokeId(meetingId: number, strokeId: string) {
  try {
    await db
      .delete(whiteboardStrokes)
      .where(
        and(
          eq(whiteboardStrokes.meetingId, meetingId),
          eq(whiteboardStrokes.strokeId, strokeId)
        )
      );
  } catch (error) {
    console.error('Database query failed (removeWhiteboardStrokeByStrokeId):', error);
  }
}

export async function createPoll(input: {
  meetingId: number;
  creatorUid: string;
  question: string;
  isQuiz: boolean;
  options: Array<{ id: string; text: string; isCorrect?: boolean }>;
}) {
  try {
    const inserted = await db
      .insert(classroomPolls)
      .values({
        meetingId: input.meetingId,
        creatorUid: input.creatorUid,
        question: input.question,
        isQuiz: input.isQuiz,
        optionsJson: JSON.stringify(input.options),
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed (createPoll):', error);
    throw new Error('Failed to create poll.', { cause: error });
  }
}

export async function castPollVote(input: {
  pollId: number;
  voterUid: string;
  voterName: string;
  optionId: string;
}) {
  try {
    const existing = await db
      .select()
      .from(pollVotes)
      .where(
        and(
          eq(pollVotes.pollId, input.pollId),
          eq(pollVotes.voterUid, input.voterUid)
        )
      )
      .limit(1);

    if (existing[0]) {
      const updated = await db
        .update(pollVotes)
        .set({ optionId: input.optionId })
        .where(eq(pollVotes.id, existing[0].id))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(pollVotes)
      .values({
        pollId: input.pollId,
        voterUid: input.voterUid,
        voterName: input.voterName,
        optionId: input.optionId,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed (castPollVote):', error);
    throw new Error('Failed to submit vote.', { cause: error });
  }
}

export async function listPollsWithVotes(meetingId: number) {
  try {
    const polls = await db
      .select()
      .from(classroomPolls)
      .where(eq(classroomPolls.meetingId, meetingId))
      .orderBy(desc(classroomPolls.createdAt));

    const results = [];
    for (const poll of polls) {
      const votes = await db
        .select()
        .from(pollVotes)
        .where(eq(pollVotes.pollId, poll.id));
      results.push({
        ...poll,
        options: JSON.parse(poll.optionsJson) as Array<{
          id: string;
          text: string;
          isCorrect?: boolean;
        }>,
        votes,
      });
    }
    return results;
  } catch (error) {
    console.error('Database query failed (listPollsWithVotes):', error);
    throw new Error('Failed to load polls.', { cause: error });
  }
}

export async function closePoll(pollId: number) {
  try {
    await db
      .update(classroomPolls)
      .set({ isActive: false })
      .where(eq(classroomPolls.id, pollId));
  } catch (error) {
    console.error('Database query failed (closePoll):', error);
  }
}

export async function createQaQuestion(input: {
  meetingId: number;
  authorUid: string;
  authorName: string;
  question: string;
}) {
  try {
    const inserted = await db
      .insert(classroomQuestions)
      .values({
        meetingId: input.meetingId,
        authorUid: input.authorUid,
        authorName: input.authorName,
        question: input.question,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed (createQaQuestion):', error);
    throw new Error('Failed to post question.', { cause: error });
  }
}

export async function answerQaQuestion(input: {
  questionId: number;
  answer: string;
  answeredBy: string;
}) {
  try {
    const updated = await db
      .update(classroomQuestions)
      .set({
        answer: input.answer,
        answeredBy: input.answeredBy,
        isAnswered: true,
      })
      .where(eq(classroomQuestions.id, input.questionId))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed (answerQaQuestion):', error);
    throw new Error('Failed to answer question.', { cause: error });
  }
}

export async function upvoteQaQuestion(questionId: number) {
  try {
    const updated = await db
      .update(classroomQuestions)
      .set({ upvotes: sql`${classroomQuestions.upvotes} + 1` })
      .where(eq(classroomQuestions.id, questionId))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed (upvoteQaQuestion):', error);
    throw new Error('Failed to upvote question.', { cause: error });
  }
}

export async function listQaQuestions(meetingId: number) {
  try {
    return await db
      .select()
      .from(classroomQuestions)
      .where(eq(classroomQuestions.meetingId, meetingId))
      .orderBy(desc(classroomQuestions.upvotes), desc(classroomQuestions.createdAt));
  } catch (error) {
    console.error('Database query failed (listQaQuestions):', error);
    throw new Error('Failed to load Q&A session.', { cause: error });
  }
}

export async function saveTeachingMaterial(input: {
  meetingId: number;
  uploaderUid: string;
  uploaderName: string;
  title: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes: number;
}) {
  try {
    const inserted = await db
      .insert(teachingMaterials)
      .values(input)
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed (saveTeachingMaterial):', error);
    throw new Error('Failed to save teaching material.', { cause: error });
  }
}

export async function listTeachingMaterials(meetingId: number) {
  try {
    return await db
      .select()
      .from(teachingMaterials)
      .where(eq(teachingMaterials.meetingId, meetingId))
      .orderBy(desc(teachingMaterials.createdAt));
  } catch (error) {
    console.error('Database query failed (listTeachingMaterials):', error);
    throw new Error('Failed to load teaching materials.', { cause: error });
  }
}

export async function saveRecordingRecord(input: {
  meetingId: number;
  recordedByUserId: number;
  title: string;
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  durationSeconds: number;
  accessScope?: string;
}) {
  try {
    const inserted = await db
      .insert(recordings)
      .values({
        meetingId: input.meetingId,
        recordedByUserId: input.recordedByUserId,
        title: input.title,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        fileSizeBytes: input.fileSizeBytes,
        durationSeconds: input.durationSeconds,
        accessScope: input.accessScope || 'participants',
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed (saveRecordingRecord):', error);
    throw new Error('Failed to save cloud recording.', { cause: error });
  }
}

export async function listAuthorizedRecordings(userId: number, userRole: string) {
  try {
    if (userRole === 'super_admin') {
      return await db
        .select({
          recording: recordings,
          meetingTitle: meetings.title,
          meetingCode: meetings.meetingCode,
          hostName: users.name,
        })
        .from(recordings)
        .innerJoin(meetings, eq(recordings.meetingId, meetings.id))
        .innerJoin(users, eq(recordings.recordedByUserId, users.id))
        .orderBy(desc(recordings.createdAt));
    }

    const hostedOrRecorded = await db
      .select({
        recording: recordings,
        meetingTitle: meetings.title,
        meetingCode: meetings.meetingCode,
        hostName: users.name,
      })
      .from(recordings)
      .innerJoin(meetings, eq(recordings.meetingId, meetings.id))
      .innerJoin(users, eq(recordings.recordedByUserId, users.id))
      .where(
        or(
          eq(recordings.recordedByUserId, userId),
          eq(meetings.hostId, userId),
          sql`EXISTS (SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = ${recordings.meetingId} AND mp.user_id = ${userId} AND ${recordings.accessScope} IN ('participants', 'organization'))`
        )
      )
      .orderBy(desc(recordings.createdAt));

    return hostedOrRecorded;
  } catch (error) {
    console.error('Database query failed (listAuthorizedRecordings):', error);
    throw new Error('Failed to load recordings.', { cause: error });
  }
}

export async function getRecordingById(recordingId: number) {
  try {
    const rows = await db
      .select({
        recording: recordings,
        meetingHostId: meetings.hostId,
      })
      .from(recordings)
      .innerJoin(meetings, eq(recordings.meetingId, meetings.id))
      .where(eq(recordings.id, recordingId))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed (getRecordingById):', error);
    throw new Error('Failed to load recording.', { cause: error });
  }
}

export async function canUserAccessRecording(
  recordingId: number,
  userId: number,
  userRole: string
): Promise<boolean> {
  if (userRole === 'super_admin') return true;
  const row = await getRecordingById(recordingId);
  if (!row) return false;
  if (row.recording.recordedByUserId === userId || row.meetingHostId === userId) {
    return true;
  }
  if (row.recording.accessScope === 'host_only') return false;
  const participant = await db
    .select({ id: meetingParticipants.id })
    .from(meetingParticipants)
    .where(
      and(
        eq(meetingParticipants.meetingId, row.recording.meetingId),
        eq(meetingParticipants.userId, userId)
      )
    )
    .limit(1);
  return Boolean(participant[0]);
}

export async function deleteRecordingById(recordingId: number) {
  try {
    const deleted = await db
      .delete(recordings)
      .where(eq(recordings.id, recordingId))
      .returning();
    return deleted[0] || null;
  } catch (error) {
    console.error('Database query failed (deleteRecordingById):', error);
    throw new Error('Failed to delete recording.', { cause: error });
  }
}

export async function createSubscriptionRecord(input: {
  userId: number;
  plan: string;
  amountInr: number;
  razorpayOrderId: string;
  status: string;
}) {
  try {
    const inserted = await db
      .insert(subscriptions)
      .values({
        userId: input.userId,
        plan: input.plan,
        amountInr: input.amountInr,
        currency: 'INR',
        gateway: 'razorpay',
        razorpayOrderId: input.razorpayOrderId,
        status: input.status,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed (createSubscriptionRecord):', error);
    throw new Error('Failed to create payment order.', { cause: error });
  }
}

export async function markSubscriptionPaid(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  userId: number;
  plan: string;
}) {
  try {
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db
      .update(subscriptions)
      .set({
        razorpayPaymentId: input.razorpayPaymentId,
        status: 'paid',
        validUntil,
      })
      .where(eq(subscriptions.razorpayOrderId, input.razorpayOrderId));

    const updatedUser = await db
      .update(users)
      .set({ plan: input.plan, updatedAt: new Date() })
      .where(eq(users.id, input.userId))
      .returning();

    return updatedUser[0] ? sanitizeUser(updatedUser[0]) : null;
  } catch (error) {
    console.error('Database query failed (markSubscriptionPaid):', error);
    throw new Error('Failed to activate subscription.', { cause: error });
  }
}

export async function listUserSubscriptions(userId: number) {
  try {
    return await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(20);
  } catch (error) {
    console.error('Database query failed (listUserSubscriptions):', error);
    throw new Error('Failed to load billing history.', { cause: error });
  }
}

export async function logAdminAction(input: {
  actorUserId: number;
  actorName: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: string;
}) {
  try {
    await db.insert(adminAuditLogs).values({
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId || null,
      details: input.details || null,
    });
  } catch (error) {
    console.error('Database query failed (logAdminAction):', error);
  }
}

export async function getAdminOverview(search?: string) {
  try {
    const [totalUsersRes, totalMeetingsRes, activeMeetingsRes, scheduledMeetingsRes, durationRes, storageRes, revenueRes] =
      await Promise.all([
        db.select({ value: count() }).from(users),
        db.select({ value: count() }).from(meetings),
        db.select({ value: count() }).from(meetings).where(eq(meetings.status, 'live')),
        db.select({ value: count() }).from(meetings).where(eq(meetings.status, 'scheduled')),
        db
          .select({
            totalMinutes: sql<number>`COALESCE(SUM(${meetings.durationMinutes}), 0)`,
            avgMinutes: sql<number>`COALESCE(ROUND(AVG(${meetings.durationMinutes})), 0)`,
          })
          .from(meetings),
        db
          .select({
            totalBytes: sql<number>`COALESCE(SUM(${recordings.fileSizeBytes}), 0)`,
            recordingCount: count(),
          })
          .from(recordings),
        db
          .select({
            totalInr: sql<number>`COALESCE(SUM(${subscriptions.amountInr}), 0)`,
          })
          .from(subscriptions)
          .where(eq(subscriptions.status, 'paid')),
      ]);

    const userQuery = search
      ? db
          .select()
          .from(users)
          .where(
            or(
              ilike(users.name, `%${search}%`),
              ilike(users.email, `%${search}%`)
            )
          )
          .orderBy(desc(users.createdAt))
          .limit(100)
      : db.select().from(users).orderBy(desc(users.createdAt)).limit(100);

    const [userList, recentMeetings, recentPayments, logs] = await Promise.all([
      userQuery,
      db
        .select({
          meeting: meetings,
          hostName: users.name,
        })
        .from(meetings)
        .innerJoin(users, eq(meetings.hostId, users.id))
        .orderBy(desc(meetings.createdAt))
        .limit(50),
      db
        .select({
          subscription: subscriptions,
          userName: users.name,
          userEmail: users.email,
        })
        .from(subscriptions)
        .innerJoin(users, eq(subscriptions.userId, users.id))
        .orderBy(desc(subscriptions.createdAt))
        .limit(30),
      db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(50),
    ]);

    return {
      stats: {
        totalUsers: Number(totalUsersRes[0]?.value || 0),
        totalMeetings: Number(totalMeetingsRes[0]?.value || 0),
        activeMeetings: Number(activeMeetingsRes[0]?.value || 0),
        scheduledMeetings: Number(scheduledMeetingsRes[0]?.value || 0),
        totalDurationMinutes: Number(durationRes[0]?.totalMinutes || 0),
        avgDurationMinutes: Number(durationRes[0]?.avgMinutes || 0),
        storageUsedBytes: Number(storageRes[0]?.totalBytes || 0),
        recordingCount: Number(storageRes[0]?.recordingCount || 0),
        totalRevenueInr: Number(revenueRes[0]?.totalInr || 0),
      },
      users: userList.map(sanitizeUser),
      meetings: recentMeetings.map((r) => ({
        ...r.meeting,
        hostName: r.hostName,
      })),
      payments: recentPayments.map((r) => ({
        ...r.subscription,
        userName: r.userName,
        userEmail: r.userEmail,
      })),
      auditLogs: logs,
    };
  } catch (error) {
    console.error('Database query failed (getAdminOverview):', error);
    throw new Error('Failed to load admin overview.', { cause: error });
  }
}

export async function adminUpdateUser(
  targetUserId: number,
  updates: { status?: string; role?: string; plan?: string }
) {
  try {
    const updated = await db
      .update(users)
      .set({
        ...(updates.status ? { status: updates.status } : {}),
        ...(updates.role ? { role: updates.role } : {}),
        ...(updates.plan ? { plan: updates.plan } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId))
      .returning();
    return updated[0] ? sanitizeUser(updated[0]) : null;
  } catch (error) {
    console.error('Database query failed (adminUpdateUser):', error);
    throw new Error('Failed to update user.', { cause: error });
  }
}

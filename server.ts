import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { AccessToken } from 'livekit-server-sdk';
import {
  adminUpdateUser,
  canUserAccessRecording,
  createLocalUser,
  createMeetingRecord,
  createPasswordResetToken,
  createSubscriptionRecord,
  deleteRecordingById,
  findUserRowByEmail,
  getAdminOverview,
  getMeetingByCode,
  getRecordingById,
  listAuthorizedRecordings,
  listMeetingAttendance,
  listUserMeetings,
  listUserSubscriptions,
  logAdminAction,
  markSubscriptionPaid,
  PLAN_LIMITS,
  resetUserPassword,
  saveRecordingRecord,
  saveTeachingMaterial,
  updateMeetingFields,
  updateUserProfile,
} from './src/db/repository.ts';
import {
  optionalAuth,
  requireAdmin,
  requireAuth,
  signMeetingToken,
  signSessionToken,
  type AuthRequest,
} from './src/middleware/auth.ts';
import {
  attachWebSocketServer,
  forceEndMeetingRoom,
  notifyRoomMaterialAdded,
} from './src/realtime/wsServer.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const SUBDIRS = ['avatars', 'materials', 'recordings', 'chat'];
for (const dir of SUBDIRS) {
  fs.mkdirSync(path.join(UPLOAD_ROOT, dir), { recursive: true });
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { error: 'Too many authentication attempts. Please try again shortly.' },
});

app.use('/api', apiLimiter);

function makeUploadMiddleware(folder: string, maxSizeMb: number) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(UPLOAD_ROOT, folder));
    },
    filename: (_req, file, cb) => {
      const safeExt = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '');
      cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExt}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
  });
}

const uploadAvatar = makeUploadMiddleware('avatars', 5);
const uploadMaterial = makeUploadMiddleware('materials', 25);
const uploadChatAttachment = makeUploadMiddleware('chat', 15);
const uploadRecording = makeUploadMiddleware('recordings', 250);

// Serve public avatars, materials, chat files (recordings are strictly gated via auth!)
app.use('/uploads/avatars', express.static(path.join(UPLOAD_ROOT, 'avatars')));
app.use('/uploads/materials', express.static(path.join(UPLOAD_ROOT, 'materials')));
app.use('/uploads/chat', express.static(path.join(UPLOAD_ROOT, 'chat')));

// Health endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    livekitConfigured: Boolean(
      process.env.LIVEKIT_URL &&
        process.env.LIVEKIT_API_KEY &&
        process.env.LIVEKIT_API_SECRET
    ),
    razorpayConfigured: Boolean(
      process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ),
  });
});

// ========================
// 1. AUTHENTICATION & USER PROFILE
// ========================

app.post('/api/auth/signup', authLimiter, async (req, res) => {
  try {
    const { name, email, mobile, password, role } = req.body || {};
    if (
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      typeof email !== 'string' ||
      !email.includes('@') ||
      typeof mobile !== 'string' ||
      mobile.trim().length < 7 ||
      typeof password !== 'string' ||
      password.length < 6
    ) {
      res.status(400).json({
        error:
          'Provide valid name, email address, mobile number, and password (min 6 characters).',
      });
      return;
    }

    const user = await createLocalUser({
      name,
      email,
      mobile,
      password,
      role,
    });
    const token = signSessionToken(user);
    res.status(201).json({ token, user });
  } catch (err: any) {
    if (err?.message === 'EMAIL_EXISTS') {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }
    res.status(500).json({ error: 'Unable to create account.' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const userRow = await findUserRowByEmail(email);
    if (!userRow || !userRow.passwordHash) {
      res.status(401).json({
        error: 'Invalid credentials or this account uses Google Sign-In.',
      });
      return;
    }

    const valid = await bcrypt.compare(password, userRow.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (userRow.status !== 'active') {
      res.status(403).json({
        error: `Your account is ${userRow.status}. Please contact support.`,
      });
      return;
    }

    const user = {
      id: userRow.id,
      uid: userRow.uid,
      name: userRow.name,
      email: userRow.email,
      mobile: userRow.mobile,
      avatarUrl: userRow.avatarUrl,
      role: userRow.role,
      status: userRow.status,
      plan: userRow.plan,
    };
    const token = signSessionToken(user);
    res.json({ token, user });
  } catch {
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email address is required.' });
      return;
    }
    const result = await createPasswordResetToken(email);
    if (!result) {
      res.json({
        message: 'If an account matches that email, a 6-digit recovery code was issued.',
      });
      return;
    }
    res.json({
      message: 'A 6-digit recovery code has been generated and is valid for 15 minutes.',
      recoveryCodePreview: result.resetCode,
    });
  } catch {
    res.status(500).json({ error: 'Unable to initiate password recovery.' });
  }
});

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body || {};
    if (
      typeof email !== 'string' ||
      typeof resetCode !== 'string' ||
      typeof newPassword !== 'string' ||
      newPassword.length < 6
    ) {
      res.status(400).json({
        error: 'Valid email, 6-digit recovery code, and new password (min 6 chars) are required.',
      });
      return;
    }
    const ok = await resetUserPassword({ email, resetCode, newPassword });
    if (!ok) {
      res.status(400).json({ error: 'Invalid or expired recovery code.' });
      return;
    }
    res.json({ message: 'Password updated successfully. You may now sign in.' });
  } catch {
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ user: req.dbUser });
});

app.patch('/api/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, mobile } = req.body || {};
    const updated = await updateUserProfile(req.dbUser!.id, {
      ...(typeof name === 'string' && name.trim().length >= 2 ? { name } : {}),
      ...(typeof mobile === 'string' ? { mobile } : {}),
    });
    res.json({ user: updated });
  } catch {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

app.post(
  '/api/profile/avatar',
  requireAuth,
  uploadAvatar.single('avatar'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Image file is required.' });
        return;
      }
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      const updated = await updateUserProfile(req.dbUser!.id, { avatarUrl });
      res.json({ user: updated, avatarUrl });
    } catch {
      res.status(500).json({ error: 'Failed to upload profile photo.' });
    }
  }
);

// ========================
// 2. MEETINGS & INVITATIONS
// ========================

app.get('/api/meetings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await listUserMeetings(req.dbUser!.id);
    res.json({ meetings: list });
  } catch {
    res.status(500).json({ error: 'Failed to fetch meetings.' });
  }
});

app.post('/api/meetings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      title,
      description,
      isInstant,
      isClassroomMode,
      scheduledAt,
      durationMinutes,
      recurrence,
      waitingRoomEnabled,
      allowJoinBeforeHost,
      requirePassword,
      customPasscode,
    } = req.body || {};

    const cleanTitle =
      typeof title === 'string' && title.trim().length > 0
        ? title.trim()
        : isClassroomMode
          ? 'Live Classroom Session'
          : 'Pinnacle Instant Meeting';

    const parsedDate = scheduledAt ? new Date(scheduledAt) : null;
    if (scheduledAt && Number.isNaN(parsedDate?.getTime())) {
      res.status(400).json({ error: 'Invalid scheduled date/time.' });
      return;
    }

    const meeting = await createMeetingRecord({
      hostId: req.dbUser!.id,
      hostPlan: req.dbUser!.plan,
      title: cleanTitle,
      description: typeof description === 'string' ? description : undefined,
      isInstant: Boolean(isInstant),
      isClassroomMode: Boolean(isClassroomMode),
      scheduledAt: parsedDate,
      durationMinutes: Number(durationMinutes || 40),
      recurrence: ['none', 'daily', 'weekly', 'monthly'].includes(recurrence)
        ? recurrence
        : 'none',
      waitingRoomEnabled: waitingRoomEnabled !== false,
      allowJoinBeforeHost: Boolean(allowJoinBeforeHost),
      requirePassword: Boolean(requirePassword),
      customPasscode:
        typeof customPasscode === 'string' ? customPasscode : undefined,
    });

    res.status(201).json({
      meeting: {
        ...meeting,
        hasPassword: Boolean(meeting.passwordHash),
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to create meeting.' });
  }
});

app.get('/api/meetings/:code', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const meeting = await getMeetingByCode(req.params.code);
    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    const isHost = req.dbUser && req.dbUser.id === meeting.hostId;
    res.json({
      meeting: {
        id: meeting.id,
        meetingCode: meeting.meetingCode,
        title: meeting.title,
        description: meeting.description,
        hostName: meeting.hostName,
        isInstant: meeting.isInstant,
        isClassroomMode: meeting.isClassroomMode,
        scheduledAt: meeting.scheduledAt,
        durationMinutes: meeting.durationMinutes,
        recurrence: meeting.recurrence,
        waitingRoomEnabled: meeting.waitingRoomEnabled,
        allowJoinBeforeHost: meeting.allowJoinBeforeHost,
        isLocked: meeting.isLocked,
        chatDisabled: meeting.chatDisabled,
        status: meeting.status,
        maxParticipants: meeting.maxParticipants,
        hasPassword: Boolean(meeting.passwordHash),
        invitePasscode: isHost ? meeting.invitePasscode : undefined,
        isHost,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to load meeting details.' });
  }
});

app.post('/api/meetings/:code/join', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const meeting = await getMeetingByCode(req.params.code);
    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found. Check the meeting ID.' });
      return;
    }
    if (meeting.status === 'ended') {
      res.status(410).json({ error: 'This meeting has ended.' });
      return;
    }

    const isHost = Boolean(req.dbUser && req.dbUser.id === meeting.hostId);
    const { passcode, guestName } = req.body || {};

    if (meeting.isLocked && !isHost) {
      res.status(403).json({ error: 'This meeting is locked by the host.' });
      return;
    }

    if (meeting.passwordHash && !isHost) {
      if (typeof passcode !== 'string' || !passcode.trim()) {
        res.status(401).json({ error: 'Meeting passcode is required.' });
        return;
      }
      const match = await bcrypt.compare(passcode.trim(), meeting.passwordHash);
      if (!match) {
        res.status(401).json({ error: 'Incorrect meeting passcode.' });
        return;
      }
    }

    if (
      meeting.status === 'scheduled' &&
      !isHost &&
      !meeting.allowJoinBeforeHost
    ) {
      res.status(403).json({
        error: 'Waiting for the host to start this scheduled meeting.',
      });
      return;
    }

    const displayName =
      req.dbUser?.name ||
      (typeof guestName === 'string' && guestName.trim().length >= 2
        ? guestName.trim()
        : null);

    if (!displayName) {
      res.status(400).json({ error: 'Please enter your display name to join.' });
      return;
    }

    const participantUid = req.dbUser?.uid || `guest_${crypto.randomUUID()}`;
    const role = isHost
      ? 'host'
      : req.dbUser?.role === 'co_host'
        ? 'co_host'
        : 'participant';

    const meetingToken = signMeetingToken({
      meetingCode: meeting.meetingCode,
      participantUid,
      displayName,
      role,
    });

    // Optional LiveKit SFU Token when LiveKit env vars are configured
    let livekit: { url: string; token: string } | null = null;
    if (
      process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET
    ) {
      const at = new AccessToken(
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET,
        {
          identity: participantUid,
          name: displayName,
        }
      );
      at.addGrant({
        roomJoin: true,
        room: meeting.meetingCode,
        canPublish: true,
        canSubscribe: true,
      });
      livekit = {
        url: process.env.LIVEKIT_URL,
        token: await at.toJwt(),
      };
    }

    const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    if (process.env.TURN_URL) {
      iceServers.push({
        urls: process.env.TURN_URL,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      });
    }

    res.json({
      meetingToken,
      participantUid,
      displayName,
      role,
      livekit,
      iceServers,
      meeting: {
        id: meeting.id,
        meetingCode: meeting.meetingCode,
        title: meeting.title,
        hostName: meeting.hostName,
        isClassroomMode: meeting.isClassroomMode,
        durationMinutes: meeting.durationMinutes,
        waitingRoomEnabled: meeting.waitingRoomEnabled,
        chatDisabled: meeting.chatDisabled,
        isLocked: meeting.isLocked,
        maxParticipants: meeting.maxParticipants,
        invitePasscode: isHost ? meeting.invitePasscode : undefined,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to join meeting.' });
  }
});

app.get('/api/meetings/:code/attendance', requireAuth, async (req: AuthRequest, res) => {
  try {
    const meeting = await getMeetingByCode(req.params.code);
    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    if (meeting.hostId !== req.dbUser!.id && req.dbUser!.role !== 'super_admin') {
      res.status(403).json({ error: 'Only the host or administrator can view attendance.' });
      return;
    }
    const attendance = await listMeetingAttendance(meeting.id);
    res.json({ attendance });
  } catch {
    res.status(500).json({ error: 'Failed to fetch attendance report.' });
  }
});

app.post(
  '/api/meetings/:code/materials',
  optionalAuth,
  uploadMaterial.single('file'),
  async (req: AuthRequest, res) => {
    try {
      const meeting = await getMeetingByCode(req.params.code);
      if (!meeting || !req.file) {
        res.status(400).json({ error: 'Valid meeting and teaching file are required.' });
        return;
      }
      const fileUrl = `/uploads/materials/${req.file.filename}`;
      const material = await saveTeachingMaterial({
        meetingId: meeting.id,
        uploaderUid: req.dbUser?.uid || 'teacher',
        uploaderName: req.dbUser?.name || String(req.body?.uploaderName || 'Instructor'),
        title: String(req.body?.title || req.file.originalname),
        fileUrl,
        mimeType: req.file.mimetype,
        fileSizeBytes: req.file.size,
      });
      notifyRoomMaterialAdded(meeting.meetingCode, material);
      res.status(201).json({ material });
    } catch {
      res.status(500).json({ error: 'Failed to upload teaching material.' });
    }
  }
);

app.post(
  '/api/meetings/:code/chat-attachment',
  optionalAuth,
  uploadChatAttachment.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'File attachment is required.' });
        return;
      }
      res.status(201).json({
        attachmentUrl: `/uploads/chat/${req.file.filename}`,
        attachmentName: req.file.originalname,
      });
    } catch {
      res.status(500).json({ error: 'Failed to upload attachment.' });
    }
  }
);

// ========================
// 3. CLOUD RECORDINGS (RESTRICTED ACCESS)
// ========================

app.get('/api/recordings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await listAuthorizedRecordings(
      req.dbUser!.id,
      req.dbUser!.role
    );
    res.json({ recordings: items });
  } catch {
    res.status(500).json({ error: 'Failed to load recordings.' });
  }
});

app.post(
  '/api/recordings/upload',
  requireAuth,
  uploadRecording.single('recording'),
  async (req: AuthRequest, res) => {
    try {
      const { meetingCode, title, durationSeconds, accessScope } = req.body || {};
      if (!req.file || typeof meetingCode !== 'string') {
        res.status(400).json({ error: 'Recording file and meeting code are required.' });
        return;
      }
      const meeting = await getMeetingByCode(meetingCode);
      if (!meeting) {
        res.status(404).json({ error: 'Meeting not found.' });
        return;
      }

      const fileUrl = `/api/recordings/file-placeholder`;
      const saved = await saveRecordingRecord({
        meetingId: meeting.id,
        recordedByUserId: req.dbUser!.id,
        title: typeof title === 'string' && title.trim() ? title.trim() : `${meeting.title} Recording`,
        fileUrl,
        fileName: req.file.filename,
        fileSizeBytes: req.file.size,
        durationSeconds: Number(durationSeconds || 0),
        accessScope: ['host_only', 'participants', 'organization'].includes(accessScope)
          ? accessScope
          : 'participants',
      });

      res.status(201).json({ recording: saved });
    } catch {
      res.status(500).json({ error: 'Failed to save cloud recording.' });
    }
  }
);

app.get('/api/recordings/:id/download', requireAuth, async (req: AuthRequest, res) => {
  try {
    const recId = Number(req.params.id);
    const allowed = await canUserAccessRecording(
      recId,
      req.dbUser!.id,
      req.dbUser!.role
    );
    if (!allowed) {
      res.status(403).json({ error: 'Unauthorized recording access denied.' });
      return;
    }
    const row = await getRecordingById(recId);
    if (!row) {
      res.status(404).json({ error: 'Recording not found.' });
      return;
    }
    const filePath = path.join(UPLOAD_ROOT, 'recordings', row.recording.fileName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Recording media file missing on storage.' });
      return;
    }
    const download = req.query.download === '1';
    if (download) {
      res.download(filePath, `${row.recording.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`);
    } else {
      res.sendFile(filePath);
    }
  } catch {
    res.status(500).json({ error: 'Failed to serve recording.' });
  }
});

app.delete('/api/recordings/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const recId = Number(req.params.id);
    const row = await getRecordingById(recId);
    if (!row) {
      res.status(404).json({ error: 'Recording not found.' });
      return;
    }
    const canDelete =
      req.dbUser!.role === 'super_admin' ||
      row.recording.recordedByUserId === req.dbUser!.id ||
      row.meetingHostId === req.dbUser!.id;
    if (!canDelete) {
      res.status(403).json({ error: 'Permission denied.' });
      return;
    }
    const filePath = path.join(UPLOAD_ROOT, 'recordings', row.recording.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    await deleteRecordingById(recId);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete recording.' });
  }
});

// ========================
// 4. BILLING & RAZORPAY SUBSCRIPTIONS
// ========================

app.get('/api/billing/plans', (_req, res) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free Plan',
        audience: 'For personal calls & small study groups',
        priceInr: 0,
        maxParticipants: 10,
        maxDurationMinutes: 40,
        features: [
          'Up to 40 minutes per meeting',
          'Up to 10 participants',
          'HD video & echo-cancelled audio',
          'Group & private meeting chat',
        ],
      },
      {
        id: 'pro',
        name: 'Pro Plan',
        audience: 'For educators, consultants & growing teams',
        priceInr: 1299,
        maxParticipants: 100,
        maxDurationMinutes: 480,
        features: [
          'Up to 100 participants',
          'Up to 8 hours per meeting',
          'Cloud & local meeting recording',
          'HD screen & presentation sharing',
          'Classroom whiteboard, polls & Q&A',
        ],
      },
      {
        id: 'business',
        name: 'Business Plan',
        audience: 'For enterprises, universities & large cohorts',
        priceInr: 3999,
        maxParticipants: 500,
        maxDurationMinutes: 1440,
        features: [
          'Up to 500 participants (LiveKit SFU ready)',
          '24-hour continuous rooms',
          'Dedicated organizational meeting rooms',
          'Admin governance & audit logs',
          'Priority cloud recording storage',
        ],
      },
    ],
  });
});

app.get('/api/billing/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const history = await listUserSubscriptions(req.dbUser!.id);
    res.json({ history });
  } catch {
    res.status(500).json({ error: 'Failed to load billing history.' });
  }
});

app.post('/api/billing/razorpay/order', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { plan } = req.body || {};
    if (plan !== 'pro' && plan !== 'business') {
      res.status(400).json({ error: 'Select Pro or Business plan to upgrade.' });
      return;
    }
    const planMeta = PLAN_LIMITS[plan];
    const amountPaise = planMeta.priceInr * 100;

    const rzpKey = process.env.RAZORPAY_KEY_ID;
    const rzpSecret = process.env.RAZORPAY_KEY_SECRET;

    let orderId = `order_rzp_${crypto.randomBytes(8).toString('hex')}`;
    let mode: 'live' | 'sandbox' = 'sandbox';

    if (rzpKey && rzpSecret) {
      const auth = Buffer.from(`${rzpKey}:${rzpSecret}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt: `pm_${req.dbUser!.id}_${Date.now()}`,
          notes: {
            userId: String(req.dbUser!.id),
            plan,
          },
        }),
      });
      if (!response.ok) {
        res.status(502).json({ error: 'Razorpay order creation failed.' });
        return;
      }
      const data = (await response.json()) as { id: string };
      orderId = data.id;
      mode = 'live';
    }

    await createSubscriptionRecord({
      userId: req.dbUser!.id,
      plan,
      amountInr: planMeta.priceInr,
      razorpayOrderId: orderId,
      status: 'created',
    });

    res.json({
      orderId,
      amountPaise,
      amountInr: planMeta.priceInr,
      currency: 'INR',
      plan,
      keyId: rzpKey || 'rzp_test_pinnacle_sandbox',
      mode,
    });
  } catch {
    res.status(500).json({ error: 'Failed to initiate Razorpay checkout.' });
  }
});

app.post('/api/billing/razorpay/verify', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, plan } =
      req.body || {};
    if (
      typeof razorpayOrderId !== 'string' ||
      typeof razorpayPaymentId !== 'string' ||
      (plan !== 'pro' && plan !== 'business')
    ) {
      res.status(400).json({ error: 'Invalid payment verification payload.' });
      return;
    }

    const rzpSecret = process.env.RAZORPAY_KEY_SECRET;
    if (rzpSecret) {
      const expected = crypto
        .createHmac('sha256', rzpSecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');
      if (expected !== razorpaySignature) {
        res.status(400).json({ error: 'Razorpay payment signature verification failed.' });
        return;
      }
    }

    const user = await markSubscriptionPaid({
      razorpayOrderId,
      razorpayPaymentId,
      userId: req.dbUser!.id,
      plan,
    });

    res.json({ user, message: `Upgraded to ${PLAN_LIMITS[plan].label} Plan.` });
  } catch {
    res.status(500).json({ error: 'Failed to verify Razorpay payment.' });
  }
});

// ========================
// 5. SUPER ADMIN DASHBOARD
// ========================

app.get(
  '/api/admin/overview',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const search =
        typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const overview = await getAdminOverview(search || undefined);
      res.json(overview);
    } catch {
      res.status(500).json({ error: 'Failed to load admin analytics.' });
    }
  }
);

app.patch(
  '/api/admin/users/:id',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const targetId = Number(req.params.id);
      const { status, role, plan } = req.body || {};
      const updated = await adminUpdateUser(targetId, {
        status: ['active', 'suspended', 'blocked'].includes(status)
          ? status
          : undefined,
        role: ['super_admin', 'host', 'co_host', 'participant'].includes(role)
          ? role
          : undefined,
        plan: ['free', 'pro', 'business'].includes(plan) ? plan : undefined,
      });
      if (!updated) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      await logAdminAction({
        actorUserId: req.dbUser!.id,
        actorName: req.dbUser!.name,
        action: 'UPDATE_USER',
        targetType: 'user',
        targetId: String(targetId),
        details: JSON.stringify({ status, role, plan }),
      });
      res.json({ user: updated });
    } catch {
      res.status(500).json({ error: 'Failed to update user.' });
    }
  }
);

app.post(
  '/api/admin/meetings/:id/end',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const meetingId = Number(req.params.id);
      const updated = await updateMeetingFields(meetingId, {
        status: 'ended',
        endedAt: new Date(),
      });
      if (!updated) {
        res.status(404).json({ error: 'Meeting not found.' });
        return;
      }
      forceEndMeetingRoom(updated.meetingCode);
      await logAdminAction({
        actorUserId: req.dbUser!.id,
        actorName: req.dbUser!.name,
        action: 'FORCE_END_MEETING',
        targetType: 'meeting',
        targetId: updated.meetingCode,
        details: `Ended meeting "${updated.title}"`,
      });
      res.json({ meeting: updated });
    } catch {
      res.status(500).json({ error: 'Failed to end meeting.' });
    }
  }
);

// ========================
// 6. FRONTEND DEV / PROD SERVING & WS UPGRADE
// ========================

async function startServer() {
  const httpServer = http.createServer(app);
  attachWebSocketServer(httpServer);

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd && fs.existsSync(path.resolve(process.cwd(), 'src'))) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Pinnacle Meet server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

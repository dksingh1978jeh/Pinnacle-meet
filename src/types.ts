export type UserRole = 'super_admin' | 'host' | 'co_host' | 'participant';
export type PlanType = 'free' | 'pro' | 'business';

export type AppScreen =
  | 'welcome'
  | 'auth'
  | 'dashboard'
  | 'new-meeting'
  | 'join-meeting'
  | 'schedule-meeting'
  | 'live-room'
  | 'recordings'
  | 'profile'
  | 'subscription'
  | 'admin';

export interface UserProfile {
  id: number;
  uid: string;
  name: string;
  email: string;
  mobile: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: 'active' | 'suspended' | 'blocked';
  plan: PlanType;
  createdAt?: string;
}

export interface MeetingItem {
  id: number;
  meetingCode: string;
  title: string;
  description: string | null;
  hostId: number;
  hostName?: string;
  isInstant: boolean;
  isClassroomMode: boolean;
  scheduledAt: string | null;
  durationMinutes: number;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  waitingRoomEnabled: boolean;
  allowJoinBeforeHost: boolean;
  chatDisabled: boolean;
  isLocked: boolean;
  status: 'scheduled' | 'live' | 'ended';
  maxParticipants: number;
  hasPassword?: boolean;
  invitePasscode?: string | null;
  participantCount?: number;
  createdAt: string;
}

export interface RoomPeer {
  peerId: string;
  uid: string;
  userId: number | null;
  displayName: string;
  avatarUrl: string | null;
  role: 'host' | 'co_host' | 'participant';
  audioEnabled: boolean;
  videoEnabled: boolean;
  handRaised: boolean;
  screenSharing: boolean;
  networkQuality: 'excellent' | 'good' | 'poor';
}

export interface WaitingPeer {
  peerId: string;
  uid: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ChatMessageItem {
  id: number;
  meetingId: number;
  senderUid: string;
  senderName: string;
  recipientUid: string | null;
  recipientName: string | null;
  messageType: 'text' | 'file' | 'announcement';
  content: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: string;
}

export interface WhiteboardStrokeItem {
  id?: number;
  strokeId: string;
  authorUid: string;
  tool: 'pen' | 'highlighter' | 'eraser' | 'rect' | 'circle' | 'line' | 'text';
  color: string;
  width: number;
  pointsJson: string;
  textContent?: string | null;
}

export interface PollOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface ClassroomPollItem {
  id: number;
  question: string;
  isQuiz: boolean;
  options: PollOption[];
  isActive: boolean;
  votes: Array<{
    id: number;
    voterUid: string;
    voterName: string;
    optionId: string;
  }>;
  createdAt: string;
}

export interface ClassroomQuestionItem {
  id: number;
  authorUid: string;
  authorName: string;
  question: string;
  answer: string | null;
  answeredBy: string | null;
  upvotes: number;
  isAnswered: boolean;
  createdAt: string;
}

export interface TeachingMaterialItem {
  id: number;
  uploaderUid: string;
  uploaderName: string;
  title: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

export interface AttendanceRecord {
  id: number;
  participantUid: string;
  displayName: string;
  email: string | null;
  role: string;
  status: string;
  joinedAt: string;
  leftAt: string | null;
  durationSeconds: number;
}

export interface RecordingLibraryItem {
  recording: {
    id: number;
    meetingId: number;
    title: string;
    fileName: string;
    fileSizeBytes: number;
    durationSeconds: number;
    accessScope: string;
    createdAt: string;
  };
  meetingTitle: string;
  meetingCode: string;
  hostName: string;
}

export interface ActiveJoinSession {
  meetingToken: string;
  participantUid: string;
  displayName: string;
  role: 'host' | 'co_host' | 'participant';
  livekit: { url: string; token: string } | null;
  iceServers: RTCIceServer[];
  initialAudio?: boolean;
  initialVideo?: boolean;
  meeting: {
    id: number;
    meetingCode: string;
    title: string;
    hostName: string;
    isClassroomMode: boolean;
    durationMinutes: number;
    waitingRoomEnabled: boolean;
    chatDisabled: boolean;
    isLocked: boolean;
    maxParticipants: number;
    invitePasscode?: string | null;
  };
}

import crypto from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { verifyMeetingToken } from '../middleware/auth.ts';
import {
  answerQaQuestion,
  castPollVote,
  clearWhiteboardStrokes,
  closePoll,
  createPoll,
  createQaQuestion,
  getMeetingByCode,
  listChatMessagesForUser,
  listMeetingAttendance,
  listPollsWithVotes,
  listQaQuestions,
  listTeachingMaterials,
  listWhiteboardStrokes,
  markParticipantLeft,
  removeWhiteboardStrokeByStrokeId,
  saveChatMessage,
  saveWhiteboardStroke,
  updateMeetingFields,
  upsertMeetingParticipant,
  upvoteQaQuestion,
} from '../db/repository.ts';

interface PeerState {
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
  socket: WebSocket;
}

interface WaitingPeer {
  peerId: string;
  uid: string;
  userId: number | null;
  displayName: string;
  avatarUrl: string | null;
  socket: WebSocket;
}

interface RoomState {
  meetingId: number;
  meetingCode: string;
  hostUid: string;
  isLocked: boolean;
  chatDisabled: boolean;
  waitingRoomEnabled: boolean;
  whiteboardLocked: boolean;
  isRecording: boolean;
  recordingBy: string | null;
  peers: Map<string, PeerState>;
  waiting: Map<string, WaitingPeer>;
}

const rooms = new Map<string, RoomState>();

function sendJson(ws: WebSocket, event: string, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, payload }));
  }
}

function broadcastRoom(
  room: RoomState,
  event: string,
  payload: unknown,
  excludePeerId?: string
) {
  for (const peer of room.peers.values()) {
    if (excludePeerId && peer.peerId === excludePeerId) continue;
    sendJson(peer.socket, event, payload);
  }
}

function serializePeers(room: RoomState) {
  return Array.from(room.peers.values()).map((p) => ({
    peerId: p.peerId,
    uid: p.uid,
    userId: p.userId,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    role: p.role,
    audioEnabled: p.audioEnabled,
    videoEnabled: p.videoEnabled,
    handRaised: p.handRaised,
    screenSharing: p.screenSharing,
    networkQuality: p.networkQuality,
  }));
}

function serializeWaiting(room: RoomState) {
  return Array.from(room.waiting.values()).map((w) => ({
    peerId: w.peerId,
    uid: w.uid,
    displayName: w.displayName,
    avatarUrl: w.avatarUrl,
  }));
}

function broadcastWaitingToHosts(room: RoomState) {
  const waitingList = serializeWaiting(room);
  for (const peer of room.peers.values()) {
    if (peer.role === 'host' || peer.role === 'co_host') {
      sendJson(peer.socket, 'waiting:list', { waiting: waitingList });
    }
  }
}

async function admitPeerToRoom(room: RoomState, peer: PeerState) {
  room.peers.set(peer.peerId, peer);

  await upsertMeetingParticipant({
    meetingId: room.meetingId,
    userId: peer.userId,
    participantUid: peer.uid,
    displayName: peer.displayName,
    role: peer.role,
    status: 'joined',
  });

  const [messages, strokes, polls, questions, materials, attendance] =
    await Promise.all([
      listChatMessagesForUser(room.meetingId, peer.uid),
      listWhiteboardStrokes(room.meetingId),
      listPollsWithVotes(room.meetingId),
      listQaQuestions(room.meetingId),
      listTeachingMaterials(room.meetingId),
      listMeetingAttendance(room.meetingId),
    ]);

  sendJson(peer.socket, 'room:joined', {
    peerId: peer.peerId,
    role: peer.role,
    room: {
      meetingCode: room.meetingCode,
      isLocked: room.isLocked,
      chatDisabled: room.chatDisabled,
      waitingRoomEnabled: room.waitingRoomEnabled,
      whiteboardLocked: room.whiteboardLocked,
      isRecording: room.isRecording,
      recordingBy: room.recordingBy,
    },
    peers: serializePeers(room),
    waiting:
      peer.role === 'host' || peer.role === 'co_host'
        ? serializeWaiting(room)
        : [],
    messages,
    strokes,
    polls,
    questions,
    materials,
    attendance,
  });

  broadcastRoom(
    room,
    'peer:joined',
    {
      peer: {
        peerId: peer.peerId,
        uid: peer.uid,
        userId: peer.userId,
        displayName: peer.displayName,
        avatarUrl: peer.avatarUrl,
        role: peer.role,
        audioEnabled: peer.audioEnabled,
        videoEnabled: peer.videoEnabled,
        handRaised: peer.handRaised,
        screenSharing: peer.screenSharing,
        networkQuality: peer.networkQuality,
      },
    },
    peer.peerId
  );
}

export function notifyRoomMaterialAdded(meetingCode: string, material: unknown) {
  const room = rooms.get(meetingCode.toUpperCase());
  if (!room) return;
  broadcastRoom(room, 'material:added', { material });
}

export function forceEndMeetingRoom(meetingCode: string) {
  const room = rooms.get(meetingCode.toUpperCase());
  if (!room) return;
  broadcastRoom(room, 'meeting:ended', {
    reason: 'Ended by administrator or host',
  });
  for (const peer of room.peers.values()) {
    peer.socket.close();
  }
  for (const w of room.waiting.values()) {
    sendJson(w.socket, 'meeting:ended', {
      reason: 'Meeting has ended',
    });
    w.socket.close();
  }
  rooms.delete(meetingCode.toUpperCase());
}

export function attachWebSocketServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    let currentRoom: RoomState | null = null;
    let currentPeerId: string | null = null;
    let currentUid: string | null = null;
    let isWaiting = false;

    ws.on('message', async (raw) => {
      try {
        const parsed = JSON.parse(raw.toString()) as {
          event: string;
          payload?: Record<string, any>;
        };
        const { event, payload = {} } = parsed;

        if (event === 'ping') {
          sendJson(ws, 'pong', { ts: Date.now() });
          return;
        }

        if (event === 'room:join') {
          const token = String(payload.meetingToken || '');
          const decoded = verifyMeetingToken(token);
          if (!decoded) {
            sendJson(ws, 'room:error', {
              message: 'Invalid or expired meeting access token.',
            });
            return;
          }

          const code = decoded.meetingCode.toUpperCase();
          const meeting = await getMeetingByCode(code);
          if (!meeting || meeting.status === 'ended') {
            sendJson(ws, 'room:error', {
              message: 'This meeting does not exist or has already ended.',
            });
            return;
          }

          let room = rooms.get(code);
          if (!room) {
            room = {
              meetingId: meeting.id,
              meetingCode: code,
              hostUid: meeting.hostUid,
              isLocked: meeting.isLocked,
              chatDisabled: meeting.chatDisabled,
              waitingRoomEnabled: meeting.waitingRoomEnabled,
              whiteboardLocked: false,
              isRecording: false,
              recordingBy: null,
              peers: new Map(),
              waiting: new Map(),
            };
            rooms.set(code, room);
          }

          const isHostOrCoHost =
            decoded.role === 'host' ||
            decoded.role === 'co_host' ||
            decoded.participantUid === meeting.hostUid;

          if (room.isLocked && !isHostOrCoHost) {
            sendJson(ws, 'room:error', {
              message: 'This meeting has been locked by the host.',
            });
            return;
          }

          if (room.peers.size >= meeting.maxParticipants && !isHostOrCoHost) {
            sendJson(ws, 'room:error', {
              message: `Participant limit (${meeting.maxParticipants}) reached for this room.`,
            });
            return;
          }

          // Mark meeting live if host joins
          if (meeting.status === 'scheduled' && (isHostOrCoHost || meeting.allowJoinBeforeHost)) {
            await updateMeetingFields(meeting.id, {
              status: 'live',
              startedAt: meeting.startedAt || new Date(),
            });
          }

          // Clean up any stale socket with same participantUid
          for (const [oldId, existing] of room.peers.entries()) {
            if (existing.uid === decoded.participantUid) {
              room.peers.delete(oldId);
              broadcastRoom(room, 'peer:left', { peerId: oldId });
            }
          }

          const peerId = crypto.randomUUID();
          currentRoom = room;
          currentPeerId = peerId;
          currentUid = decoded.participantUid;

          const userIdNum =
            typeof payload.userId === 'number' ? payload.userId : null;
          const avatarUrl =
            typeof payload.avatarUrl === 'string' ? payload.avatarUrl : null;

          // Check waiting room
          if (room.waitingRoomEnabled && !isHostOrCoHost) {
            isWaiting = true;
            const wp: WaitingPeer = {
              peerId,
              uid: decoded.participantUid,
              userId: userIdNum,
              displayName: decoded.displayName,
              avatarUrl,
              socket: ws,
            };
            room.waiting.set(peerId, wp);
            await upsertMeetingParticipant({
              meetingId: room.meetingId,
              userId: userIdNum,
              participantUid: decoded.participantUid,
              displayName: decoded.displayName,
              role: 'participant',
              status: 'waiting',
            });
            sendJson(ws, 'room:waiting', {
              peerId,
              meetingTitle: meeting.title,
              hostName: meeting.hostName,
            });
            broadcastWaitingToHosts(room);
            return;
          }

          isWaiting = false;
          const peerRole: 'host' | 'co_host' | 'participant' =
            decoded.participantUid === meeting.hostUid
              ? 'host'
              : decoded.role === 'co_host'
                ? 'co_host'
                : 'participant';

          await admitPeerToRoom(room, {
            peerId,
            uid: decoded.participantUid,
            userId: userIdNum,
            displayName: decoded.displayName,
            avatarUrl,
            role: peerRole,
            audioEnabled: payload.audioEnabled !== false,
            videoEnabled: payload.videoEnabled !== false,
            handRaised: false,
            screenSharing: false,
            networkQuality: 'excellent',
            socket: ws,
          });
          return;
        }

        if (!currentRoom || !currentPeerId) return;
        const room = currentRoom;
        const sender = room.peers.get(currentPeerId);
        if (!sender) return;

        // WebRTC signaling relay
        if (
          event === 'webrtc:offer' ||
          event === 'webrtc:answer' ||
          event === 'webrtc:ice-candidate'
        ) {
          const targetPeerId = String(payload.targetPeerId || '');
          const target = room.peers.get(targetPeerId);
          if (target) {
            sendJson(target.socket, event, {
              fromPeerId: sender.peerId,
              ...payload,
            });
          }
          return;
        }

        // Media state updates (mic, cam, screen, hand raise, network quality)
        if (event === 'media:state') {
          if (typeof payload.audioEnabled === 'boolean') {
            sender.audioEnabled = payload.audioEnabled;
          }
          if (typeof payload.videoEnabled === 'boolean') {
            sender.videoEnabled = payload.videoEnabled;
          }
          if (typeof payload.handRaised === 'boolean') {
            sender.handRaised = payload.handRaised;
          }
          if (typeof payload.screenSharing === 'boolean') {
            sender.screenSharing = payload.screenSharing;
          }
          if (
            payload.networkQuality === 'excellent' ||
            payload.networkQuality === 'good' ||
            payload.networkQuality === 'poor'
          ) {
            sender.networkQuality = payload.networkQuality;
          }
          broadcastRoom(room, 'peer:updated', {
            peerId: sender.peerId,
            audioEnabled: sender.audioEnabled,
            videoEnabled: sender.videoEnabled,
            handRaised: sender.handRaised,
            screenSharing: sender.screenSharing,
            networkQuality: sender.networkQuality,
          });
          return;
        }

        // Reactions
        if (event === 'reaction:send') {
          const emoji = String(payload.emoji || '👍').slice(0, 8);
          broadcastRoom(room, 'reaction:received', {
            id: crypto.randomUUID(),
            peerId: sender.peerId,
            displayName: sender.displayName,
            emoji,
          });
          return;
        }

        // Chat & announcements
        if (event === 'chat:send') {
          const isHostOrCo = sender.role === 'host' || sender.role === 'co_host';
          if (room.chatDisabled && !isHostOrCo) {
            sendJson(ws, 'chat:error', {
              message: 'Chat has been disabled by the host.',
            });
            return;
          }
          const content = String(payload.content || '').trim();
          if (!content && !payload.attachmentUrl) return;

          const recipientUid = payload.recipientUid
            ? String(payload.recipientUid)
            : null;
          let recipientName: string | null = null;
          if (recipientUid) {
            const targetPeer = Array.from(room.peers.values()).find(
              (p) => p.uid === recipientUid
            );
            recipientName = targetPeer?.displayName || 'Participant';
          }

          const messageType =
            payload.messageType === 'announcement' && isHostOrCo
              ? 'announcement'
              : payload.attachmentUrl
                ? 'file'
                : 'text';

          const saved = await saveChatMessage({
            meetingId: room.meetingId,
            senderUid: sender.uid,
            senderName: sender.displayName,
            recipientUid,
            recipientName,
            messageType,
            content: content || (payload.attachmentName ? `Shared file: ${payload.attachmentName}` : ''),
            attachmentUrl: payload.attachmentUrl ? String(payload.attachmentUrl) : null,
            attachmentName: payload.attachmentName ? String(payload.attachmentName) : null,
          });

          if (recipientUid) {
            sendJson(sender.socket, 'chat:message', saved);
            for (const p of room.peers.values()) {
              if (p.uid === recipientUid && p.peerId !== sender.peerId) {
                sendJson(p.socket, 'chat:message', saved);
              }
            }
          } else {
            broadcastRoom(room, 'chat:message', saved);
          }
          return;
        }

        // Whiteboard strokes
        if (event === 'whiteboard:stroke') {
          const isHostOrCo = sender.role === 'host' || sender.role === 'co_host';
          if (room.whiteboardLocked && !isHostOrCo) {
            return;
          }
          const stroke = {
            meetingId: room.meetingId,
            strokeId: String(payload.strokeId || crypto.randomUUID()),
            authorUid: sender.uid,
            tool: String(payload.tool || 'pen'),
            color: String(payload.color || '#2563eb'),
            width: Number(payload.width || 3),
            pointsJson: JSON.stringify(payload.points || []),
            textContent: payload.textContent ? String(payload.textContent) : null,
          };
          const saved = await saveWhiteboardStroke(stroke);
          broadcastRoom(room, 'whiteboard:stroke', saved, sender.peerId);
          return;
        }

        if (event === 'whiteboard:undo') {
          const strokeId = String(payload.strokeId || '');
          if (!strokeId) return;
          await removeWhiteboardStrokeByStrokeId(room.meetingId, strokeId);
          broadcastRoom(room, 'whiteboard:undo', { strokeId });
          return;
        }

        if (event === 'whiteboard:clear') {
          if (sender.role !== 'host' && sender.role !== 'co_host') return;
          await clearWhiteboardStrokes(room.meetingId);
          broadcastRoom(room, 'whiteboard:clear', {});
          return;
        }

        if (event === 'whiteboard:control-mode') {
          if (sender.role !== 'host' && sender.role !== 'co_host') return;
          room.whiteboardLocked = Boolean(payload.locked);
          broadcastRoom(room, 'room:settings', {
            whiteboardLocked: room.whiteboardLocked,
          });
          return;
        }

        // Classroom Polls & Quizzes
        if (event === 'poll:create') {
          if (sender.role !== 'host' && sender.role !== 'co_host') return;
          const question = String(payload.question || '').trim();
          const options = Array.isArray(payload.options) ? payload.options : [];
          if (!question || options.length < 2) return;
          await createPoll({
            meetingId: room.meetingId,
            creatorUid: sender.uid,
            question,
            isQuiz: Boolean(payload.isQuiz),
            options,
          });
          const polls = await listPollsWithVotes(room.meetingId);
          broadcastRoom(room, 'polls:updated', { polls });
          return;
        }

        if (event === 'poll:vote') {
          const pollId = Number(payload.pollId);
          const optionId = String(payload.optionId || '');
          if (!pollId || !optionId) return;
          await castPollVote({
            pollId,
            voterUid: sender.uid,
            voterName: sender.displayName,
            optionId,
          });
          const polls = await listPollsWithVotes(room.meetingId);
          broadcastRoom(room, 'polls:updated', { polls });
          return;
        }

        if (event === 'poll:close') {
          if (sender.role !== 'host' && sender.role !== 'co_host') return;
          const pollId = Number(payload.pollId);
          if (!pollId) return;
          await closePoll(pollId);
          const polls = await listPollsWithVotes(room.meetingId);
          broadcastRoom(room, 'polls:updated', { polls });
          return;
        }

        // Classroom Q&A
        if (event === 'qa:ask') {
          const questionText = String(payload.question || '').trim();
          if (!questionText) return;
          await createQaQuestion({
            meetingId: room.meetingId,
            authorUid: sender.uid,
            authorName: sender.displayName,
            question: questionText,
          });
          const questions = await listQaQuestions(room.meetingId);
          broadcastRoom(room, 'qa:updated', { questions });
          return;
        }

        if (event === 'qa:upvote') {
          const questionId = Number(payload.questionId);
          if (!questionId) return;
          await upvoteQaQuestion(questionId);
          const questions = await listQaQuestions(room.meetingId);
          broadcastRoom(room, 'qa:updated', { questions });
          return;
        }

        if (event === 'qa:answer') {
          if (sender.role !== 'host' && sender.role !== 'co_host') return;
          const questionId = Number(payload.questionId);
          const answer = String(payload.answer || '').trim();
          if (!questionId || !answer) return;
          await answerQaQuestion({
            questionId,
            answer,
            answeredBy: sender.displayName,
          });
          const questions = await listQaQuestions(room.meetingId);
          broadcastRoom(room, 'qa:updated', { questions });
          return;
        }

        // Recording consent status
        if (event === 'recording:status') {
          if (sender.role !== 'host' && sender.role !== 'co_host') return;
          room.isRecording = Boolean(payload.isRecording);
          room.recordingBy = room.isRecording ? sender.displayName : null;
          broadcastRoom(room, 'recording:status', {
            isRecording: room.isRecording,
            recordingBy: room.recordingBy,
          });
          return;
        }

        // Host & Co-host management controls
        if (event.startsWith('host:')) {
          if (sender.role !== 'host' && sender.role !== 'co_host') return;

          if (event === 'host:admit-peer') {
            const targetId = String(payload.peerId || '');
            const wp = room.waiting.get(targetId);
            if (!wp) return;
            room.waiting.delete(targetId);
            broadcastWaitingToHosts(room);
            await admitPeerToRoom(room, {
              peerId: wp.peerId,
              uid: wp.uid,
              userId: wp.userId,
              displayName: wp.displayName,
              avatarUrl: wp.avatarUrl,
              role: 'participant',
              audioEnabled: true,
              videoEnabled: true,
              handRaised: false,
              screenSharing: false,
              networkQuality: 'excellent',
              socket: wp.socket,
            });
            return;
          }

          if (event === 'host:reject-peer') {
            const targetId = String(payload.peerId || '');
            const wp = room.waiting.get(targetId);
            if (!wp) return;
            room.waiting.delete(targetId);
            await upsertMeetingParticipant({
              meetingId: room.meetingId,
              userId: wp.userId,
              participantUid: wp.uid,
              displayName: wp.displayName,
              role: 'participant',
              status: 'rejected',
            });
            sendJson(wp.socket, 'room:rejected', {
              message: 'Entry was declined by the meeting host.',
            });
            wp.socket.close();
            broadcastWaitingToHosts(room);
            return;
          }

          if (event === 'host:mute-all') {
            for (const p of room.peers.values()) {
              if (p.role !== 'host' && p.peerId !== sender.peerId) {
                p.audioEnabled = false;
                sendJson(p.socket, 'host:force-mute', {
                  by: sender.displayName,
                });
              }
            }
            broadcastRoom(room, 'peers:sync', { peers: serializePeers(room) });
            return;
          }

          if (event === 'host:mute-peer') {
            const target = room.peers.get(String(payload.peerId || ''));
            if (target && target.role !== 'host') {
              target.audioEnabled = false;
              sendJson(target.socket, 'host:force-mute', {
                by: sender.displayName,
              });
              broadcastRoom(room, 'peer:updated', {
                peerId: target.peerId,
                audioEnabled: false,
              });
            }
            return;
          }

          if (event === 'host:disable-video-peer') {
            const target = room.peers.get(String(payload.peerId || ''));
            if (target && target.role !== 'host') {
              target.videoEnabled = false;
              sendJson(target.socket, 'host:force-video-off', {
                by: sender.displayName,
              });
              broadcastRoom(room, 'peer:updated', {
                peerId: target.peerId,
                videoEnabled: false,
              });
            }
            return;
          }

          if (event === 'host:stop-screenshare') {
            const target = room.peers.get(String(payload.peerId || ''));
            if (target) {
              target.screenSharing = false;
              sendJson(target.socket, 'host:force-stop-screenshare', {
                by: sender.displayName,
              });
              broadcastRoom(room, 'peer:updated', {
                peerId: target.peerId,
                screenSharing: false,
              });
            }
            return;
          }

          if (event === 'host:remove-peer') {
            const target = room.peers.get(String(payload.peerId || ''));
            if (target && target.role !== 'host') {
              room.peers.delete(target.peerId);
              await upsertMeetingParticipant({
                meetingId: room.meetingId,
                userId: target.userId,
                participantUid: target.uid,
                displayName: target.displayName,
                role: target.role,
                status: 'removed',
              });
              sendJson(target.socket, 'room:removed', {
                message: 'You were removed from the meeting by the host.',
              });
              target.socket.close();
              broadcastRoom(room, 'peer:left', { peerId: target.peerId });
            }
            return;
          }

          if (event === 'host:toggle-cohost') {
            if (sender.role !== 'host') return;
            const target = room.peers.get(String(payload.peerId || ''));
            if (target && target.role !== 'host') {
              target.role = target.role === 'co_host' ? 'participant' : 'co_host';
              await upsertMeetingParticipant({
                meetingId: room.meetingId,
                userId: target.userId,
                participantUid: target.uid,
                displayName: target.displayName,
                role: target.role,
                status: 'joined',
              });
              broadcastRoom(room, 'peers:sync', { peers: serializePeers(room) });
            }
            return;
          }

          if (event === 'host:transfer-host') {
            if (sender.role !== 'host') return;
            const target = room.peers.get(String(payload.peerId || ''));
            if (target && target.peerId !== sender.peerId) {
              sender.role = 'co_host';
              target.role = 'host';
              room.hostUid = target.uid;
              if (target.userId) {
                await updateMeetingFields(room.meetingId, {
                  hostId: target.userId,
                });
              }
              broadcastRoom(room, 'peers:sync', { peers: serializePeers(room) });
            }
            return;
          }

          if (event === 'host:toggle-lock') {
            room.isLocked = Boolean(payload.isLocked);
            await updateMeetingFields(room.meetingId, {
              isLocked: room.isLocked,
            });
            broadcastRoom(room, 'room:settings', { isLocked: room.isLocked });
            return;
          }

          if (event === 'host:toggle-chat') {
            room.chatDisabled = Boolean(payload.chatDisabled);
            await updateMeetingFields(room.meetingId, {
              chatDisabled: room.chatDisabled,
            });
            broadcastRoom(room, 'room:settings', {
              chatDisabled: room.chatDisabled,
            });
            return;
          }

          if (event === 'host:toggle-waiting-room') {
            room.waitingRoomEnabled = Boolean(payload.waitingRoomEnabled);
            await updateMeetingFields(room.meetingId, {
              waitingRoomEnabled: room.waitingRoomEnabled,
            });
            broadcastRoom(room, 'room:settings', {
              waitingRoomEnabled: room.waitingRoomEnabled,
            });
            return;
          }

          if (event === 'host:end-meeting') {
            if (sender.role !== 'host') return;
            await updateMeetingFields(room.meetingId, {
              status: 'ended',
              endedAt: new Date(),
            });
            forceEndMeetingRoom(room.meetingCode);
            return;
          }
        }
      } catch (err) {
        console.error('WebSocket message handling error:', err);
      }
    });

    ws.on('close', async () => {
      if (!currentRoom || !currentPeerId) return;
      const room = currentRoom;
      if (isWaiting) {
        room.waiting.delete(currentPeerId);
        broadcastWaitingToHosts(room);
      } else {
        const peer = room.peers.get(currentPeerId);
        if (peer) {
          room.peers.delete(currentPeerId);
          if (currentUid) {
            await markParticipantLeft(room.meetingId, currentUid);
          }
          broadcastRoom(room, 'peer:left', { peerId: currentPeerId });
        }
      }
      if (room.peers.size === 0 && room.waiting.size === 0) {
        rooms.delete(room.meetingCode);
      }
    });
  });

  return wss;
}

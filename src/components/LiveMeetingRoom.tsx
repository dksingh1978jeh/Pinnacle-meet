import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Hand,
  LayoutGrid,
  Lock,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  MonitorOff,
  MonitorUp,
  MoreVertical,
  Paperclip,
  PenTool,
  PhoneOff,
  Radio,
  Send,
  Settings2,
  ShieldAlert,
  Smile,
  Sparkles,
  Square,
  SwitchCamera,
  Unlock,
  UserCheck,
  UserMinus,
  Users,
  UserX,
  Video,
  VideoOff,
  VolumeX,
} from 'lucide-react';
import { Room as LiveKitRoom, RoomEvent, Track } from 'livekit-client';
import { useAuth } from '../context/AuthContext';
import type {
  ActiveJoinSession,
  AttendanceRecord,
  ChatMessageItem,
  ClassroomPollItem,
  ClassroomQuestionItem,
  RoomPeer,
  TeachingMaterialItem,
  WaitingPeer,
  WhiteboardStrokeItem,
} from '../types';
import { ClassroomSuite } from './ClassroomSuite';

interface LiveMeetingRoomProps {
  session: ActiveJoinSession;
  onLeave: () => void;
}

interface FloatingReaction {
  id: string;
  displayName: string;
  emoji: string;
}

const VideoTile: React.FC<{
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  displayName: string;
  role: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  handRaised: boolean;
  screenSharing: boolean;
  networkQuality: 'excellent' | 'good' | 'poor';
  isSpeaking?: boolean;
  compact?: boolean;
}> = ({
  stream,
  muted,
  mirror,
  displayName,
  role,
  audioEnabled,
  videoEnabled,
  handRaised,
  screenSharing,
  networkQuality,
  isSpeaking,
  compact,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
  }, [stream]);

  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-slate-900 border transition-colors ${
        isSpeaking
          ? 'border-blue-500 ring-2 ring-blue-500/40'
          : 'border-slate-800'
      } ${compact ? 'h-32 sm:h-36' : 'h-full w-full min-h-[180px]'}`}
    >
      {stream && (videoEnabled || screenSharing) ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`h-full w-full ${
            screenSharing ? 'object-contain bg-slate-950' : 'object-cover'
          } ${mirror && !screenSharing ? '-scale-x-100' : ''}`}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 text-slate-300">
          {stream && !muted && <video ref={videoRef} autoPlay playsInline className="hidden" />}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/20 border border-blue-500/40 font-display text-xl font-bold text-blue-300">
            {initials || 'PM'}
          </div>
        </div>
      )}

      {/* Hand Raised Banner */}
      {handRaised && (
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-slate-950 shadow">
          <Hand className="h-3.5 w-3.5" />
          <span>Hand Raised</span>
        </div>
      )}

      {/* Network Quality Indicator */}
      <div className="absolute top-3 right-3 rounded-md bg-slate-950/75 px-2 py-0.5 text-[11px] font-medium text-slate-200">
        {screenSharing ? 'Presenting' : networkQuality === 'poor' ? 'Low Bandwidth' : 'HD'}
      </div>

      {/* Bottom Scrim Metadata */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-xs font-semibold text-white">
            {displayName}
          </span>
          {role !== 'participant' && (
            <span className="text-[11px] text-blue-300 capitalize shrink-0">
              · {role === 'co_host' ? 'Co-host' : 'Host'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!audioEnabled && (
            <span className="rounded bg-red-600/90 p-1 text-white" title="Muted">
              <MicOff className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const LiveMeetingRoom: React.FC<LiveMeetingRoomProps> = ({
  session,
  onLeave,
}) => {
  const { user, authFetch } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Connection & Waiting state
  const [roomStatus, setRoomStatus] = useState<'connecting' | 'waiting' | 'joined' | 'ended'>('connecting');
  const [statusMessage, setStatusMessage] = useState('Connecting to meeting server...');
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<'host' | 'co_host' | 'participant'>(session.role);

  // Room settings
  const [isLocked, setIsLocked] = useState(session.meeting.isLocked);
  const [chatDisabled, setChatDisabled] = useState(session.meeting.chatDisabled);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(session.meeting.waitingRoomEnabled);
  const [whiteboardLocked, setWhiteboardLocked] = useState(false);

  // Local media state
  const [audioEnabled, setAudioEnabled] = useState(session.initialAudio !== false);
  const [videoEnabled, setVideoEnabled] = useState(session.initialVideo !== false);
  const [handRaised, setHandRaised] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Peers & Streams
  const [peers, setPeers] = useState<RoomPeer[]>([]);
  const [waitingList, setWaitingList] = useState<WaitingPeer[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const livekitRoomRef = useRef<LiveKitRoom | null>(null);

  // Active Speaker & Layout
  const [layout, setLayout] = useState<'gallery' | 'speaker' | 'classroom'>(
    session.meeting.isClassroomMode ? 'classroom' : 'gallery'
  );
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Side Panels
  const [sidePanel, setSidePanel] = useState<'none' | 'chat' | 'participants'>('chat');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Chat, Reactions, Announcements
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatRecipientUid, setChatRecipientUid] = useState<string>('');
  const [isAnnouncementMode, setIsAnnouncementMode] = useState(false);
  const [announcementBanner, setAnnouncementBanner] = useState<ChatMessageItem | null>(null);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [showReactionsBar, setShowReactionsBar] = useState(false);

  // Classroom Data
  const [strokes, setStrokes] = useState<WhiteboardStrokeItem[]>([]);
  const [polls, setPolls] = useState<ClassroomPollItem[]>([]);
  const [questions, setQuestions] = useState<ClassroomQuestionItem[]>([]);
  const [materials, setMaterials] = useState<TeachingMaterialItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [remoteRecordingBy, setRemoteRecordingBy] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);

  // Meeting Elapsed Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // WebSocket Ref
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalLeaveRef = useRef(false);

  const isHostOrCoHost = myRole === 'host' || myRole === 'co_host';

  const sendWs = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, payload }));
    }
  }, []);

  // Meeting elapsed timer
  useEffect(() => {
    if (roomStatus !== 'joined') return;
    const t = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [roomStatus]);

  // Recording duration timer
  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return;
    }
    const t = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isRecording]);

  // Acquire initial local camera & microphone
  const acquireMedia = useCallback(
    async (wantAudio: boolean, wantVideo: boolean, facing: 'user' | 'environment', resMode: '720p' | '1080p') => {
      try {
        const videoConstraints: MediaTrackConstraints | boolean = wantVideo
          ? {
              width: { ideal: resMode === '1080p' ? 1920 : 1280 },
              height: { ideal: resMode === '1080p' ? 1080 : 720 },
              facingMode: facing,
            }
          : false;
        const audioConstraints: MediaTrackConstraints | boolean = wantAudio
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false;

        if (!wantAudio && !wantVideo) {
          return new MediaStream();
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        });
        return stream;
      } catch {
        // Fallback: try audio-only if camera unavailable
        if (wantAudio) {
          try {
            return await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true },
              video: false,
            });
          } catch {
            return new MediaStream();
          }
        }
        return new MediaStream();
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    acquireMedia(
      session.initialAudio !== false,
      session.initialVideo !== false,
      'user',
      '720p'
    ).then((stream) => {
      if (!mounted) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      const hasAudio = stream.getAudioTracks().length > 0;
      const hasVideo = stream.getVideoTracks().length > 0;
      if (!hasAudio) setAudioEnabled(false);
      if (!hasVideo) setVideoEnabled(false);
    });

    return () => {
      mounted = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [acquireMedia, session.initialAudio, session.initialVideo]);

  // Create or retrieve WebRTC RTCPeerConnection for a remote peer
  const getOrCreatePeerConnection = useCallback(
    (remotePeerId: string, myId: string) => {
      const existing = peerConnectionsRef.current.get(remotePeerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({
        iceServers: session.iceServers,
      });

      const activeStream = screenStreamRef.current || localStreamRef.current;
      if (localStreamRef.current) {
        for (const audioTrack of localStreamRef.current.getAudioTracks()) {
          pc.addTrack(audioTrack, localStreamRef.current);
        }
      }
      if (activeStream) {
        for (const videoTrack of activeStream.getVideoTracks()) {
          pc.addTrack(videoTrack, activeStream);
        }
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendWs('webrtc:ice-candidate', {
            targetPeerId: remotePeerId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (e) => {
        const remoteStream = e.streams[0] || new MediaStream([e.track]);
        setRemoteStreams((prev) => ({
          ...prev,
          [remotePeerId]: remoteStream,
        }));
      };

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === 'failed' ||
          pc.iceConnectionState === 'disconnected'
        ) {
          if (myId < remotePeerId) {
            pc.restartIce();
          }
        }
      };

      peerConnectionsRef.current.set(remotePeerId, pc);
      return pc;
    },
    [sendWs, session.iceServers]
  );

  // Sync tracks whenever localStream or screenStream changes
  useEffect(() => {
    const activeVideoTrack =
      screenStreamRef.current?.getVideoTracks()[0] ||
      localStream?.getVideoTracks()[0] ||
      null;
    const activeAudioTrack = localStream?.getAudioTracks()[0] || null;

    for (const pc of peerConnectionsRef.current.values()) {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === 'video');
      if (videoSender && activeVideoTrack) {
        videoSender.replaceTrack(activeVideoTrack).catch(() => {});
      }
      const audioSender = senders.find((s) => s.track?.kind === 'audio');
      if (audioSender && activeAudioTrack) {
        audioSender.replaceTrack(activeAudioTrack).catch(() => {});
      }
    }
  }, [localStream, screenSharing]);

  // Network Quality Monitor + Adaptive Bitrate via RTCPeerConnection.getStats()
  useEffect(() => {
    if (roomStatus !== 'joined') return;
    const interval = setInterval(async () => {
      const firstPc = peerConnectionsRef.current.values().next().value as
        | RTCPeerConnection
        | undefined;
      if (!firstPc) return;
      try {
        const stats = await firstPc.getStats();
        let rtt = 0;
        let packetsLost = 0;
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = Number(report.currentRoundTripTime || 0) * 1000;
          }
          if (report.type === 'remote-inbound-rtp') {
            packetsLost += Number(report.packetsLost || 0);
          }
        });
        const nextQuality: 'excellent' | 'good' | 'poor' =
          rtt > 350 || packetsLost > 25
            ? 'poor'
            : rtt > 150
              ? 'good'
              : 'excellent';

        if (nextQuality !== networkQuality) {
          setNetworkQuality(nextQuality);
          sendWs('media:state', { networkQuality: nextQuality });

          // Automatic bandwidth adaptation
          const targetMaxBitrate =
            nextQuality === 'poor' ? 350_000 : nextQuality === 'good' ? 900_000 : 1_800_000;
          for (const pc of peerConnectionsRef.current.values()) {
            const videoSender = pc
              .getSenders()
              .find((s) => s.track?.kind === 'video');
            if (videoSender) {
              const params = videoSender.getParameters();
              if (params.encodings && params.encodings.length > 0) {
                params.encodings[0].maxBitrate = targetMaxBitrate;
                videoSender.setParameters(params).catch(() => {});
              }
            }
          }
        }
      } catch {
        // ignore stats errors
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [networkQuality, roomStatus, sendWs]);

  // Optional LiveKit SFU connection when LiveKit env vars are configured
  useEffect(() => {
    if (!session.livekit || roomStatus !== 'joined') return;
    let active = true;
    const lk = new LiveKitRoom({
      adaptiveStream: true,
      dynacast: true,
    });
    livekitRoomRef.current = lk;

    lk.on(Track.Kind ? RoomEvent.TrackSubscribed : RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (!active) return;
      const stream = new MediaStream([track.mediaStreamTrack]);
      setRemoteStreams((prev) => ({
        ...prev,
        [`lk_${participant.identity}`]: stream,
      }));
    });

    lk.connect(session.livekit.url, session.livekit.token)
      .then(async () => {
        if (!active) return;
        await lk.localParticipant.setCameraEnabled(videoEnabled);
        await lk.localParticipant.setMicrophoneEnabled(audioEnabled);
      })
      .catch(() => {
        // Fallback to built-in WebRTC mesh if LiveKit unreachable
      });

    return () => {
      active = false;
      lk.disconnect();
      livekitRoomRef.current = null;
    };
  }, [session.livekit, roomStatus]);

  // Main WebSocket connection & auto-reconnect loop
  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      if (cancelled || intentionalLeaveRef.current) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        ws.send(
          JSON.stringify({
            event: 'room:join',
            payload: {
              meetingToken: session.meetingToken,
              userId: user?.id || null,
              avatarUrl: user?.avatarUrl || null,
              audioEnabled,
              videoEnabled,
            },
          })
        );
        heartbeatTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'ping' }));
          }
        }, 20000);
      };

      ws.onmessage = async (msg) => {
        const { event, payload } = JSON.parse(msg.data) as {
          event: string;
          payload: any;
        };

        if (event === 'room:waiting') {
          setRoomStatus('waiting');
          setStatusMessage(
            `Waiting for ${payload.hostName || 'the host'} to admit you into "${payload.meetingTitle}"...`
          );
          return;
        }

        if (event === 'room:rejected' || event === 'room:removed' || event === 'room:error' || event === 'meeting:ended') {
          setRoomStatus('ended');
          setStatusMessage(payload.message || payload.reason || 'Meeting ended.');
          return;
        }

        if (event === 'room:joined') {
          const selfId: string = payload.peerId;
          setMyPeerId(selfId);
          setMyRole(payload.role);
          setRoomStatus('joined');
          setIsLocked(Boolean(payload.room.isLocked));
          setChatDisabled(Boolean(payload.room.chatDisabled));
          setWaitingRoomEnabled(Boolean(payload.room.waitingRoomEnabled));
          setWhiteboardLocked(Boolean(payload.room.whiteboardLocked));
          setRemoteRecordingBy(
            payload.room.isRecording ? payload.room.recordingBy : null
          );
          setPeers(payload.peers || []);
          setWaitingList(payload.waiting || []);
          setMessages(payload.messages || []);
          setStrokes(payload.strokes || []);
          setPolls(payload.polls || []);
          setQuestions(payload.questions || []);
          setMaterials(payload.materials || []);
          setAttendance(payload.attendance || []);

          // Initiate WebRTC offers to existing peers if polite rule matches
          if (!session.livekit) {
            for (const p of (payload.peers || []) as RoomPeer[]) {
              if (p.peerId === selfId) continue;
              const pc = getOrCreatePeerConnection(p.peerId, selfId);
              if (selfId < p.peerId) {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                ws.send(
                  JSON.stringify({
                    event: 'webrtc:offer',
                    payload: { targetPeerId: p.peerId, sdp: offer },
                  })
                );
              }
            }
          }
          return;
        }

        if (event === 'peer:joined') {
          const newPeer = payload.peer as RoomPeer;
          setPeers((prev) =>
            prev.some((p) => p.peerId === newPeer.peerId)
              ? prev
              : [...prev, newPeer]
          );
          setMyPeerId((currentMyId) => {
            if (currentMyId && !session.livekit && newPeer.peerId !== currentMyId) {
              const pc = getOrCreatePeerConnection(newPeer.peerId, currentMyId);
              if (currentMyId < newPeer.peerId) {
                pc.createOffer().then(async (offer) => {
                  await pc.setLocalDescription(offer);
                  ws.send(
                    JSON.stringify({
                      event: 'webrtc:offer',
                      payload: { targetPeerId: newPeer.peerId, sdp: offer },
                    })
                  );
                });
              }
            }
            return currentMyId;
          });
          return;
        }

        if (event === 'peer:left') {
          const leftId: string = payload.peerId;
          setPeers((prev) => prev.filter((p) => p.peerId !== leftId));
          const pc = peerConnectionsRef.current.get(leftId);
          if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(leftId);
          }
          setRemoteStreams((prev) => {
            const copy = { ...prev };
            delete copy[leftId];
            return copy;
          });
          return;
        }

        if (event === 'peer:updated') {
          setPeers((prev) =>
            prev.map((p) =>
              p.peerId === payload.peerId ? { ...p, ...payload } : p
            )
          );
          return;
        }

        if (event === 'peers:sync') {
          const syncedPeers = payload.peers as RoomPeer[];
          setPeers(syncedPeers);
          setMyPeerId((currentMyId) => {
            const me = syncedPeers.find((p) => p.peerId === currentMyId);
            if (me) setMyRole(me.role);
            return currentMyId;
          });
          return;
        }

        if (event === 'waiting:list') {
          setWaitingList(payload.waiting || []);
          return;
        }

        if (event === 'room:settings') {
          if (typeof payload.isLocked === 'boolean') setIsLocked(payload.isLocked);
          if (typeof payload.chatDisabled === 'boolean') setChatDisabled(payload.chatDisabled);
          if (typeof payload.waitingRoomEnabled === 'boolean')
            setWaitingRoomEnabled(payload.waitingRoomEnabled);
          if (typeof payload.whiteboardLocked === 'boolean')
            setWhiteboardLocked(payload.whiteboardLocked);
          return;
        }

        // Host forced controls
        if (event === 'host:force-mute') {
          localStreamRef.current?.getAudioTracks().forEach((t) => {
            t.enabled = false;
          });
          setAudioEnabled(false);
          return;
        }
        if (event === 'host:force-video-off') {
          localStreamRef.current?.getVideoTracks().forEach((t) => {
            t.enabled = false;
          });
          setVideoEnabled(false);
          return;
        }
        if (event === 'host:force-stop-screenshare') {
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
          }
          setScreenSharing(false);
          return;
        }

        // WebRTC signaling messages
        if (event === 'webrtc:offer') {
          const fromId: string = payload.fromPeerId;
          setMyPeerId((currentMyId) => {
            const pc = getOrCreatePeerConnection(fromId, currentMyId || '');
            pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
              .then(async () => {
                const queued = pendingIceRef.current.get(fromId) || [];
                for (const cand of queued) {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                }
                pendingIceRef.current.delete(fromId);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(
                  JSON.stringify({
                    event: 'webrtc:answer',
                    payload: { targetPeerId: fromId, sdp: answer },
                  })
                );
              })
              .catch(() => {});
            return currentMyId;
          });
          return;
        }

        if (event === 'webrtc:answer') {
          const fromId: string = payload.fromPeerId;
          const pc = peerConnectionsRef.current.get(fromId);
          if (pc) {
            await pc
              .setRemoteDescription(new RTCSessionDescription(payload.sdp))
              .catch(() => {});
            const queued = pendingIceRef.current.get(fromId) || [];
            for (const cand of queued) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            pendingIceRef.current.delete(fromId);
          }
          return;
        }

        if (event === 'webrtc:ice-candidate') {
          const fromId: string = payload.fromPeerId;
          const pc = peerConnectionsRef.current.get(fromId);
          if (pc && pc.remoteDescription) {
            await pc
              .addIceCandidate(new RTCIceCandidate(payload.candidate))
              .catch(() => {});
          } else {
            const arr = pendingIceRef.current.get(fromId) || [];
            arr.push(payload.candidate);
            pendingIceRef.current.set(fromId, arr);
          }
          return;
        }

        // Chat, Reactions, Whiteboard, Polls, Q&A, Materials, Recording
        if (event === 'chat:message') {
          const m = payload as ChatMessageItem;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.messageType === 'announcement') {
            setAnnouncementBanner(m);
            setTimeout(() => setAnnouncementBanner(null), 10000);
          }
          return;
        }

        if (event === 'reaction:received') {
          const r = payload as FloatingReaction;
          setReactions((prev) => [...prev, r]);
          setTimeout(() => {
            setReactions((prev) => prev.filter((x) => x.id !== r.id));
          }, 3500);
          return;
        }

        if (event === 'whiteboard:stroke') {
          const s = payload as WhiteboardStrokeItem;
          setStrokes((prev) =>
            prev.some((x) => x.strokeId === s.strokeId) ? prev : [...prev, s]
          );
          return;
        }
        if (event === 'whiteboard:undo') {
          setStrokes((prev) => prev.filter((x) => x.strokeId !== payload.strokeId));
          return;
        }
        if (event === 'whiteboard:clear') {
          setStrokes([]);
          return;
        }

        if (event === 'polls:updated') {
          setPolls(payload.polls || []);
          return;
        }
        if (event === 'qa:updated') {
          setQuestions(payload.questions || []);
          return;
        }
        if (event === 'material:added') {
          const mat = payload.material as TeachingMaterialItem;
          setMaterials((prev) =>
            prev.some((x) => x.id === mat.id) ? prev : [mat, ...prev]
          );
          return;
        }
        if (event === 'recording:status') {
          setRemoteRecordingBy(payload.isRecording ? payload.recordingBy : null);
        }
      };

      ws.onclose = () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (cancelled || intentionalLeaveRef.current) return;
        const delay = Math.min(8000, 1000 * Math.pow(1.6, reconnectAttemptRef.current));
        reconnectAttemptRef.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      for (const pc of peerConnectionsRef.current.values()) {
        pc.close();
      }
      peerConnectionsRef.current.clear();
    };
  }, [session.meetingToken, session.livekit, getOrCreatePeerConnection, user?.id, user?.avatarUrl]);

  // Web Audio API Active Speaker Detection
  useEffect(() => {
    if (roomStatus !== 'joined') return;
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
    } catch {
      return;
    }

    const analysers = new Map<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>();

    const registerStream = (id: string, stream: MediaStream | null) => {
      if (!stream || !audioCtx || stream.getAudioTracks().length === 0) return;
      if (analysers.has(id)) return;
      try {
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        analysers.set(id, { analyser, data });
      } catch {
        // ignore audio source error
      }
    };

    if (myPeerId) registerStream(myPeerId, localStream);
    for (const [id, stream] of Object.entries(remoteStreams)) {
      registerStream(id, stream);
    }

    const timer = setInterval(() => {
      let loudestId: string | null = null;
      let maxEnergy = 24;
      for (const [id, item] of analysers.entries()) {
        item.analyser.getByteFrequencyData(item.data);
        let sum = 0;
        for (let i = 0; i < item.data.length; i++) sum += item.data[i];
        const avg = sum / item.data.length;
        if (avg > maxEnergy) {
          maxEnergy = avg;
          loudestId = id;
        }
      }
      if (loudestId) setActiveSpeakerId(loudestId);
    }, 600);

    return () => {
      clearInterval(timer);
      audioCtx?.close().catch(() => {});
    };
  }, [roomStatus, localStream, remoteStreams, myPeerId]);

  // Controls Handlers
  const toggleAudio = () => {
    const next = !audioEnabled;
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setAudioEnabled(next);
    sendWs('media:state', { audioEnabled: next });
  };

  const toggleVideo = async () => {
    const next = !videoEnabled;
    if (next && (!localStreamRef.current || localStreamRef.current.getVideoTracks().length === 0)) {
      const fresh = await acquireMedia(audioEnabled, true, facingMode, resolution);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = fresh;
      setLocalStream(fresh);
    } else {
      localStreamRef.current?.getVideoTracks().forEach((t) => {
        t.enabled = next;
      });
    }
    setVideoEnabled(next);
    sendWs('media:state', { videoEnabled: next });
  };

  const switchCamera = async () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    const fresh = await acquireMedia(audioEnabled, true, nextFacing, resolution);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = fresh;
    setLocalStream(fresh);
    setVideoEnabled(true);
    sendWs('media:state', { videoEnabled: true });
  };

  const changeResolution = async (nextRes: '720p' | '1080p') => {
    setResolution(nextRes);
    if (!videoEnabled) return;
    const fresh = await acquireMedia(audioEnabled, true, facingMode, nextRes);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = fresh;
    setLocalStream(fresh);
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
      sendWs('media:state', { screenSharing: false });
      return;
    }
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      screenStreamRef.current = displayStream;
      setScreenSharing(true);
      sendWs('media:state', { screenSharing: true });
      displayStream.getVideoTracks()[0].onended = () => {
        screenStreamRef.current = null;
        setScreenSharing(false);
        sendWs('media:state', { screenSharing: false });
      };
    } catch {
      // User cancelled screen share picker
    }
  };

  const toggleHandRaise = () => {
    const next = !handRaised;
    setHandRaised(next);
    sendWs('media:state', { handRaised: next });
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const toggleRecording = async () => {
    if (!isHostOrCoHost) return;
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      sendWs('recording:status', { isRecording: false });
      return;
    }

    const activeVideoSource =
      screenStreamRef.current || localStreamRef.current;
    if (!activeVideoSource) return;

    const mixedStream = new MediaStream();
    for (const vt of activeVideoSource.getVideoTracks()) {
      mixedStream.addTrack(vt);
    }
    try {
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
        audioCtx.createMediaStreamSource(localStreamRef.current).connect(dest);
      }
      for (const rs of Object.values(remoteStreams)) {
        if (rs.getAudioTracks().length > 0) {
          audioCtx.createMediaStreamSource(rs).connect(dest);
        }
      }
      for (const at of dest.stream.getAudioTracks()) {
        mixedStream.addTrack(at);
      }
    } catch {
      localStreamRef.current?.getAudioTracks().forEach((at) => mixedStream.addTrack(at));
    }

    recordedChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';
    const recorder = new MediaRecorder(mixedStream, { mimeType });
    mediaRecorderRef.current = recorder;
    recordingStartRef.current = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const durationSec = Math.max(
        1,
        Math.round((Date.now() - recordingStartRef.current) / 1000)
      );
      if (user) {
        const form = new FormData();
        form.append('recording', blob, `${session.meeting.meetingCode}.webm`);
        form.append('meetingCode', session.meeting.meetingCode);
        form.append('title', `${session.meeting.title} (${new Date().toLocaleDateString()})`);
        form.append('durationSeconds', String(durationSec));
        form.append('accessScope', 'participants');
        await authFetch('/api/recordings/upload', {
          method: 'POST',
          body: form,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${session.meeting.meetingCode}-recording.webm`;
        a.click();
        URL.revokeObjectURL(url);
      }
    };

    recorder.start(1000);
    setIsRecording(true);
    sendWs('recording:status', { isRecording: true });
  };

  const handleLeave = () => {
    intentionalLeaveRef.current = true;
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    }
    wsRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    onLeave();
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendWs('chat:send', {
      content: chatInput.trim(),
      recipientUid: chatRecipientUid || null,
      messageType: isAnnouncementMode && isHostOrCoHost ? 'announcement' : 'text',
    });
    setChatInput('');
    setIsAnnouncementMode(false);
  };

  const handleChatFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(
      `/api/meetings/${session.meeting.meetingCode}/chat-attachment`,
      { method: 'POST', body: form }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        attachmentUrl: string;
        attachmentName: string;
      };
      sendWs('chat:send', {
        content: `Shared file: ${data.attachmentName}`,
        recipientUid: chatRecipientUid || null,
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
      });
    }
    e.target.value = '';
  };

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const allTiles = useMemo(() => {
    const otherPeers = peers.filter((p) => p.peerId !== myPeerId);
    const selfTile = {
      peerId: myPeerId || 'self',
      uid: session.participantUid,
      displayName: `${session.displayName} (You)`,
      role: myRole,
      audioEnabled,
      videoEnabled,
      handRaised,
      screenSharing,
      networkQuality,
      stream: screenSharing
        ? screenStreamRef.current
        : localStream,
      isSelf: true,
    };
    const remoteTiles = otherPeers.map((p) => ({
      ...p,
      stream: remoteStreams[p.peerId] || remoteStreams[`lk_${p.uid}`] || null,
      isSelf: false,
    }));
    return [selfTile, ...remoteTiles];
  }, [
    peers,
    myPeerId,
    session.participantUid,
    session.displayName,
    myRole,
    audioEnabled,
    videoEnabled,
    handRaised,
    screenSharing,
    networkQuality,
    localStream,
    remoteStreams,
  ]);

  const presenterOrSpeakerTile = useMemo(() => {
    return (
      allTiles.find((t) => t.screenSharing) ||
      allTiles.find((t) => t.peerId === activeSpeakerId) ||
      allTiles[0]
    );
  }, [allTiles, activeSpeakerId]);

  if (roomStatus === 'connecting' || roomStatus === 'waiting' || roomStatus === 'ended') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-white">
        <div className="max-w-md space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
            {roomStatus === 'ended' ? (
              <ShieldAlert className="h-6 w-6 text-red-400" />
            ) : (
              <Video className="h-6 w-6" />
            )}
          </div>
          <h1 className="font-display text-xl font-bold">
            {roomStatus === 'waiting'
              ? 'Waiting Room'
              : roomStatus === 'ended'
                ? 'Session Ended'
                : 'Joining Room'}
          </h1>
          <p className="text-sm text-slate-300">{statusMessage}</p>
          <p className="font-mono text-xs text-slate-400">
            {session.meeting.meetingCode}
          </p>
          <button
            type="button"
            onClick={handleLeave}
            className="w-full rounded-xl border border-slate-700 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 overflow-hidden"
    >
      {/* Top Room Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-slate-950 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-display text-sm font-bold text-white truncate">
            {session.meeting.title}
          </span>
          <span className="hidden sm:inline text-xs font-mono text-slate-400 tabular-nums">
            · {session.meeting.meetingCode} · {formatDuration(elapsedSeconds)}
          </span>
          {isLocked && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-400">
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Locked</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Layout Switcher */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setLayout('gallery')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                layout === 'gallery'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Gallery</span>
            </button>
            <button
              type="button"
              onClick={() => setLayout('speaker')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                layout === 'speaker'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Speaker</span>
            </button>
            <button
              type="button"
              onClick={() => setLayout('classroom')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                layout === 'classroom'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <PenTool className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Classroom</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 cursor-pointer"
          >
            Invite
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 hover:bg-slate-800 cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {/* Recording Consent Banner */}
      {(isRecording || remoteRecordingBy) && (
        <div className="flex items-center justify-center gap-2 bg-red-600/95 px-4 py-1.5 text-xs font-semibold text-white">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          <span>
            Recording in progress · Initiated by{' '}
            {isRecording ? session.displayName : remoteRecordingBy} · By
            staying in this meeting, you consent to being recorded.
          </span>
          {isRecording && (
            <span className="font-mono tabular-nums">
              ({formatDuration(recordingSeconds)})
            </span>
          )}
        </div>
      )}

      {/* Teacher Announcement Banner */}
      {announcementBanner && (
        <div className="flex items-center justify-between bg-blue-600 px-4 py-2 text-xs font-medium text-white">
          <span>
            <strong>Announcement ({announcementBanner.senderName}):</strong>{' '}
            {announcementBanner.content}
          </span>
          <button
            type="button"
            onClick={() => setAnnouncementBanner(null)}
            className="underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Viewport + Sidebars */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* Video / Classroom Stage */}
        <main className="relative flex-1 min-w-0 p-3 sm:p-4 overflow-y-auto">
          {/* Floating Emoji Reactions */}
          <div className="pointer-events-none absolute bottom-6 left-6 z-30 flex flex-col gap-2">
            {reactions.map((r) => (
              <div
                key={r.id}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 border border-slate-700 px-3 py-1.5 text-sm shadow-lg"
              >
                <span className="text-lg">{r.emoji}</span>
                <span className="text-xs text-slate-200">{r.displayName}</span>
              </div>
            ))}
          </div>

          {layout === 'gallery' && (
            <div
              className={`grid h-full gap-3 ${
                allTiles.length === 1
                  ? 'grid-cols-1 max-w-4xl mx-auto'
                  : allTiles.length === 2
                    ? 'grid-cols-1 md:grid-cols-2'
                    : allTiles.length <= 4
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {allTiles.map((tile) => (
                <VideoTile
                  key={tile.peerId}
                  stream={tile.stream}
                  muted={tile.isSelf}
                  mirror={tile.isSelf}
                  displayName={tile.displayName}
                  role={tile.role}
                  audioEnabled={tile.audioEnabled}
                  videoEnabled={tile.videoEnabled}
                  handRaised={tile.handRaised}
                  screenSharing={tile.screenSharing}
                  networkQuality={tile.networkQuality}
                  isSpeaking={activeSpeakerId === tile.peerId}
                />
              ))}
            </div>
          )}

          {layout === 'speaker' && presenterOrSpeakerTile && (
            <div className="flex h-full flex-col lg:flex-row gap-3">
              <div className="flex-1 min-h-[280px]">
                <VideoTile
                  stream={presenterOrSpeakerTile.stream}
                  muted={presenterOrSpeakerTile.isSelf}
                  mirror={presenterOrSpeakerTile.isSelf}
                  displayName={presenterOrSpeakerTile.displayName}
                  role={presenterOrSpeakerTile.role}
                  audioEnabled={presenterOrSpeakerTile.audioEnabled}
                  videoEnabled={presenterOrSpeakerTile.videoEnabled}
                  handRaised={presenterOrSpeakerTile.handRaised}
                  screenSharing={presenterOrSpeakerTile.screenSharing}
                  networkQuality={presenterOrSpeakerTile.networkQuality}
                  isSpeaking
                />
              </div>
              {allTiles.length > 1 && (
                <div className="flex lg:flex-col gap-2.5 lg:w-60 overflow-x-auto lg:overflow-y-auto shrink-0">
                  {allTiles
                    .filter((t) => t.peerId !== presenterOrSpeakerTile.peerId)
                    .map((tile) => (
                      <div key={tile.peerId} className="w-48 lg:w-full shrink-0">
                        <VideoTile
                          compact
                          stream={tile.stream}
                          muted={tile.isSelf}
                          mirror={tile.isSelf}
                          displayName={tile.displayName}
                          role={tile.role}
                          audioEnabled={tile.audioEnabled}
                          videoEnabled={tile.videoEnabled}
                          handRaised={tile.handRaised}
                          screenSharing={tile.screenSharing}
                          networkQuality={tile.networkQuality}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {layout === 'classroom' && (
            <div className="flex h-full flex-col lg:flex-row gap-3">
              <div className="flex-1 min-h-[360px]">
                <ClassroomSuite
                  meetingCode={session.meeting.meetingCode}
                  myUid={session.participantUid}
                  myName={session.displayName}
                  isTeacher={isHostOrCoHost}
                  whiteboardLocked={whiteboardLocked}
                  strokes={strokes}
                  polls={polls}
                  questions={questions}
                  materials={materials}
                  attendance={attendance}
                  onEmitStroke={(stroke) => {
                    setStrokes((prev) => [...prev, stroke]);
                    sendWs('whiteboard:stroke', {
                      strokeId: stroke.strokeId,
                      tool: stroke.tool,
                      color: stroke.color,
                      width: stroke.width,
                      points: JSON.parse(stroke.pointsJson),
                      textContent: stroke.textContent,
                    });
                  }}
                  onUndoStroke={(strokeId) => {
                    setStrokes((prev) =>
                      prev.filter((s) => s.strokeId !== strokeId)
                    );
                    sendWs('whiteboard:undo', { strokeId });
                  }}
                  onClearBoard={() => {
                    setStrokes([]);
                    sendWs('whiteboard:clear');
                  }}
                  onToggleBoardLock={(locked) => {
                    setWhiteboardLocked(locked);
                    sendWs('whiteboard:control-mode', { locked });
                  }}
                  onCreatePoll={(p) => sendWs('poll:create', p)}
                  onVotePoll={(pollId, optionId) =>
                    sendWs('poll:vote', { pollId, optionId })
                  }
                  onClosePoll={(pollId) => sendWs('poll:close', { pollId })}
                  onAskQuestion={(q) => sendWs('qa:ask', { question: q })}
                  onUpvoteQuestion={(questionId) =>
                    sendWs('qa:upvote', { questionId })
                  }
                  onAnswerQuestion={(questionId, answer) =>
                    sendWs('qa:answer', { questionId, answer })
                  }
                  onMaterialUploaded={(mat) =>
                    setMaterials((prev) =>
                      prev.some((x) => x.id === mat.id) ? prev : [mat, ...prev]
                    )
                  }
                />
              </div>

              <div className="flex lg:flex-col gap-2.5 lg:w-56 overflow-x-auto lg:overflow-y-auto shrink-0">
                {allTiles.map((tile) => (
                  <div key={tile.peerId} className="w-44 lg:w-full shrink-0">
                    <VideoTile
                      compact
                      stream={tile.stream}
                      muted={tile.isSelf}
                      mirror={tile.isSelf}
                      displayName={tile.displayName}
                      role={tile.role}
                      audioEnabled={tile.audioEnabled}
                      videoEnabled={tile.videoEnabled}
                      handRaised={tile.handRaised}
                      screenSharing={tile.screenSharing}
                      networkQuality={tile.networkQuality}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Right Side Panel: Chat or Participants */}
        {sidePanel !== 'none' && (
          <aside className="w-full sm:w-88 shrink-0 border-l border-slate-800 bg-slate-900 flex flex-col absolute inset-0 sm:static z-30">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSidePanel('chat')}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer ${
                    sidePanel === 'chat'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setSidePanel('participants')}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer ${
                    sidePanel === 'participants'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Participants ({peers.length})
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSidePanel('none')}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>

            {sidePanel === 'chat' && (
              <div className="flex flex-1 flex-col min-h-0">
                {isHostOrCoHost && (
                  <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-xs">
                    <span className="text-slate-400">Participant Chat</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !chatDisabled;
                        setChatDisabled(next);
                        sendWs('host:toggle-chat', { chatDisabled: next });
                      }}
                      className={`font-semibold cursor-pointer ${
                        chatDisabled ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {chatDisabled ? 'Disabled (Click to Enable)' : 'Enabled'}
                    </button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <p className="py-10 text-center text-xs text-slate-400">
                      Messages sent here are visible to room participants.
                    </p>
                  ) : (
                    messages.map((m) => {
                      const isDm = Boolean(m.recipientUid);
                      return (
                        <div
                          key={m.id}
                          className={`rounded-xl p-3 text-xs space-y-1 ${
                            m.messageType === 'announcement'
                              ? 'bg-blue-950/70 border border-blue-700'
                              : isDm
                                ? 'bg-indigo-950/50 border border-indigo-800/60'
                                : 'bg-slate-950/70 border border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-200">
                              {m.senderName}
                              {isDm && (
                                <span className="text-indigo-300">
                                  {' '}
                                  → {m.recipientName || 'Direct'} (Private)
                                </span>
                              )}
                            </span>
                            <span className="tabular-nums">
                              {new Date(m.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-slate-100 whitespace-pre-wrap break-words">
                            {m.content}
                          </p>
                          {m.attachmentUrl && (
                            <a
                              href={m.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-400 underline"
                            >
                              <Paperclip className="h-3 w-3" />
                              <span>{m.attachmentName || 'Attachment'}</span>
                            </a>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <form
                  onSubmit={handleSendChat}
                  className="border-t border-slate-800 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={chatRecipientUid}
                      onChange={(e) => setChatRecipientUid(e.target.value)}
                      className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1 text-xs text-slate-200"
                    >
                      <option value="">To: Everyone in Meeting</option>
                      {peers
                        .filter((p) => p.uid !== session.participantUid)
                        .map((p) => (
                          <option key={p.uid} value={p.uid}>
                            Private DM: {p.displayName}
                          </option>
                        ))}
                    </select>
                    {isHostOrCoHost && !chatRecipientUid && (
                      <label className="flex items-center gap-1 text-[11px] text-blue-300 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isAnnouncementMode}
                          onChange={(e) => setIsAnnouncementMode(e.target.checked)}
                          className="accent-blue-600"
                        />
                        <span>Announce</span>
                      </label>
                    )}
                  </div>

                  {chatDisabled && !isHostOrCoHost ? (
                    <p className="rounded-lg bg-slate-950 p-2 text-center text-xs text-amber-300">
                      Chat is currently disabled by the host.
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label
                        title="Share document or image"
                        className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 cursor-pointer"
                      >
                        <Paperclip className="h-4 w-4" />
                        <input
                          type="file"
                          onChange={handleChatFile}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={
                          chatRecipientUid
                            ? 'Send private message...'
                            : 'Type a message...'
                        }
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-blue-600 focus:outline-none"
                      />
                      <button
                        type="submit"
                        aria-label="Send message"
                        className="rounded-xl bg-blue-600 p-2 text-white hover:bg-blue-700 cursor-pointer"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </form>
              </div>
            )}

            {sidePanel === 'participants' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Host Global Controls */}
                {isHostOrCoHost && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-300">
                      Host Controls
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => sendWs('host:mute-all')}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-2 text-xs font-medium hover:bg-slate-700 cursor-pointer"
                      >
                        <VolumeX className="h-3.5 w-3.5" />
                        <span>Mute All</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isLocked;
                          setIsLocked(next);
                          sendWs('host:toggle-lock', { isLocked: next });
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-2 text-xs font-medium hover:bg-slate-700 cursor-pointer"
                      >
                        {isLocked ? (
                          <>
                            <Unlock className="h-3.5 w-3.5 text-amber-400" />
                            <span>Unlock</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-3.5 w-3.5" />
                            <span>Lock Room</span>
                          </>
                        )}
                      </button>
                    </div>
                    <label className="flex items-center justify-between pt-1 text-xs cursor-pointer">
                      <span className="text-slate-400">Waiting Room</span>
                      <input
                        type="checkbox"
                        checked={waitingRoomEnabled}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setWaitingRoomEnabled(next);
                          sendWs('host:toggle-waiting-room', {
                            waitingRoomEnabled: next,
                          });
                        }}
                        className="accent-blue-600"
                      />
                    </label>
                  </div>
                )}

                {/* Waiting Room Queue */}
                {isHostOrCoHost && waitingList.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-amber-400">
                      Waiting Room ({waitingList.length})
                    </p>
                    {waitingList.map((w) => (
                      <div
                        key={w.peerId}
                        className="flex items-center justify-between gap-2 rounded-xl border border-amber-800/50 bg-amber-950/30 p-2.5 text-xs"
                      >
                        <span className="font-medium truncate">
                          {w.displayName}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              sendWs('host:admit-peer', { peerId: w.peerId })
                            }
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            Admit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              sendWs('host:reject-peer', { peerId: w.peerId })
                            }
                            className="rounded-lg bg-red-600 px-2.5 py-1 font-semibold text-white hover:bg-red-700 cursor-pointer"
                          >
                            Deny
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Active Participants */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400">
                    In Call ({peers.length})
                  </p>
                  {peers.map((p) => (
                    <div
                      key={p.peerId}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white">
                            {p.displayName}{' '}
                            {p.peerId === myPeerId ? '(You)' : ''}
                          </p>
                          <p className="text-[11px] text-slate-400 capitalize">
                            {p.role.replace('_', '-')}
                            {p.handRaised ? ' · Hand Raised' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          {p.audioEnabled ? (
                            <Mic className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <MicOff className="h-3.5 w-3.5 text-red-400" />
                          )}
                          {p.videoEnabled ? (
                            <Video className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <VideoOff className="h-3.5 w-3.5 text-slate-500" />
                          )}
                        </div>
                      </div>

                      {isHostOrCoHost && p.peerId !== myPeerId && p.role !== 'host' && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/80 text-[11px]">
                          <button
                            type="button"
                            onClick={() =>
                              sendWs('host:mute-peer', { peerId: p.peerId })
                            }
                            className="rounded bg-slate-800 px-2 py-1 hover:bg-slate-700 cursor-pointer"
                          >
                            Mute
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              sendWs('host:disable-video-peer', {
                                peerId: p.peerId,
                              })
                            }
                            className="rounded bg-slate-800 px-2 py-1 hover:bg-slate-700 cursor-pointer"
                          >
                            Stop Cam
                          </button>
                          {p.screenSharing && (
                            <button
                              type="button"
                              onClick={() =>
                                sendWs('host:stop-screenshare', {
                                  peerId: p.peerId,
                                })
                              }
                              className="rounded bg-amber-700 px-2 py-1 text-white cursor-pointer"
                            >
                              Stop Share
                            </button>
                          )}
                          {myRole === 'host' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  sendWs('host:toggle-cohost', {
                                    peerId: p.peerId,
                                  })
                                }
                                className="rounded bg-slate-800 px-2 py-1 hover:bg-slate-700 cursor-pointer"
                              >
                                {p.role === 'co_host' ? 'Unset Co-host' : 'Make Co-host'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  sendWs('host:transfer-host', {
                                    peerId: p.peerId,
                                  })
                                }
                                className="rounded bg-blue-700 px-2 py-1 text-white hover:bg-blue-600 cursor-pointer"
                              >
                                Make Host
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              sendWs('host:remove-peer', { peerId: p.peerId })
                            }
                            className="rounded bg-red-600/80 px-2 py-1 text-white hover:bg-red-600 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Media Control Dock */}
      <footer className="relative flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-950 px-3 py-2.5 sm:px-6">
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
          <span>Quality:</span>
          <button
            type="button"
            onClick={() => changeResolution(resolution === '720p' ? '1080p' : '720p')}
            className="rounded-md border border-slate-700 px-2 py-1 font-mono text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            {resolution}
          </button>
        </div>

        {/* Center Action Dock */}
        <div className="mx-auto flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={toggleAudio}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer min-h-[44px] ${
              audioEnabled
                ? 'bg-slate-800 text-white hover:bg-slate-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{audioEnabled ? 'Mute' : 'Unmute'}</span>
          </button>

          <button
            type="button"
            onClick={toggleVideo}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer min-h-[44px] ${
              videoEnabled
                ? 'bg-slate-800 text-white hover:bg-slate-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{videoEnabled ? 'Stop Video' : 'Start Video'}</span>
          </button>

          <button
            type="button"
            onClick={switchCamera}
            title="Switch front/rear camera"
            className="inline-flex items-center justify-center rounded-full bg-slate-800 p-2.5 text-white hover:bg-slate-700 cursor-pointer min-h-[44px] min-w-[44px]"
          >
            <SwitchCamera className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleScreenShare}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer min-h-[44px] ${
              screenSharing
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
          >
            {screenSharing ? (
              <MonitorOff className="h-4 w-4" />
            ) : (
              <MonitorUp className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {screenSharing ? 'Stop Share' : 'Share Screen'}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleHandRaise}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-semibold cursor-pointer min-h-[44px] ${
              handRaised
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
          >
            <Hand className="h-4 w-4" />
            <span className="hidden md:inline">{handRaised ? 'Lower Hand' : 'Raise Hand'}</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReactionsBar((v) => !v)}
              className="inline-flex items-center justify-center rounded-full bg-slate-800 p-2.5 text-white hover:bg-slate-700 cursor-pointer min-h-[44px] min-w-[44px]"
              aria-label="Send reaction"
            >
              <Smile className="h-4 w-4" />
            </button>
            {showReactionsBar && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 shadow-xl z-40">
                {['👍', '👏', '❤️', '🎉', '😂', '💡'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      sendWs('reaction:send', { emoji });
                      setShowReactionsBar(false);
                    }}
                    className="text-lg hover:scale-125 transition-transform cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isHostOrCoHost && (
            <button
              type="button"
              onClick={toggleRecording}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-semibold cursor-pointer min-h-[44px] ${
                isRecording
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              {isRecording ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Radio className="h-4 w-4 text-red-400" />
              )}
              <span className="hidden md:inline">
                {isRecording ? 'Stop Rec' : 'Record'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSidePanel((p) => (p === 'chat' ? 'none' : 'chat'))}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-semibold cursor-pointer min-h-[44px] ${
              sidePanel === 'chat'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden md:inline">Chat</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setSidePanel((p) => (p === 'participants' ? 'none' : 'participants'))
            }
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-semibold cursor-pointer min-h-[44px] ${
              sidePanel === 'participants'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
          >
            <Users className="h-4 w-4" />
            <span className="tabular-nums">{peers.length}</span>
          </button>

          <button
            type="button"
            onClick={handleLeave}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer min-h-[44px]"
          >
            <PhoneOff className="h-4 w-4" />
            <span>Leave</span>
          </button>

          {myRole === 'host' && (
            <button
              type="button"
              onClick={() => sendWs('host:end-meeting')}
              className="hidden sm:inline-flex items-center rounded-full border border-red-500/60 px-3.5 py-2.5 text-xs font-semibold text-red-300 hover:bg-red-950/60 cursor-pointer min-h-[44px]"
            >
              End All
            </button>
          )}
        </div>

        <div className="hidden lg:block w-24" />
      </footer>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 text-white">
            <h3 className="font-display text-lg font-bold">
              Invite Participants
            </h3>
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 text-xs space-y-1.5 font-mono">
              <p>Meeting ID: {session.meeting.meetingCode}</p>
              {session.meeting.invitePasscode && (
                <p>Passcode: {session.meeting.invitePasscode}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('join', session.meeting.meetingCode);
                  const txt = `Join "${session.meeting.title}" on Pinnacle Meet\nMeeting ID: ${session.meeting.meetingCode}${
                    session.meeting.invitePasscode
                      ? `\nPasscode: ${session.meeting.invitePasscode}`
                      : ''
                  }\nLink: ${url.toString()}`;
                  await navigator.clipboard.writeText(txt);
                  setCopiedInvite(true);
                  setTimeout(() => setCopiedInvite(false), 2000);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                {copiedInvite ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copiedInvite ? 'Copied' : 'Copy Invite'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

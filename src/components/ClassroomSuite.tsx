import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Circle,
  Download,
  Eraser,
  FileText,
  HelpCircle,
  Lock,
  Minus,
  Pen,
  Square,
  ThumbsUp,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  Users,
} from 'lucide-react';
import type {
  AttendanceRecord,
  ClassroomPollItem,
  ClassroomQuestionItem,
  TeachingMaterialItem,
  WhiteboardStrokeItem,
} from '../types';

interface ClassroomSuiteProps {
  meetingCode: string;
  myUid: string;
  myName: string;
  isTeacher: boolean;
  whiteboardLocked: boolean;
  strokes: WhiteboardStrokeItem[];
  polls: ClassroomPollItem[];
  questions: ClassroomQuestionItem[];
  materials: TeachingMaterialItem[];
  attendance: AttendanceRecord[];
  onEmitStroke: (stroke: WhiteboardStrokeItem) => void;
  onUndoStroke: (strokeId: string) => void;
  onClearBoard: () => void;
  onToggleBoardLock: (locked: boolean) => void;
  onCreatePoll: (payload: {
    question: string;
    isQuiz: boolean;
    options: Array<{ id: string; text: string; isCorrect?: boolean }>;
  }) => void;
  onVotePoll: (pollId: number, optionId: string) => void;
  onClosePoll: (pollId: number) => void;
  onAskQuestion: (question: string) => void;
  onUpvoteQuestion: (questionId: number) => void;
  onAnswerQuestion: (questionId: number, answer: string) => void;
  onMaterialUploaded: (material: TeachingMaterialItem) => void;
}

const COLORS = ['#1e293b', '#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea'];

export const ClassroomSuite: React.FC<ClassroomSuiteProps> = ({
  meetingCode,
  myUid,
  myName,
  isTeacher,
  whiteboardLocked,
  strokes,
  polls,
  questions,
  materials,
  attendance,
  onEmitStroke,
  onUndoStroke,
  onClearBoard,
  onToggleBoardLock,
  onCreatePoll,
  onVotePoll,
  onClosePoll,
  onAskQuestion,
  onUpvoteQuestion,
  onAnswerQuestion,
  onMaterialUploaded,
}) => {
  const [activeTab, setActiveTab] = useState<
    'whiteboard' | 'materials' | 'polls' | 'qa' | 'attendance'
  >('whiteboard');

  // Whiteboard state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<WhiteboardStrokeItem['tool']>('pen');
  const [color, setColor] = useState('#2563eb');
  const [lineWidth, setLineWidth] = useState(3);
  const drawingRef = useRef(false);
  const currentPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const [textInput, setTextInput] = useState('');
  const [pendingTextPos, setPendingTextPos] = useState<{ x: number; y: number } | null>(null);

  // Materials state
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<TeachingMaterialItem | null>(null);

  // Polls state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollIsQuiz, setPollIsQuiz] = useState(false);
  const [pollOptions, setPollOptions] = useState([
    { id: 'opt1', text: '', isCorrect: true },
    { id: 'opt2', text: '', isCorrect: false },
  ]);

  // Q&A state
  const [newQuestion, setNewQuestion] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});

  const canDraw = isTeacher || !whiteboardLocked;

  const redrawCanvas = React.useCallback(
    (previewStroke?: WhiteboardStrokeItem) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle architectural dot grid
      ctx.fillStyle = '#e2e8f0';
      for (let gx = 24; gx < canvas.width; gx += 28) {
        for (let gy = 24; gy < canvas.height; gy += 28) {
          ctx.fillRect(gx, gy, 1.5, 1.5);
        }
      }

      const all = previewStroke ? [...strokes, previewStroke] : strokes;
      for (const s of all) {
        let pts: Array<{ x: number; y: number }> = [];
        try {
          pts = JSON.parse(s.pointsJson);
        } catch {
          pts = [];
        }
        if (pts.length === 0) continue;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = s.tool === 'eraser' ? '#ffffff' : s.color;
        ctx.fillStyle = s.color;
        ctx.globalAlpha = s.tool === 'highlighter' ? 0.35 : 1;
        ctx.lineWidth = s.tool === 'highlighter' ? s.width * 4 : s.width;

        if (s.tool === 'text' && s.textContent) {
          ctx.font = `600 ${Math.max(16, s.width * 5)}px "DM Sans", sans-serif`;
          ctx.fillText(s.textContent, pts[0].x, pts[0].y);
        } else if (s.tool === 'line' && pts.length >= 2) {
          const start = pts[0];
          const end = pts[pts.length - 1];
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        } else if (s.tool === 'rect' && pts.length >= 2) {
          const start = pts[0];
          const end = pts[pts.length - 1];
          ctx.strokeRect(
            start.x,
            start.y,
            end.x - start.x,
            end.y - start.y
          );
        } else if (s.tool === 'circle' && pts.length >= 2) {
          const start = pts[0];
          const end = pts[pts.length - 1];
          const rx = Math.hypot(end.x - start.x, end.y - start.y);
          ctx.beginPath();
          ctx.arc(start.x, start.y, rx, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
    },
    [strokes]
  );

  useEffect(() => {
    if (activeTab === 'whiteboard') {
      redrawCanvas();
    }
  }, [activeTab, redrawCanvas]);

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    const pos = getPointerPos(e);
    if (tool === 'text') {
      setPendingTextPos(pos);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentPointsRef.current = [pos];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !canDraw) return;
    const pos = getPointerPos(e);
    currentPointsRef.current.push(pos);
    redrawCanvas({
      strokeId: 'preview',
      authorUid: myUid,
      tool,
      color,
      width: lineWidth,
      pointsJson: JSON.stringify(currentPointsRef.current),
    });
  };

  const handlePointerUp = () => {
    if (!drawingRef.current || !canDraw) return;
    drawingRef.current = false;
    if (currentPointsRef.current.length > 0) {
      onEmitStroke({
        strokeId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        authorUid: myUid,
        tool,
        color,
        width: lineWidth,
        pointsJson: JSON.stringify(currentPointsRef.current),
      });
    }
    currentPointsRef.current = [];
  };

  const submitBoardText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingTextPos || !textInput.trim()) {
      setPendingTextPos(null);
      return;
    }
    onEmitStroke({
      strokeId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      authorUid: myUid,
      tool: 'text',
      color,
      width: lineWidth,
      pointsJson: JSON.stringify([pendingTextPos]),
      textContent: textInput.trim(),
    });
    setTextInput('');
    setPendingTextPos(null);
  };

  const exportBoardPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${meetingCode}-whiteboard.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleMaterialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMaterial(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', file.name);
      form.append('uploaderName', myName);
      const res = await fetch(`/api/meetings/${meetingCode}/materials`, {
        method: 'POST',
        body: form,
      });
      if (res.ok) {
        const data = (await res.json()) as { material: TeachingMaterialItem };
        onMaterialUploaded(data.material);
      }
    } finally {
      setUploadingMaterial(false);
      e.target.value = '';
    }
  };

  const submitPoll = (e: React.FormEvent) => {
    e.preventDefault();
    const validOpts = pollOptions.filter((o) => o.text.trim().length > 0);
    if (!pollQuestion.trim() || validOpts.length < 2) return;
    onCreatePoll({
      question: pollQuestion.trim(),
      isQuiz: pollIsQuiz,
      options: validOpts,
    });
    setPollQuestion('');
    setPollOptions([
      { id: 'opt1', text: '', isCorrect: true },
      { id: 'opt2', text: '', isCorrect: false },
    ]);
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 overflow-hidden">
      {/* Classroom Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 bg-slate-950/60">
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: 'whiteboard', label: 'Whiteboard', icon: Pen },
              { id: 'materials', label: `Slides & PDFs (${materials.length})`, icon: FileText },
              { id: 'polls', label: `Polls & Quizzes (${polls.length})`, icon: BarChart3 },
              { id: 'qa', label: `Q&A (${questions.length})`, icon: HelpCircle },
              { id: 'attendance', label: `Attendance (${attendance.length})`, icon: Users },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Whiteboard Tab */}
      {activeTab === 'whiteboard' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'pen', icon: Pen, label: 'Pen' },
                  { id: 'highlighter', icon: Pen, label: 'Highlight' },
                  { id: 'line', icon: Minus, label: 'Line' },
                  { id: 'rect', icon: Square, label: 'Rect' },
                  { id: 'circle', icon: Circle, label: 'Circle' },
                  { id: 'text', icon: Type, label: 'Text' },
                  { id: 'eraser', icon: Eraser, label: 'Eraser' },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!canDraw}
                    onClick={() => setTool(t.id)}
                    title={t.label}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer disabled:opacity-40 ${
                      tool === t.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                );
              })}

              <div className="mx-1 h-5 w-px bg-slate-700" />
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={!canDraw}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={`h-5 w-5 rounded-full border-2 cursor-pointer ${
                    color === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}

              <select
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                disabled={!canDraw}
                className="ml-1 rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200"
              >
                <option value={2}>Thin</option>
                <option value={4}>Medium</option>
                <option value={7}>Bold</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              {strokes.some((s) => s.authorUid === myUid) && canDraw && (
                <button
                  type="button"
                  onClick={() => {
                    const myLast = [...strokes]
                      .reverse()
                      .find((s) => s.authorUid === myUid);
                    if (myLast) onUndoStroke(myLast.strokeId);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs hover:bg-slate-700 cursor-pointer"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  <span>Undo</span>
                </button>
              )}
              <button
                type="button"
                onClick={exportBoardPng}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs hover:bg-slate-700 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>PNG</span>
              </button>
              {isTeacher && (
                <>
                  <button
                    type="button"
                    onClick={() => onToggleBoardLock(!whiteboardLocked)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
                      whiteboardLocked
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {whiteboardLocked ? (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        <span>Students Locked</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="h-3.5 w-3.5" />
                        <span>Students Can Draw</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onClearBoard}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-600/80 px-2.5 py-1.5 text-xs text-white hover:bg-red-600 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="relative flex-1 bg-slate-950 p-2 flex items-center justify-center overflow-auto">
            {!canDraw && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-lg bg-slate-900/90 border border-slate-700 px-3 py-1.5 text-xs text-amber-300">
                View-only mode · Teacher controls whiteboard drawing
              </div>
            )}
            <canvas
              ref={canvasRef}
              width={1200}
              height={720}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="max-h-full max-w-full rounded-xl shadow-inner touch-none cursor-crosshair bg-white"
            />
            {pendingTextPos && (
              <form
                onSubmit={submitBoardText}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl"
              >
                <input
                  type="text"
                  autoFocus
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type annotation text..."
                  className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs text-white border border-slate-700 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Place
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Teaching Materials Tab */}
      {activeTab === 'materials' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold">
                Teaching Materials (PDF, PPT, Images)
              </h3>
              <p className="text-xs text-slate-400">
                Files uploaded here become immediately available to everyone in the class.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              <span>{uploadingMaterial ? 'Uploading...' : 'Upload Material'}</span>
              <input
                type="file"
                accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
                onChange={handleMaterialUpload}
                className="hidden"
              />
            </label>
          </div>

          {previewMaterial && (
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">{previewMaterial.title}</span>
                <button
                  type="button"
                  onClick={() => setPreviewMaterial(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
              {previewMaterial.mimeType.startsWith('image/') ? (
                <img
                  src={previewMaterial.fileUrl}
                  alt={previewMaterial.title}
                  className="max-h-96 mx-auto rounded-lg object-contain"
                />
              ) : previewMaterial.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewMaterial.fileUrl}
                  title={previewMaterial.title}
                  className="h-96 w-full rounded-lg bg-white"
                />
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Preview unavailable for PowerPoint files in browser. Use Download below.
                </p>
              )}
            </div>
          )}

          {materials.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              No PDFs, slides, or images uploaded yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {materials.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {m.title}
                    </p>
                    <p className="text-xs text-slate-400 tabular-nums">
                      {m.uploaderName} · {(m.fileSizeBytes / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(m.mimeType.startsWith('image/') ||
                      m.mimeType === 'application/pdf') && (
                      <button
                        type="button"
                        onClick={() => setPreviewMaterial(m)}
                        className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-700 cursor-pointer"
                      >
                        View
                      </button>
                    )}
                    <a
                      href={m.fileUrl}
                      download={m.title}
                      className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Polls & Quizzes Tab */}
      {activeTab === 'polls' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isTeacher && (
            <form
              onSubmit={submitPoll}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold">
                  Create Live Poll or Quiz
                </h3>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pollIsQuiz}
                    onChange={(e) => setPollIsQuiz(e.target.checked)}
                    className="accent-blue-600"
                  />
                  <span>Graded Quiz Mode</span>
                </label>
              </div>
              <input
                type="text"
                required
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Ask a question..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              />
              <div className="space-y-2">
                {pollOptions.map((opt, idx) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      value={opt.text}
                      onChange={(e) =>
                        setPollOptions((prev) =>
                          prev.map((o, i) =>
                            i === idx ? { ...o, text: e.target.value } : o
                          )
                        )
                      }
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                    />
                    {pollIsQuiz && (
                      <label className="flex items-center gap-1 text-xs text-emerald-400">
                        <input
                          type="radio"
                          name="correctOpt"
                          checked={opt.isCorrect}
                          onChange={() =>
                            setPollOptions((prev) =>
                              prev.map((o, i) => ({ ...o, isCorrect: i === idx }))
                            )
                          }
                        />
                        <span>Correct</span>
                      </label>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setPollOptions((prev) => [
                      ...prev,
                      {
                        id: `opt${prev.length + 1}`,
                        text: '',
                        isCorrect: false,
                      },
                    ])
                  }
                  className="text-xs text-blue-400 hover:underline cursor-pointer"
                >
                  + Add Option
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                >
                  Launch {pollIsQuiz ? 'Quiz' : 'Poll'}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {polls.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                No polls or quizzes launched yet.
              </p>
            ) : (
              polls.map((poll) => {
                const totalVotes = poll.votes.length;
                const myVote = poll.votes.find((v) => v.voterUid === myUid);
                return (
                  <div
                    key={poll.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-blue-400">
                          {poll.isQuiz ? 'Quiz' : 'Poll'} ·{' '}
                          {poll.isActive ? 'Open' : 'Closed'} ·{' '}
                          <span className="tabular-nums">{totalVotes} votes</span>
                        </p>
                        <h4 className="font-display text-sm font-bold text-white">
                          {poll.question}
                        </h4>
                      </div>
                      {isTeacher && poll.isActive && (
                        <button
                          type="button"
                          onClick={() => onClosePoll(poll.id)}
                          className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs hover:bg-slate-800 cursor-pointer"
                        >
                          Close
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {poll.options.map((opt) => {
                        const count = poll.votes.filter(
                          (v) => v.optionId === opt.id
                        ).length;
                        const pct =
                          totalVotes > 0
                            ? Math.round((count / totalVotes) * 100)
                            : 0;
                        const selected = myVote?.optionId === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={!poll.isActive}
                            onClick={() => onVotePoll(poll.id, opt.id)}
                            className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-xs transition-colors cursor-pointer disabled:cursor-default ${
                              selected
                                ? 'border-blue-500 bg-blue-950/50'
                                : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                            }`}
                          >
                            <div
                              className="absolute inset-y-0 left-0 bg-blue-600/20"
                              style={{ width: `${pct}%` }}
                            />
                            <div className="relative flex items-center justify-between gap-2">
                              <span className="font-medium text-white flex items-center gap-1.5">
                                {opt.text}
                                {poll.isQuiz && !poll.isActive && opt.isCorrect && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                )}
                              </span>
                              <span className="tabular-nums font-mono text-slate-300">
                                {pct}% ({count})
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Q&A Session Tab */}
      {activeTab === 'qa' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newQuestion.trim()) return;
              onAskQuestion(newQuestion.trim());
              setNewQuestion('');
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Ask a question for the speaker or teacher..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-blue-600 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              Submit Question
            </button>
          </form>

          <div className="space-y-3">
            {questions.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                No questions submitted yet.
              </p>
            ) : (
              questions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-400">
                        {q.authorName} ·{' '}
                        {new Date(q.createdAt).toLocaleTimeString()}
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        {q.question}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpvoteQuestion(q.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs tabular-nums hover:bg-slate-800 cursor-pointer"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span>{q.upvotes}</span>
                    </button>
                  </div>

                  {q.isAnswered && q.answer ? (
                    <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/50 p-2.5 text-xs text-emerald-200">
                      <span className="font-semibold">
                        Answer ({q.answeredBy}):{' '}
                      </span>
                      {q.answer}
                    </div>
                  ) : (
                    isTeacher && (
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={answerDrafts[q.id] || ''}
                          onChange={(e) =>
                            setAnswerDrafts((prev) => ({
                              ...prev,
                              [q.id]: e.target.value,
                            }))
                          }
                          placeholder="Write answer..."
                          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const ans = (answerDrafts[q.id] || '').trim();
                            if (!ans) return;
                            onAnswerQuestion(q.id, ans);
                            setAnswerDrafts((prev) => ({ ...prev, [q.id]: '' }));
                          }}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                        >
                          Reply
                        </button>
                      </div>
                    )
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="py-2 pr-3">Participant</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Joined At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 tabular-nums">
              {attendance.map((a) => (
                <tr key={a.id}>
                  <td className="py-2.5 pr-3 font-medium text-white">
                    {a.displayName}
                  </td>
                  <td className="py-2.5 pr-3 capitalize text-slate-300">
                    {a.role}
                  </td>
                  <td className="py-2.5 pr-3 capitalize text-slate-300">
                    {a.status}
                  </td>
                  <td className="py-2.5 text-right text-slate-400">
                    {new Date(a.joinedAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

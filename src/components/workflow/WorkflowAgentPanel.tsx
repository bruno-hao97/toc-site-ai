import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  ChevronRight,
  Clock,
  MessageCircle,
  MessageSquarePlus,
  Send,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import type { Edge, Node } from '@xyflow/react';
import WorkflowAgentChatSettingsModal from './WorkflowAgentChatSettingsModal';
import WorkflowAgentSettingsModal from './WorkflowAgentSettingsModal';
import {
  getActiveSession,
  loadAgentState,
  makeSession,
  resolveAgentChatModel,
  saveAgentState,
  type AgentMessage,
  type AgentState,
} from '../../services/workflowAgentStore';
import { askGommo, isGommoChatConfigured, type ChatTurn } from '../../services/gommoChat';
import {
  applyWorkflowActions,
  buildWorkflowSnapshot,
  parseAgentActions,
} from '../../services/workflowAgentActions';
import { formatAgentDisplayContent } from '../../services/agentDisplayContent';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabName: string;
  nodes: Node[];
  edges: Edge[];
  onApplyGraph: (nodes: Node[], edges: Edge[], opts?: { focusView?: boolean }) => void;
}

function countInteractions(messages: AgentMessage[]): number {
  return messages.filter((m) => m.role === 'user').length;
}

export default function WorkflowAgentPanel({
  open,
  onOpenChange,
  tabName,
  nodes,
  edges,
  onApplyGraph,
}: Props) {
  const [state, setState] = useState<AgentState>(() => loadAgentState());
  const [input, setInput] = useState('');
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [directSettingsOpen, setDirectSettingsOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const session = getActiveSession(state);
  const interactions = countInteractions(session.messages);

  useEffect(() => {
    saveAgentState(state);
  }, [state]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [session.messages, thinking]);

  const persist = (next: AgentState) => setState(next);

  const patchAssistant = (
    sessionId: string,
    msgId: string,
    patch: Partial<AgentMessage>,
  ) => {
    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
            }
          : s,
      ),
    }));
  };

  const newSession = () => {
    const s = makeSession();
    persist({
      ...state,
      sessions: [s, ...state.sessions],
      activeSessionId: s.id,
    });
    setHistoryOpen(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;

    if (!isGommoChatConfigured()) {
      window.alert('Bạn cần đăng nhập (Access Token Gommo) để chat với Agent.');
      return;
    }

    setInput('');

    const now = Date.now();
    const userMsg: AgentMessage = {
      id: `msg_${now}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    const assistantMsg: AgentMessage = {
      id: `msg_${now}_a`,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    const history: ChatTurn[] = session.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      text: m.content,
    }));
    const firstTurn = interactions === 0;
    const snapshot = buildWorkflowSnapshot(tabName, nodes, edges);

    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === session.id ? { ...s, messages: [...s.messages, userMsg, assistantMsg] } : s,
      ),
    }));
    setThinking(true);

    let acc = '';
    const chatModel = resolveAgentChatModel(state.chatModelId);
    try {
      await askGommo(text, {
        history,
        firstTurn,
        sessionId: session.id,
        workflowSnapshot: snapshot,
        config: { model: chatModel.model, server: chatModel.server },
        onDelta: (chunk) => {
          acc += chunk;
          patchAssistant(session.id, assistantMsg.id, { content: acc });
        },
      });

      if (!acc.trim()) {
        patchAssistant(session.id, assistantMsg.id, {
          content: '(Agent không trả về nội dung.)',
        });
        return;
      }

      const actions = parseAgentActions(acc, text, nodes);
      let actionsApplied = false;
      let appliedCount: number | undefined;

      if (state.autoMode && actions.length > 0) {
        const result = applyWorkflowActions(actions, nodes, edges);
        onApplyGraph(result.nodes, result.edges, { focusView: result.focusView });
        actionsApplied = result.applied.length > 0;
        appliedCount = result.applied.length;
      }

      patchAssistant(session.id, assistantMsg.id, {
        content: acc,
        actions: actions.length ? actions : undefined,
        actionsApplied,
        appliedCount,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patchAssistant(session.id, assistantMsg.id, { content: `⚠️ Lỗi: ${msg}` });
    } finally {
      setThinking(false);
    }
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part.split('\n').map((line, j, arr) => (
        <span key={`${i}-${j}`}>
          {line}
          {j < arr.length - 1 && <br />}
        </span>
      ));
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        className="wf-agent-fab"
        onClick={() => onOpenChange(true)}
        title="Mở Workflow Agent"
      >
        <MessageCircle size={22} />
      </button>
    );
  }

  return (
    <>
      <aside className="wf-agent-panel">
        <div className="wf-agent-head">
          <div className="wf-agent-head-left">
            <span className="wf-agent-logo">
              <Bot size={18} />
            </span>
            <div>
              <div className="wf-agent-title">Moon Agent</div>
              <div className="wf-agent-meta">
                {tabName} · {nodes.length} nodes · {edges.length} connections · 0 groups
              </div>
            </div>
          </div>
          <div className="wf-agent-head-actions">
            <button
              type="button"
              className="wf-agent-head-btn icon-only"
              onClick={newSession}
              title="Phiên mới"
            >
              <MessageSquarePlus size={16} />
            </button>
            <button
              type="button"
              className={`wf-agent-head-btn icon-only${historyOpen ? ' active' : ''}`}
              onClick={() => setHistoryOpen((v) => !v)}
              title="Lịch sử"
            >
              <Clock size={16} />
            </button>
            <button
              type="button"
              className="wf-agent-head-btn icon-only"
              onClick={() => setChatSettingsOpen(true)}
              title="Cài đặt model chat"
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              type="button"
              className="wf-agent-head-btn icon-only"
              onClick={() => onOpenChange(false)}
              title="Đóng"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {historyOpen && (
          <div className="wf-agent-history">
            {state.sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.id === session.id ? 'active' : ''}
                onClick={() => {
                  persist({ ...state, activeSessionId: s.id });
                  setHistoryOpen(false);
                }}
              >
                {s.name}
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        )}

        <div className="wf-agent-messages" ref={listRef}>
          {session.messages.map((m) => {
            const isEmptyStreaming = m.role === 'assistant' && !m.content;
            const displayText =
              m.role === 'assistant' && m.content
                ? formatAgentDisplayContent(m.content)
                : m.content;
            const showBubble =
              isEmptyStreaming || (displayText.trim().length > 0 && !displayText.startsWith('('));
            return (
              <div key={m.id} className={`wf-agent-msg wf-agent-msg--${m.role}`}>
                {m.role === 'assistant' && (
                  <span className="wf-agent-msg-avatar">
                    <Bot size={14} />
                  </span>
                )}
                <div className="wf-agent-msg-body">
                  {showBubble && (
                    <div
                      className={`wf-agent-bubble${isEmptyStreaming ? ' wf-agent-bubble--typing' : ''}`}
                    >
                      {isEmptyStreaming ? 'Đang suy nghĩ…' : renderContent(displayText)}
                    </div>
                  )}
                  {m.actions && m.actions.length > 0 && (
                    <div className="wf-agent-actions">
                      <div className="wf-agent-actions-title">Action dự kiến</div>
                      <ul>
                        {m.actions.map((a, i) => (
                          <li key={i}>{a.label}</li>
                        ))}
                      </ul>
                      {m.actionsApplied && (
                        <div className="wf-agent-applied">
                          Đã áp dụng {m.appliedCount ?? m.actions.length} action vào template hiện
                          tại
                        </div>
                      )}
                      {!m.actionsApplied && state.autoMode && (
                        <div className="wf-agent-applied muted">Không có action nào được apply</div>
                      )}
                      {!state.autoMode && !m.actionsApplied && (
                        <button
                          type="button"
                          className="wf-agent-apply-btn"
                          onClick={() => {
                            const result = applyWorkflowActions(m.actions!, nodes, edges);
                            onApplyGraph(result.nodes, result.edges, { focusView: result.focusView });
                            patchAssistant(session.id, m.id, {
                              actionsApplied: true,
                              appliedCount: result.applied.length,
                            });
                          }}
                        >
                          Áp dụng lên canvas
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="wf-agent-compose">
          <p className="wf-agent-scope">
            Workflow Agent đang chỉnh sửa scope template hiện tại
          </p>
          <textarea
            className="wf-agent-input"
            rows={3}
            placeholder="Mô tả workflow bạn muốn Agent tạo, sửa hoặc tối ưu…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="wf-agent-compose-bar">
            <button
              type="button"
              className="wf-agent-icon-btn"
              onClick={() => setDirectSettingsOpen(true)}
              title="Cài đặt tạo trực tiếp"
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              type="button"
              className={`wf-agent-auto${state.autoMode ? ' on' : ''}`}
              onClick={() => persist({ ...state, autoMode: !state.autoMode })}
            >
              <Sparkles size={14} />
              Auto: {state.autoMode ? 'Bật' : 'Tắt'}
            </button>
            <button
              type="button"
              className="wf-agent-send"
              onClick={() => void send()}
              disabled={!input.trim() || thinking}
              title="Gửi"
            >
              <Send size={16} />
              Gửi
            </button>
          </div>
        </div>
      </aside>

      <WorkflowAgentChatSettingsModal
        open={chatSettingsOpen}
        modelId={state.chatModelId}
        onSave={(chatModelId) => persist({ ...state, chatModelId })}
        onClose={() => setChatSettingsOpen(false)}
      />

      <WorkflowAgentSettingsModal
        open={directSettingsOpen}
        settings={state.directCreate}
        onSave={(directCreate) => persist({ ...state, directCreate })}
        onClose={() => setDirectSettingsOpen(false)}
      />
    </>
  );
}

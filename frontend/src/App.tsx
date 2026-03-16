import { useState, useRef, useEffect } from 'react';

const API_KEY_STORAGE = 'vertical-agent-api-key';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
};

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? '');
  const [task, setTask] = useState('');
  const [leadJson, setLeadJson] = useState('{}');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveKey = (key: string) => {
    setApiKey(key);
    if (key) localStorage.setItem(API_KEY_STORAGE, key);
    else localStorage.removeItem(API_KEY_STORAGE);
  };

  const send = async () => {
    const trimmed = task.trim();
    if (!trimmed) return;
    if (!apiKey.trim()) {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: 'Please set your API key in the header.', error: true }]);
      return;
    }

    let leadData: unknown = {};
    try {
      leadData = leadJson.trim() ? JSON.parse(leadJson) : {};
    } catch {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: 'Invalid JSON in lead data.', error: true }]);
      return;
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    setMessages((m) => [...m, userMsg]);
    setTask('');
    setLoading(true);

    const assistantId = crypto.randomUUID();
    setMessages((m) => [...m, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/v1/analyze/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
        },
        body: JSON.stringify({ task: trimmed, leadData }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId ? { ...msg, content: data?.error || `Error ${res.status}`, error: true } : msg
          )
        );
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        setMessages((m) =>
          m.map((msg) => (msg.id === assistantId ? { ...msg, content: 'No response body.', error: true } : msg))
        );
        return;
      }

      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = (acc + decoder.decode(value, { stream: true })).split('\n');
        acc = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.chunk) {
              setMessages((m) =>
                m.map((msg) => (msg.id === assistantId ? { ...msg, content: msg.content + data.chunk } : msg))
              );
            }
            if (data.error) {
              setMessages((m) =>
                m.map((msg) => (msg.id === assistantId ? { ...msg, content: data.error, error: true } : msg))
              );
            }
          } catch {
            /* skip malformed line */
          }
        }
      }
      if (acc.trim()) {
        try {
          const data = JSON.parse(acc);
          if (data.chunk) {
            setMessages((m) =>
              m.map((msg) => (msg.id === assistantId ? { ...msg, content: msg.content + data.chunk } : msg))
            );
          }
          if (data.done && data.result) {
            setMessages((m) =>
              m.map((msg) => (msg.id === assistantId ? { ...msg, content: data.result } : msg))
            );
          }
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: `Request failed. Is the backend running on port 3000? ${err instanceof Error ? err.message : ''}`, error: true }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header style={headerStyle}>
        <h1 style={titleStyle}>Vertical Agent</h1>
        <input
          type="password"
          placeholder="API key"
          value={apiKey}
          onChange={(e) => saveKey(e.target.value)}
          style={inputKeyStyle}
        />
      </header>

      <main style={mainStyle}>
        {messages.length === 0 && (
          <div style={emptyStyle}>
            <p>Ask for lead analysis or a summary. Use the knowledge base by setting a task and optional lead data (JSON).</p>
          </div>
        )}
        {messages.map((msg) => {
          const isStreamingEmpty = loading && msg.role === 'assistant' && !msg.content && messages[messages.length - 1]?.id === msg.id;
          return (
            <div key={msg.id} style={msg.role === 'user' ? userBubbleStyle : assistantBubbleStyle(!!msg.error)}>
              {isStreamingEmpty ? '…' : msg.content}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      <footer style={footerStyle}>
        <textarea
          placeholder="Task (e.g. Summarize and score this lead)"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          rows={2}
          style={textareaStyle}
        />
        <textarea
          placeholder='Optional lead data (JSON): { "url": "...", "Business Name": "..." }'
          value={leadJson}
          onChange={(e) => setLeadJson(e.target.value)}
          rows={2}
          style={leadTextareaStyle}
        />
        <button onClick={send} disabled={loading} style={buttonStyle}>
          Send
        </button>
      </footer>
    </>
  );
}

const headerStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  background: 'var(--bg-elevated)',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.1rem',
  fontWeight: 600,
};

const inputKeyStyle: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '8px 12px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  width: '220px',
  fontFamily: 'var(--font)',
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  maxWidth: '720px',
  margin: '0 auto',
  width: '100%',
};

const emptyStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  textAlign: 'center',
  padding: '48px 24px',
};

const userBubbleStyle: React.CSSProperties = {
  alignSelf: 'flex-end',
  maxWidth: '85%',
  padding: '12px 16px',
  borderRadius: 'var(--radius)',
  background: 'var(--user-bubble)',
  border: '1px solid var(--border)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

function assistantBubbleStyle(error: boolean): React.CSSProperties {
  return {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    padding: '12px 16px',
    borderRadius: 'var(--radius)',
    background: error ? 'rgba(201, 74, 74, 0.15)' : 'var(--assistant-bubble)',
    border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };
}

const footerStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderTop: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxWidth: '720px',
  margin: '0 auto',
  width: '100%',
};

const textareaStyle: React.CSSProperties = {
  padding: '12px 16px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  fontFamily: 'var(--font)',
  fontSize: '0.95rem',
  resize: 'vertical',
  minHeight: '56px',
};

const leadTextareaStyle: React.CSSProperties = {
  ...textareaStyle,
  fontSize: '0.85rem',
  minHeight: '48px',
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: 'var(--accent)',
  color: 'var(--bg)',
  border: 'none',
  borderRadius: 'var(--radius)',
  fontFamily: 'var(--font)',
  fontWeight: 600,
  cursor: 'pointer',
  alignSelf: 'flex-end',
};

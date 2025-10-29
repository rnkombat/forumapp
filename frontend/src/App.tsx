import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Topic, Post } from "./types";
import { getTopics, getPosts, createTopic, createPost, deletePost } from "./api";

function TopicsPane({
  topics, activeId, onCreate,
}: { topics: Topic[]; activeId?: number; onCreate: () => void; }) {
  return (
    <section className="panel">
      <h2>Topics</h2>
      <button className="btn-primary" onClick={onCreate}>+ New Topic</button>
      <ul className="list">
        {topics.map((t) => (
          <li key={t.id} className={`topicItem ${activeId === t.id ? "active" : ""}`}>
            <Link to={`/topics/${t.id}`}>
              <div className="title">{t.title}</div>
              <div className="summary">{t.summary ?? "—"}</div>
              <div className="count">posts: {t.posts_count}</div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PostsPane({
  topic, limit, offset, setLimit, setOffset,
}: {
  topic: Topic | null; limit: number; offset: number;
  setLimit: (n: number) => void; setOffset: (n: number) => void;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [newBody, setNewBody] = useState("");
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  useEffect(() => {
    if (!topic) return;
    setLoading(true);
    (async () => {
      const data = await getPosts(topic.id, limit, offset);
      setPosts(data.items);
      setTotal(data.total);
      setLoading(false);
    })();
  }, [topic?.id, limit, offset]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  const syncQuery = (next: {limit?: number; offset?: number}) => {
    const q = new URLSearchParams(sp);
    if (next.limit !== undefined) q.set("limit", String(next.limit));
    if (next.offset !== undefined) q.set("offset", String(next.offset));
    navigate({ search: `?${q.toString()}` }, { replace: true });
  };

  const prevPage = () => { if (canPrev) { setOffset(offset - limit); syncQuery({ offset: offset - limit }); } };
  const nextPage = () => { if (canNext) { setOffset(offset + limit); syncQuery({ offset: offset + limit }); } };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;
    const text = newBody.trim();
    if (!text) return;
    await createPost(topic.id, text);
    setNewBody("");
    const data = await getPosts(topic.id, limit, offset);
    setPosts(data.items);
    setTotal(data.total);
  };

  const handleDeletePost = async (p: Post) => {
    if (!window.confirm(`Delete post #${p.id}?`)) return;
    await deletePost(p.topic_id, p.id);
    const data = await getPosts(p.topic_id, limit, offset);
    setPosts(data.items);
    setTotal(data.total);
  };

  return (
    <section className="panel">
      <h2>Posts {topic ? `in #${topic.id}` : ""}</h2>
      {!topic ? (
        <p>Select a topic</p>
      ) : (
        <>
          <form onSubmit={handleCreatePost} className="formRow">
            <input
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Write a post..."
              className="input"
            />
            <button type="submit" className="btn-primary">Post</button>
          </form>

          <div className="toolbar">
            <button onClick={prevPage} disabled={!canPrev}>Prev</button>
            <span>Page {currentPage} / {totalPages} (total {total})</span>
            <button onClick={nextPage} disabled={!canNext}>Next</button>
            <select
              value={limit}
              onChange={(e) => {
                const n = Number(e.target.value);
                setLimit(n); setOffset(0); syncQuery({ limit: n, offset: 0 });
              }}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n}/page</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p>Loading posts...</p>
          ) : posts.length === 0 ? (
            <p>No posts yet.</p>
          ) : (
            <ul className="list">
              {posts.map((p) => (
                <li key={p.id} className="postItem">
                  <div className="meta">#{p.id} • topic:{p.topic_id}</div>
                  <div style={{ marginTop: 4 }}>{p.body}</div>
                  <div className="time">
                    {new Date(p.created_at).toLocaleString()}
                  </div>
                  <div className="actions">
                    <button className="btn-danger" onClick={() => handleDeletePost(p)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Root() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [sp] = useSearchParams();
  const { id } = useParams(); // /topics/:id
  const activeId = id ? Number(id) : undefined;

  useEffect(() => {
    (async () => {
      try {
        const data = await getTopics();
        setTopics(data);
      } finally {
        setLoadingTopics(false);
      }
    })();
  }, []);

  const [limit, setLimit] = useState(() => Number(sp.get("limit") ?? 10));
  const [offset, setOffset] = useState(() => Number(sp.get("offset") ?? 0));

  const activeTopic = useMemo(
    () => topics.find(t => t.id === activeId) ?? null,
    [topics, activeId]
  );

  const handleCreateTopic = async () => {
    const title = window.prompt("New topic title?");
    if (!title || !title.trim()) return;
    const summaryRaw = window.prompt("Summary (optional)") ?? "";
    const summary = summaryRaw.trim() ? summaryRaw.trim() : null;
    const t = await createTopic(title.trim(), summary);
    setTopics((prev) => [t, ...prev]);
  };

  return (
    <div className="layout">
      <TopicsPane topics={topics} activeId={activeId} onCreate={handleCreateTopic} />
      <PostsPane topic={activeTopic} limit={limit} offset={offset} setLimit={setLimit} setOffset={setOffset} />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/topics">
        <Route index element={<Root />} />
        <Route path=":id" element={<Root />} />
      </Route>
      <Route path="*" element={<div className="panel" style={{ padding: 24 }}>Not Found</div>} />
    </Routes>
  );
}

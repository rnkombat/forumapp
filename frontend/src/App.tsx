import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";

import { createTopic, deleteTopic, getTopic, getTopics } from "./api";
import { PostsPane } from "./components/PostsPane";
import { TopicsPane } from "./components/TopicsPane";
import { usePaginationParams } from "./hooks/usePaginationParams";
import type { Topic } from "./types";

const DEFAULT_PAGINATION = { limit: 10, offset: 0 };

const parseTopicId = (id?: string) => {
	const numericId = Number(id);

	return Number.isFinite(numericId) ? numericId : undefined;
};

// トップページ: トピック一覧と新規作成のみを表示
const TopicsPage = () => {
	const [topics, setTopics] = useState<Topic[]>([]);
	const [loadingTopics, setLoadingTopics] = useState(true);
	const isMountedRef = useRef(true);

	const refreshTopics = useCallback(async () => {
		const data = await getTopics();

		if (!isMountedRef.current) {
			return;
		}

		setTopics(data);
	}, []);

	useEffect(() => {
		isMountedRef.current = true;

		const loadTopics = async () => {
			if (!isMountedRef.current) {
				return;
			}

			setLoadingTopics(true);

			try {
				await refreshTopics();
			} catch (error) {
				console.error("topics fetch failed", error);
				if (isMountedRef.current) {
					setTopics([]);
				}
			} finally {
				if (isMountedRef.current) {
					setLoadingTopics(false);
				}
			}
		};

		loadTopics();

		return () => {
			isMountedRef.current = false;
		};
	}, [refreshTopics]);

	const handleCreateTopic = useCallback(async () => {
		const rawTitle = window.prompt("新しいスレッドのタイトルは？");

		if (!rawTitle) {
			return;
		}

		const title = rawTitle.trim();

		if (!title) {
			return;
		}

		const rawSummary = window.prompt("概要（任意）") ?? "";
		const summary = rawSummary.trim() ? rawSummary.trim() : null;
		const created = await createTopic(title, summary);

		if (!isMountedRef.current) {
			return;
		}

		// 取得結果を先頭に差し込んで一覧を即時更新
		setTopics((previous) => [created, ...previous]);

		try {
			await refreshTopics();
		} catch (error) {
			console.error("topics refresh failed after create", error);
		}
	}, [refreshTopics]);

	const handleDeleteTopic = useCallback(
		async (topic: Topic) => {
			if (!window.confirm(`「${topic.title}」を削除しますか？`)) {
				return;
			}

			try {
				await deleteTopic(topic.id);

				if (!isMountedRef.current) {
					return;
				}

				setTopics((previous) => previous.filter((item) => item.id !== topic.id));
				await refreshTopics();
			} catch (error) {
				console.error("topic delete failed", error);
				window.alert("スレッドの削除に失敗しました。");
			}
		},
		[refreshTopics],
	);

	return (
		<div className="page">
			<TopicsPane
				topics={topics}
				activeId={undefined}
				onCreate={handleCreateTopic}
				onDelete={handleDeleteTopic}
				loading={loadingTopics}
			/>
		</div>
	);
};

// スレッドページ: 投稿一覧と操作を表示
const TopicDetailPage = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const topicId = parseTopicId(id);
	const [topic, setTopic] = useState<Topic | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const isMountedRef = useRef(true);
	const previousTopicIdRef = useRef<number | undefined>(undefined);
	const { limit, offset, setOffset } = usePaginationParams(DEFAULT_PAGINATION);

	const loadTopic = useCallback(async () => {
		if (!topicId) {
			if (isMountedRef.current) {
				setTopic(null);
				setError("無効なスレッドIDです。");
				setLoading(false);
			}
			return;
		}

		if (isMountedRef.current) {
			setLoading(true);
			setError(null);
		}

		try {
			const data = await getTopic(topicId);

			if (!isMountedRef.current) {
				return;
			}

			setTopic(data);
		} catch (err) {
			console.error("topic fetch failed", err);

			if (isMountedRef.current) {
				const fallback = err instanceof Error ? err.message : "スレッドの取得に失敗しました。";
				const message = fallback === "Not Found" ? "スレッドが見つかりません。" : fallback;
				setError(message);
				setTopic(null);
			}
		} finally {
			if (isMountedRef.current) {
				setLoading(false);
			}
		}
	}, [topicId]);

	useEffect(() => {
		isMountedRef.current = true;
		loadTopic();

		return () => {
			isMountedRef.current = false;
		};
	}, [loadTopic]);

	useEffect(() => {
		if (previousTopicIdRef.current === topicId) {
			return;
		}

		previousTopicIdRef.current = topicId ?? undefined;

		if (offset !== 0) {
			setOffset(0);
		}
	}, [topicId, offset, setOffset]);

	const handleDeleteTopic = useCallback(async () => {
		if (!topicId || !topic) {
			return;
		}

		if (!window.confirm(`「${topic.title}」を削除しますか？`)) {
			return;
		}

		try {
			await deleteTopic(topicId);
			window.alert("スレッドを削除しました。");
			navigate("/topics");
		} catch (err) {
			console.error("topic delete failed", err);
			window.alert("スレッドの削除に失敗しました。");
		}
	}, [navigate, topic, topicId]);

	return (
		<div className="page topicDetailPage">
			<div className="pageHeader">
				<Link className="backLink" to="/topics">← トピック一覧に戻る</Link>
				{topic ? (
					<button className="btn-danger" onClick={handleDeleteTopic}>スレッドを削除</button>
				) : null}
			</div>
			{loading ? (
				<section className="panel">
					<p>スレッドを読み込み中です…</p>
				</section>
			) : error ? (
				<section className="panel">
					<p>{error}</p>
				</section>
			) : !topic ? (
				<section className="panel">
					<p>スレッドが見つかりません。</p>
				</section>
			) : (
				<PostsPane
					topic={topic}
					limit={limit}
					offset={offset}
					onOffsetChange={setOffset}
					onTopicRefresh={loadTopic}
				/>
			)}
		</div>
	);
};

export default function App() {
	return (
		<Routes>
			<Route path="/" element={<TopicsPage />} />
			<Route path="/topics">
				<Route index element={<TopicsPage />} />
				<Route path=":id" element={<TopicDetailPage />} />
			</Route>
			<Route
				path="*"
				element={
					<div className="page">
						<section className="panel" style={{ padding: 24 }}>Not Found</section>
					</div>
				}
			/>
		</Routes>
	);
}

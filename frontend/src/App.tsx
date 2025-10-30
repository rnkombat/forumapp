import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";

import { createTopic, deleteTopic, getTopics } from "./api";
import { PostsPane } from "./components/PostsPane";
import { TopicsPane } from "./components/TopicsPane";
import { usePaginationParams } from "./hooks/usePaginationParams";
import type { Topic } from "./types";

const DEFAULT_PAGINATION = { limit: 10, offset: 0 };

const parseActiveId = (id?: string) => {
	const numericId = Number(id);

	return Number.isFinite(numericId) ? numericId : undefined;
};

const Root = () => {
	const [topics, setTopics] = useState<Topic[]>([]);
	const [loadingTopics, setLoadingTopics] = useState(true);
	const isMountedRef = useRef(true);
	const navigate = useNavigate();
	const { id } = useParams();
	const activeId = parseActiveId(id);
	const { limit, offset, setOffset } = usePaginationParams(DEFAULT_PAGINATION);

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

	const activeTopic = useMemo(() => {
	if (!activeId) {
	return null;
	}

	return topics.find((topic) => topic.id === activeId) ?? null;
	}, [activeId, topics]);

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

	// 取得結果を先頭に差し込んで一覧を即時更新
	setTopics((previous) => [created, ...previous]);
	}, []);

	const handleDeleteTopic = useCallback(
	async (topic: Topic) => {
	if (!window.confirm(`「${topic.title}」を削除しますか？`)) {
	return;
	}

	try {
	await deleteTopic(topic.id);
	setTopics((previous) => previous.filter((item) => item.id !== topic.id));

	if (activeId === topic.id) {
	navigate("/topics");
	setOffset(0);
	}

	await refreshTopics();
	} catch (error) {
	console.error("topic delete failed", error);
	window.alert("スレッドの削除に失敗しました。");
	}
	},
	[activeId, navigate, refreshTopics, setOffset],
	);

	return (
	<div className="layout">
	<TopicsPane
	topics={topics}
	activeId={activeId}
	onCreate={handleCreateTopic}
	onDelete={handleDeleteTopic}
	loading={loadingTopics}
	/>
	<PostsPane
	topic={activeTopic}
	limit={limit}
	offset={offset}
	onOffsetChange={setOffset}
	onTopicRefresh={refreshTopics}
	/>
	</div>
	);
};

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


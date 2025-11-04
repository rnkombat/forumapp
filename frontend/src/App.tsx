import { useCallback, useEffect, useMemo, useState } from "react";
import { Route, Routes, useParams } from "react-router-dom";

import { createTopic, getTopics } from "./api";
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
	const { id } = useParams();
	const activeId = parseActiveId(id);
	const { limit, offset, setLimit, setOffset } = usePaginationParams(DEFAULT_PAGINATION);

	useEffect(() => {
		let isMounted = true;

		const loadTopics = async () => {
			try {
				const data = await getTopics();

				if (!isMounted) {
					return;
				}

				setTopics(data);
			} finally {
				if (isMounted) {
				setLoadingTopics(false);
				}
			}
		};

		loadTopics();

		return () => {
			isMounted = false;
		};
	}, []);

	const activeTopic = useMemo(() => {
		if (!activeId) {
			return null;
		}

		return topics.find((topic) => topic.id === activeId) ?? null;
	}, [activeId, topics]);

	const handleCreateTopic = useCallback(async () => {
		const rawTitle = window.prompt("New topic title?");

		if (!rawTitle) {
			return;
		}

		const title = rawTitle.trim();

		if (!title) {
			return;
		}

		const rawSummary = window.prompt("Summary (optional)") ?? "";
		const summary = rawSummary.trim() ? rawSummary.trim() : null;
		const created = await createTopic(title, summary);

		setTopics((previous) => [created, ...previous]);
	}, []);

	return (
		<div className="layout">
			<TopicsPane topics={topics} activeId={activeId} onCreate={handleCreateTopic} loading={loadingTopics} />
			<PostsPane
				topic={activeTopic}
				limit={limit}
				offset={offset}
				onLimitChange={setLimit}
				onOffsetChange={setOffset}
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

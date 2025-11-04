import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { createPost, deletePost } from "../api";
import { usePosts } from "../hooks/usePosts";
import type { Post, Topic } from "../types";

const MAX_POSTS_PER_TOPIC = 50;
const MAX_BODY_LENGTH = 200;
const LIMIT_NOTICE_MESSAGE = "このスレッドは上限に達したので新しいスレッドを立ててください";

const ensurePositive = (value: number) => {
	return value > 0 ? value : 1;
};

const getNextOffset = (offset: number, limit: number, direction: "prev" | "next") => {
	if (direction === "prev") {
		return Math.max(0, offset - limit);
	}

	return offset + limit;
};

const renderPostBody = (post: Post) => {
	return (
		<>
			<div className="meta">#{post.id} • topic:{post.topic_id}</div>
			<div style={{ marginTop: 4 }}>{post.body}</div>
			<div className="time">{new Date(post.created_at).toLocaleString()}</div>
		</>
	);
};

type PostsPaneProps = {
	topic: Topic | null;
	limit: number;
	offset: number;
	onOffsetChange: (nextOffset: number) => void;
	onTopicRefresh: () => Promise<void>;
};

export const PostsPane = ({ topic, limit, offset, onOffsetChange, onTopicRefresh }: PostsPaneProps) => {
	const [newBody, setNewBody] = useState("");
	const [status, setStatus] = useState<{ kind: "error" | "info"; message: string } | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const topicId = topic?.id ?? null;
	const safeLimit = useMemo(() => ensurePositive(limit), [limit]);
	const { posts, total, loading, refresh } = usePosts(topicId, safeLimit, offset);
	const remaining = MAX_BODY_LENGTH - newBody.length;
	const isTooLong = remaining < 0;
	const reachedLimit = Boolean(topic && (topic.locked || total >= MAX_POSTS_PER_TOPIC));

	const totalPages = useMemo(() => Math.max(1, Math.ceil(total / safeLimit)), [total, safeLimit]);
	const currentPage = useMemo(() => {
	if (total === 0) {
	return 1;
	}

	return Math.min(totalPages, Math.floor(offset / safeLimit) + 1);
	}, [offset, safeLimit, total, totalPages]);
	const canPrev = useMemo(() => currentPage > 1, [currentPage]);
	const canNext = useMemo(() => currentPage < totalPages, [currentPage, totalPages]);

	useEffect(() => {
	if (!topicId) {
	if (offset !== 0) {
	onOffsetChange(0);
	}
	return;
	}

	if (total === 0 && offset !== 0) {
	onOffsetChange(0);
	return;
	}

	const maxOffset = Math.max(0, (totalPages - 1) * safeLimit);

	if (offset > maxOffset) {
	onOffsetChange(maxOffset);
	}
	}, [topicId, total, offset, onOffsetChange, totalPages, safeLimit]);

	useEffect(() => {
	// スレッド切り替え時にフォーム状態をリセットする
	setNewBody("");
	setStatus(null);
	}, [topicId]);

	const syncRefresh = useCallback(async () => {
	await refresh();
	}, [refresh]);

	const handlePrev = useCallback(() => {
	if (!canPrev) {
	return;
	}

	onOffsetChange(getNextOffset(offset, safeLimit, "prev"));
	}, [canPrev, offset, onOffsetChange, safeLimit]);

	const handleNext = useCallback(() => {
	if (!canNext) {
	return;
	}

	onOffsetChange(getNextOffset(offset, safeLimit, "next"));
	}, [canNext, offset, onOffsetChange, safeLimit]);

	const handleBodyChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
	setNewBody(event.target.value);
	if (status && status.kind === "error") {
	setStatus(null);
	}
	}, [status]);

	const handleCreatePost = useCallback(
	async (event: FormEvent) => {
	event.preventDefault();

	if (!topicId) {
	return;
	}

	const text = newBody.trim();

	if (!text) {
	return;
	}
	if (isTooLong) {
	setStatus({ kind: "error", message: `投稿は${MAX_BODY_LENGTH}文字以内で入力してください。` });
	return;
	}

	setSubmitting(true);

	try {
	await createPost(topicId, text);
	setNewBody("");
	setStatus({ kind: "info", message: "投稿しました。" });
	await syncRefresh();
	try {
	await onTopicRefresh();
	} catch (error) {
	console.error("topic refresh failed after post", error);
	}
	} catch (error) {
	const message = error instanceof Error ? error.message : "投稿に失敗しました。";
	setStatus({ kind: "error", message });
	} finally {
	setSubmitting(false);
	}
	},
	[newBody, isTooLong, onTopicRefresh, syncRefresh, topicId],
	);

	const handleDeletePost = useCallback(
	async (post: Post) => {
	if (!window.confirm(`Delete post #${post.id}?`)) {
	return;
	}

	try {
	await deletePost(post.topic_id, post.id);
	setStatus({ kind: "info", message: `投稿 #${post.id} を削除しました。` });
	await syncRefresh();
	try {
	await onTopicRefresh();
	} catch (error) {
	console.error("topic refresh failed after delete", error);
	}
	} catch (error) {
	const message = error instanceof Error ? error.message : "投稿の削除に失敗しました。";
	setStatus({ kind: "error", message });
	}
	},
	[onTopicRefresh, syncRefresh],
	);

	const disableForm = submitting || !topicId || reachedLimit;
	const showLimitNotice = reachedLimit;

	return (
		<section className="panel">
			<h2>Posts {topicId ? `in #${topicId}` : ""}</h2>

			{!topic ? (
				<p>Select a topic</p>
			) : (
				<>
					<div className="topicSummaryBox">
						<strong className="topicSummaryTitle">{topic.title}</strong>
						<p className={`topicSummaryText ${topic.summary ? "" : "muted"}`}>
							{topic.summary ?? "概要は登録されていません。"}
						</p>
					</div>
					{status ? (
						<div className={`statusMessage ${status.kind}`}>
							{status.message}
						</div>
					) : null}
					<form onSubmit={handleCreatePost} className="formColumn">
						<textarea
							value={newBody}
							onChange={handleBodyChange}
							placeholder="投稿内容を入力（200文字まで）"
							className={`input textInput ${isTooLong ? "error" : ""}`}
							rows={4}
							disabled={disableForm}
						/>
						<div className={`charCounter ${isTooLong ? "over" : ""}`}>
							{remaining >= 0 ? `残り ${remaining} 文字` : `上限を ${Math.abs(remaining)} 文字超過しています`}
						</div>
						<div className="formActions">
							<button type="submit" className="btn-primary" disabled={disableForm || !newBody.trim() || isTooLong}>
							Post
							</button>
						</div>
					</form>
					<div className="toolbar">
						<button onClick={handlePrev} disabled={!canPrev}>
						Prev
						</button>
						<span>Page {currentPage} / {totalPages} (total {total})</span>
						<button onClick={handleNext} disabled={!canNext}>
						Next
						</button>
						<span className="pageSizeHint">1ページ10件表示</span>
					</div>
					{showLimitNotice ? (
						<div className="limitNotice">{LIMIT_NOTICE_MESSAGE}</div>
					) : null}
					{loading ? (
						<p>Loading posts...</p>
					) : posts.length === 0 ? (
						<p>No posts yet.</p>
					) : (
						<ul className="list">
							{posts.map((post) => (
								<li key={post.id} className="postItem">
									{renderPostBody(post)}
									<div className="actions">
										<button className="btn-danger" onClick={() => handleDeletePost(post)}>
										Delete
										</button>
									</div>
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</section>
	);
};


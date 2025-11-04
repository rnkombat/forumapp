import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { createPost, deletePost } from "../api";
import { usePosts } from "../hooks/usePosts";
import type { Post, Topic } from "../types";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

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
	onLimitChange: (nextLimit: number) => void;
	onOffsetChange: (nextOffset: number) => void;
};

export const PostsPane = ({ topic, limit, offset, onLimitChange, onOffsetChange }: PostsPaneProps) => {
	const [newBody, setNewBody] = useState("");
	const topicId = topic?.id ?? null;
	const safeLimit = useMemo(() => ensurePositive(limit), [limit]);
	const { posts, total, loading, refresh } = usePosts(topicId, safeLimit, offset);

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

			await createPost(topicId, text);
			setNewBody("");
			await syncRefresh();
		},
		[newBody, syncRefresh, topicId]
	);

	const handleDeletePost = useCallback(
		async (post: Post) => {
			if (!window.confirm(`Delete post #${post.id}?`)) {
				return;
			}

			await deletePost(post.topic_id, post.id);
			await syncRefresh();
		},
		[syncRefresh]
	);

	const handleLimitChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const value = Number(event.target.value);

			onLimitChange(ensurePositive(value));
		},
		[onLimitChange]
	);

	return (
		<section className="panel">
			<h2>Posts {topicId ? `in #${topicId}` : ""}</h2>

			{!topic ? (
				<p>Select a topic</p>
			) : (
				<>
					<form onSubmit={handleCreatePost} className="formRow">
						<input
							value={newBody}
							onChange={(event) => setNewBody(event.target.value)}
							placeholder="Write a post..."
							className="input"
						/>
						<button type="submit" className="btn-primary">
							Post
						</button>
					</form>

					<div className="toolbar">
						<button onClick={handlePrev} disabled={!canPrev}>
							Prev
						</button>
						<span>Page {currentPage} / {totalPages} (total {total})</span>
						<button onClick={handleNext} disabled={!canNext}>
							Next
						</button>
						<select value={safeLimit} onChange={handleLimitChange}>
							{PAGE_SIZE_OPTIONS.map((option) => (
								<option key={option} value={option}>
									{option}/page
								</option>
							))}
						</select>
					</div>

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

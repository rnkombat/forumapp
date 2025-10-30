import { useCallback, useEffect, useRef, useState } from "react";

import { getPosts } from "../api";
import type { Post } from "../types";

type UsePostsResult = {
	posts: Post[];
	total: number;
	loading: boolean;
	refresh: () => Promise<void>;
};

export const usePosts = (topicId: number | null, limit: number, offset: number): UsePostsResult => {
	const [posts, setPosts] = useState<Post[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const isMountedRef = useRef(true);

	useEffect(() => {
		isMountedRef.current = true;

		return () => {
			isMountedRef.current = false;
		};
	}, []);

	const fetchPosts = useCallback(async () => {
		if (topicId === null) {
			if (isMountedRef.current) {
				setPosts([]);
				setTotal(0);
				setLoading(false);
			}
			return;
		}

		if (isMountedRef.current) {
			setLoading(true);
		}

		try {
			const data = await getPosts(topicId, limit, offset);

			if (!isMountedRef.current) {
				return;
			}

			setPosts(data.items);
			setTotal(data.total);
		} catch (error) {
			console.error("posts fetch failed", error);
			if (!isMountedRef.current) {
				return;
			}
			setPosts([]);
			setTotal(0);
		} finally {
			if (isMountedRef.current) {
				setLoading(false);
			}
		}
	}, [topicId, limit, offset]);

	useEffect(() => {
		fetchPosts();
	}, [fetchPosts]);

	return {
		posts,
		total,
		loading,
		refresh: fetchPosts,
	};
};

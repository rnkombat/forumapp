// src/api.ts
import type { Topic, Post, Paged } from "./types";

const BASE = (import.meta.env.VITE_API_BASE ?? "http://localhost:3003").replace(/\/+$/, "");
// BASE は "http://localhost:3003"（末尾スラ無し）に正規化

async function http<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${BASE}${path}`, {
		headers: { "Content-Type": "application/json" },
		...init,
	});
	const contentType = res.headers.get("content-type") ?? "";
	let payload: unknown = null;

	if (contentType.includes("application/json")) {
		try {
			payload = await res.json();
		} catch {
			payload = null;
		}
	} else {
		payload = await res.text().catch(() => "");
	}

	if (!res.ok) {
		let message = `HTTP ${res.status} ${res.statusText}`;

		if (payload && typeof payload === "object") {
			const data = payload as { error?: unknown; message?: unknown };
			if (data.error) {
				message = String(data.error);
			} else if (data.message) {
				message = String(data.message);
			}
		} else if (typeof payload === "string" && payload.trim()) {
			message = payload.trim();
		}

		throw new Error(message);
	}

	if (res.status === 204) {
		// void レスポンスを呼び出し側で扱いやすくする
		return undefined as T;
	}

	return payload as T;
}

export async function getTopics(): Promise<Topic[]> {
	return http<Topic[]>("/api/topics");
}

export async function createTopic(title: string, summary: string | null) {
	return http<Topic>("/api/topics", {
		method: "POST",
		body: JSON.stringify({ title, summary }),
	});
}

export async function updateTopic(
	id: number,
	patch: Partial<Pick<Topic, "title" | "summary" | "locked">>,
) {
	return http<Topic>(`/api/topics/${id}`, {
		method: "PATCH",
		body: JSON.stringify(patch),
	});
}

export async function deleteTopic(id: number) {
	return http<void>(`/api/topics/${id}`, { method: "DELETE" });
}

export async function getPosts(topicId: number, limit = 10, offset = 0) {
	const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
	return http<Paged<Post>>(`/api/topics/${topicId}/posts?${qs.toString()}`);
}

export async function createPost(topicId: number, body: string) {
	return http<Post>(`/api/topics/${topicId}/posts`, {
		method: "POST",
		body: JSON.stringify({ body }),
	});
}

export async function deletePost(topicId: number, postId: number) {
	return http<void>(`/api/topics/${topicId}/posts/${postId}`, { method: "DELETE" });
}


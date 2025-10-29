import { Link } from "react-router-dom";

import type { Topic } from "../types";

type TopicsPaneProps = {
	topics: Topic[];
	activeId?: number;
	onCreate: () => void;
	loading: boolean;
};

export const TopicsPane = ({ topics, activeId, onCreate, loading }: TopicsPaneProps) => {
	return (
		<section className="panel">
			<header className="panelHeader">
				<h2>Topics</h2>
				<button className="btn-primary" onClick={onCreate}>+ New Topic</button>
			</header>
			<ul className="list">
				{loading ? (
					<li className="emptyState">Loading topics...</li>
				) : topics.length === 0 ? (
					<li className="emptyState">No topics yet.</li>
				) : (
					topics.map((topic) => (
						<li
							key={topic.id}
							className={`topicItem ${activeId === topic.id ? "active" : ""}`}
						>
							<Link to={`/topics/${topic.id}`}>
								<div className="title">{topic.title}</div>
								<div className="summary">{topic.summary ?? "—"}</div>
								<div className="count">posts: {topic.posts_count}</div>
							</Link>
						</li>
					))
				)}
			</ul>
		</section>
	);
};

import { Link } from "react-router-dom";

import type { Topic } from "../types";

type TopicsPaneProps = {
	topics: Topic[];
	activeId?: number;
	onCreate: () => void;
	onDelete: (topic: Topic) => void;
	loading: boolean;
};

export const TopicsPane = ({ topics, activeId, onCreate, onDelete, loading }: TopicsPaneProps) => {
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
							<div className="topicRow">
								<Link to={`/topics/${topic.id}`} className="topicLink">
									<div className="title">
										{topic.title}
										{topic.locked ? <span className="badge badge-locked">ロック中</span> : null}
									</div>
									<div className={`summary ${topic.summary ? "" : "muted"}`}>
										{topic.summary ?? "概要はありません"}
									</div>
									<div className="count">投稿数: {topic.posts_count}</div>
								</Link>
								<button
									className="btn-danger topicDeleteBtn"
									onClick={(event) => {
									// Link の遷移を止めて削除処理だけを行う
									event.preventDefault();
									event.stopPropagation();
									onDelete(topic);
								}}
								>
									削除
								</button>
							</div>
						</li>
					))
				)}
			</ul>
		</section>
	);
};


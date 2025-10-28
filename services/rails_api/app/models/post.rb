class Post < ApplicationRecord
  belongs_to :topic, counter_cache: true

  validates :body, presence: true, length: { maximum: 200 }
  validates :system, inclusion: { in: [true, false] }

  scope :alive, -> { where(deleted_at: nil) }

  before_create :reject_if_locked_or_full, unless: :system?
  after_commit  :lock_topic_if_reached_limit, on: :create, unless: :system?

  private

  def reject_if_locked_or_full
    if topic.locked?
      errors.add(:base, "このスレッドはロックされています")
      throw :abort
    end

    if topic.posts_count >= 50
      errors.add(:base, "投稿上限に達しています")
      throw :abort
    end
  end

  def lock_topic_if_reached_limit
    if topic.posts_count == 50 && !topic.locked?
      topic.lock_with_system_post!
    end
  end
end

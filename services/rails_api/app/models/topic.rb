class Topic < ApplicationRecord
  has_many :posts, dependent: :destroy

  validates :title, presence: true, length: { maximum: 80 }

  scope :alive, -> { where(deleted_at: nil) }

  def lock_with_system_post!
    return if locked?
    transaction do
      update!(locked: true)
      posts.create!(body: "このスレッドは上限に達したので新しいスレッドを立ててください", system: true)
    end
  end
end

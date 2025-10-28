class CreateTopics < ActiveRecord::Migration[8.0]
  def change
    create_table :topics do |t|
      t.string   :title, null: false, limit: 80
      t.text     :summary
      t.integer  :posts_count, null: false, default: 0
      t.boolean  :locked, null: false, default: false
      t.datetime :deleted_at
      t.timestamps
    end

    add_index :topics, :deleted_at
  end
end

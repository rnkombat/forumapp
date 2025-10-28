class CreatePosts < ActiveRecord::Migration[8.0]
  def change
    create_table :posts do |t|
      t.references :topic, null: false, foreign_key: true
      t.text       :body, null: false
      t.boolean    :system, null: false, default: false
      t.datetime   :deleted_at
      t.timestamps
    end

    add_index :posts, :deleted_at

    execute <<~SQL
      ALTER TABLE posts
      ADD CONSTRAINT body_length CHECK (char_length(body) <= 200);
    SQL
  end
end

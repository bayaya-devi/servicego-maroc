UPDATE messages
SET conversation_id = (
  SELECT keeper.id
  FROM conversations keeper
  JOIN conversations duplicate ON duplicate.id = messages.conversation_id
  WHERE keeper.request_id = duplicate.request_id
    AND ((keeper.user_a_id = duplicate.user_a_id AND keeper.user_b_id = duplicate.user_b_id)
      OR (keeper.user_a_id = duplicate.user_b_id AND keeper.user_b_id = duplicate.user_a_id))
  ORDER BY keeper.created_at, keeper.id
  LIMIT 1
)
WHERE conversation_id IN (
  SELECT duplicate.id
  FROM conversations duplicate
  WHERE duplicate.id <> (
    SELECT keeper.id
    FROM conversations keeper
    WHERE keeper.request_id = duplicate.request_id
      AND ((keeper.user_a_id = duplicate.user_a_id AND keeper.user_b_id = duplicate.user_b_id)
        OR (keeper.user_a_id = duplicate.user_b_id AND keeper.user_b_id = duplicate.user_a_id))
    ORDER BY keeper.created_at, keeper.id
    LIMIT 1
  )
);

DELETE FROM conversations
WHERE id NOT IN (SELECT DISTINCT conversation_id FROM messages)
  AND request_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM conversations keeper
    WHERE keeper.id <> conversations.id
      AND keeper.request_id = conversations.request_id
      AND ((keeper.user_a_id = conversations.user_a_id AND keeper.user_b_id = conversations.user_b_id)
        OR (keeper.user_a_id = conversations.user_b_id AND keeper.user_b_id = conversations.user_a_id))
      AND (keeper.created_at < conversations.created_at OR (keeper.created_at = conversations.created_at AND keeper.id < conversations.id))
  );

CREATE UNIQUE INDEX IF NOT EXISTS conversations_request_pair_unique
ON conversations(
  request_id,
  CASE WHEN user_a_id < user_b_id THEN user_a_id ELSE user_b_id END,
  CASE WHEN user_a_id < user_b_id THEN user_b_id ELSE user_a_id END
);

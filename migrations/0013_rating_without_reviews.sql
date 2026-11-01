-- A profile with no published review has no rating. Keep the numeric column for compatibility.
UPDATE profiles SET rating = 0 WHERE review_count = 0;

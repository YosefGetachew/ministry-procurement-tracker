-- Contact and optional biography fields for registered committee members.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS biography TEXT DEFAULT '';

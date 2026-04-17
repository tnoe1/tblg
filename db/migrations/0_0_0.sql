-- Turn on foreign key constraints
PRAGMA foreign_keys = ON;

-- Versions table specifying migration status in db
CREATE TABLE versions (
    id INTEGER PRIMARY KEY,
    major INTEGER NOT NULL,
    minor INTEGER NOT NULL,
    patch INTEGER NOT NULL,
    description TEXT NOT NULL,
    UNIQUE(major, minor, patch)
);
INSERT INTO versions(major, minor, patch, description)
    VALUES(0, 0, 0, 'Initial version');


-- A post has an id, a timestamp, an author, a content string (html), 
-- a list of categories (these actually get referenced from the 
-- post_categories table), and a backward reference. 
-- Back and forward references can be used for versioning and maintaining 
-- a historic log. Note: in SQLite, you can't do easy date comparison since
-- timestamps aren't a native type.
CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    ts_unix_sec INTEGER NOT NULL,
    ts_readable TEXT GENERATED ALWAYS AS (
        STRFTIME('%Y-%m-%dT%H:%M:%SZ', ts_unix_sec, 'unixepoch')
    ) VIRTUAL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    last_updated_unix_sec INTEGER NOT NULL,
    last_updated_readable TEXT GENERATED ALWAYS AS (
        STRFTIME('%Y-%m-%dT%H:%M:%SZ', last_updated_unix_sec, 'unixepoch')
    ) VIRTUAL,
    parent INTEGER REFERENCES posts(id) -- self-referential... oooh. 
);

CREATE TABLE post_categories (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    category TEXT,
    UNIQUE(post_id, category)
);

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT, -- optional
    url TEXT, -- optional
    comment_count INTEGER DEFAULT 0,
    UNIQUE(name, email, url)
);
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_users_comment_count ON users(comment_count);

-- Comments table (references users, and posts): ts, 
-- post_id (on delete cascade), user, comment
CREATE TABLE comments (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) NOT NULL,
    user_id INTEGER REFERENCES users(id), -- Can be null if user gets deleted
    ts_unix_sec INTEGER NOT NULL,
    ts_readable TEXT GENERATED ALWAYS AS (
        STRFTIME('%Y-%m-%dT%H:%M:%SZ', ts_unix_sec, 'unixepoch')
    ) VIRTUAL,
    comment TEXT NOT NULL
);
CREATE INDEX idx_comments_user_id ON users(user_id);
CREATE INDEX idx_comments_post_id ON users(post_id);

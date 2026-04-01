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
    parent INTEGER REFERENCES posts(id) -- self-referential... oooh. 
);
-- TODO: Indices


-- post_categories reference posts.
CREATE TABLE post_categories (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    category TEXT,
    UNIQUE(post_id, category)
);

-- Users table: name, email, url, comment_count, (sentiment?); unique on (name, email, url)

-- Comments table (references users, and posts): post_id (on delete cascade), user, comment

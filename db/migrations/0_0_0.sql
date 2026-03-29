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

const db = require("../db");

// Right now, just pass-through noop. If additional business logic is needed, it
// should be added here in services.

module.exports = {
    services: db
}

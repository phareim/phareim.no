-- The tree on the beach (2026-10-13): one row per visitor per Oslo day. The
-- visitor is a random id the browser keeps in localStorage, never an address.
-- The tree counts the rows for today; rows older than a few days are pruned
-- by the visit route. Only phareim.no's own host writes here (beta shares
-- this database, so its visits are not counted).
CREATE TABLE IF NOT EXISTS tree_visits (
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  PRIMARY KEY (day, visitor)
);

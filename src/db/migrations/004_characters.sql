-- Postacie z osobowościami
CREATE TABLE IF NOT EXISTS characters (
  name       TEXT    PRIMARY KEY,
  emoji      TEXT    NOT NULL,
  personality TEXT   NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'idle',
  mood       TEXT    NOT NULL DEFAULT 'neutral',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Historia interakcji między postaciami
CREATE TABLE IF NOT EXISTS character_messages (
  id          INTEGER  PRIMARY KEY AUTOINCREMENT,
  from_char   TEXT     NOT NULL,
  to_char     TEXT,
  message     TEXT     NOT NULL,
  topic       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Debaty — wiele postaci o jednym temacie
CREATE TABLE IF NOT EXISTS debates (
  id         INTEGER  PRIMARY KEY AUTOINCREMENT,
  topic      TEXT     NOT NULL,
  status     TEXT     NOT NULL DEFAULT 'pending',
  chat_id    INTEGER  NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS debate_turns (
  id         INTEGER  PRIMARY KEY AUTOINCREMENT,
  debate_id  INTEGER  NOT NULL REFERENCES debates(id),
  character  TEXT     NOT NULL,
  content    TEXT     NOT NULL,
  turn_order INTEGER  NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_char_messages_from ON character_messages(from_char, created_at);
CREATE INDEX IF NOT EXISTS idx_debate_turns       ON debate_turns(debate_id, turn_order);

-- Seed postaci
INSERT OR IGNORE INTO characters (name, emoji, personality) VALUES
  ('Marek', '🕵️', 'Cyniczny detektyw. Szuka ryzyk i drugiego dna.'),
  ('Asia',  '✨',  'Optymistyczna analityczka. Widzi szanse.'),
  ('Stary', '🧙',  'Mędrzec. Mówi przypowieściami.'),
  ('Zofia', '⚖️',  'Pragmatyczna strateg. Waży argumenty.');

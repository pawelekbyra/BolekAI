-- Pamięć semantyczna — kanoniczny tekst mieszka tu (D1 = źródło prawdy).
-- Wektory żyją w Vectorize (binding MEMORY) i wskazują na te wiersze po id.
-- Jeśli indeks Vectorize kiedykolwiek przepadnie, można go odtworzyć z D1.
CREATE TABLE IF NOT EXISTS semantic_memories (
  id         TEXT PRIMARY KEY,
  content    TEXT NOT NULL,
  category   TEXT,
  source     TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_semantic_memories_category ON semantic_memories(category);
CREATE INDEX IF NOT EXISTS idx_semantic_memories_created ON semantic_memories(created_at);

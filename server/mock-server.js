const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs/promises');

const app = express();
const PORT = process.env.PORT || 5173;
const ROOT_DIR = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(ROOT_DIR, 'data', 'ledger.json');
const SYNC_LOG_PATH = path.join(__dirname, 'sync-log.json');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/ledger', async (_req, res) => {
  try {
    const raw = await fs.readFile(LEDGER_PATH, 'utf-8');
    res.json(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to read ledger file', error);
    res.status(500).json({ message: 'Failed to load ledger' });
  }
});

app.get('/api/sync-log', async (_req, res) => {
  try {
    const raw = await fs.readFile(SYNC_LOG_PATH, 'utf-8');
    res.json(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json([]);
      return;
    }
    console.error('Failed to read sync log', error);
    res.status(500).json({ message: 'Failed to load sync log' });
  }
});

app.post('/api/sync', async (req, res) => {
  const { sessions } = req.body ?? {};
  if (!Array.isArray(sessions) || sessions.length === 0) {
    res.status(400).json({ message: 'sessions array is required' });
    return;
  }

  const stampedSessions = sessions.map((session) => ({
    ...session,
    receivedAt: new Date().toISOString()
  }));

  try {
    let existing = [];
    try {
      const raw = await fs.readFile(SYNC_LOG_PATH, 'utf-8');
      existing = JSON.parse(raw);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    const updated = [...existing, ...stampedSessions];
    await fs.writeFile(SYNC_LOG_PATH, JSON.stringify(updated, null, 2));
    res.json({ stored: stampedSessions.length });
  } catch (error) {
    console.error('Failed to persist sync payload', error);
    res.status(500).json({ message: 'Failed to persist sync payload' });
  }
});

app.use(express.static(ROOT_DIR));

app.listen(PORT, () => {
  console.log(`Mock server listening on http://localhost:${PORT}`);
});

import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import routes from './routes';
import { resolveAuthContext } from './auth';
import { enforceCookieAllowlist } from './security/enforceCookieAllowlist';

const app = express();

app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));
app.use(enforceCookieAllowlist);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'winsights-patienthub', timestamp: new Date().toISOString() });
});

// Auth context for API routes (health is public)
app.use(resolveAuthContext);

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.path}` });
});

export default app;

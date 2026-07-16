import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import familiesRoutes from './routes/families.routes.js';
import stage0Routes from './routes/stage0.routes.js';
import stage1Routes from './routes/stage1.routes.js';
import stage2Routes from './routes/stage2.routes.js';
import stage3Routes from './routes/stage3.routes.js';
import stage4Routes from './routes/stage4.routes.js';
import stage5Routes from './routes/stage5.routes.js';
import stage6Routes from './routes/stage6.routes.js';
import publicRoutes from './routes/public.routes.js';
import passportRoutes from './routes/passport.routes.js';
import contractClausesRoutes from './routes/contractClauses.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

export const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'admissions-flow-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/families', familiesRoutes);
app.use('/api/stage0', stage0Routes);
app.use('/api/stage1', stage1Routes);
app.use('/api/stage2', stage2Routes);
app.use('/api/stage3', stage3Routes);
app.use('/api/stage4', stage4Routes);
app.use('/api/stage5', stage5Routes);
app.use('/api/stage6', stage6Routes);
app.use('/api/public', publicRoutes);
app.use('/api/passport', passportRoutes);
app.use('/api/contract-clauses', contractClausesRoutes);

app.use((req, res) => res.status(404).json({ error: 'Маршрут не найден.' }));
app.use(errorHandler);

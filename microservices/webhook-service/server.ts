import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { webhookClient } from '../../databases/clients';
import { createLogger } from '../shared/utils/logger';
import { requestIdMiddleware } from '../shared/middleware/requestId';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess, sendError } from '../shared/utils/response';
import { OpenTelemetrySetup } from '../../observability/tracing/OpenTelemetr
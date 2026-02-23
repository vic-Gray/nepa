import express from 'express';
import { documentClient } from '../../databases/clients';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess } from '../shared/utils/response';

const app = express();
const PORT = process.env.DOCUMENT_SERVICE_PORT || 3005;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'document-service' });
});

app.post('/documents', async (req, res, next) => {
  try {
    const document = await documentClient.document.create({ data: req.body });
    sendSuccess(res, document, 201);
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

app.listen(PORT, () => console.log(`Document service on port ${PORT}`));

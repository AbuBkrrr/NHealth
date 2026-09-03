import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import * as message from '../controllers/messageController';

const router = Router();

router.use(requireAuth);

router.get('/conversations', asyncHandler(message.listConversations));
router.get('/conversations/:partnerId', asyncHandler(message.getThread));
router.post('/', asyncHandler(message.sendMessage));

export default router;

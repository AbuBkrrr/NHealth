import { Router } from 'express';
import { requireAuth, requireRole, requireVerifiedProvider } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import * as pharmacy from '../controllers/pharmacyController';

const router = Router();

router.use(requireAuth, requireRole('PHARMACY'));
// Only verified providers can act on patients; reading data and editing their own profile stays open.
router.use((req, res, next) => (req.method === 'GET' || req.path.startsWith('/profile') || req.path.startsWith('/availability') ? next() : requireVerifiedProvider(req, res, next)));

router.get('/profile', asyncHandler(pharmacy.getProfile));
router.patch('/profile', asyncHandler(pharmacy.updateProfile));

router.get('/stats', asyncHandler(pharmacy.getStats));

router.get('/inventory', asyncHandler(pharmacy.listInventory));
router.post('/inventory', asyncHandler(pharmacy.createInventoryItem));
router.patch('/inventory/:id', asyncHandler(pharmacy.updateInventoryItem));
router.delete('/inventory/:id', asyncHandler(pharmacy.deleteInventoryItem));

router.get('/suppliers', asyncHandler(pharmacy.listSuppliers));
router.post('/suppliers', asyncHandler(pharmacy.createSupplier));
router.patch('/suppliers/:id', asyncHandler(pharmacy.updateSupplier));
router.delete('/suppliers/:id', asyncHandler(pharmacy.deleteSupplier));

router.get('/orders', asyncHandler(pharmacy.listOrders));
router.get('/orders/:id', asyncHandler(pharmacy.getOrderDetail));
router.post('/orders/:id/status', asyncHandler(pharmacy.updateOrderStatus));

export default router;

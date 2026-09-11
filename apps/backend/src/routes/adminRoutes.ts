import { Router } from 'express';
import { requireAuth, requireRole, requireSuperAdmin } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import * as admin from '../controllers/adminController';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/stats', asyncHandler(admin.getStats));

router.get('/users', asyncHandler(admin.listUsers));
router.get('/users/:id', asyncHandler(admin.getUserDetail));
router.patch('/users/:id/status', asyncHandler(admin.setUserStatus));

// Everything below manages admin accounts themselves - super admin only.
router.get('/admins', requireSuperAdmin, asyncHandler(admin.listAdmins));
router.post('/admins', requireSuperAdmin, asyncHandler(admin.createAdmin));
router.patch('/admins/:id', requireSuperAdmin, asyncHandler(admin.updateAdmin));
router.delete('/admins/:id', requireSuperAdmin, asyncHandler(admin.deleteAdmin));

router.get('/audit-log', requireSuperAdmin, asyncHandler(admin.listAuditLog));

export default router;

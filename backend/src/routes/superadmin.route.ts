import { Router } from 'express';
import { 
  getUsersManagement, 
  getRegionalPricesAndCommodities, 
  getGeospatialRadarData, 
  getAuditLogs, 
  getWaEngineStatus, 
  updateWaSettings, 
  resetUserPassword, 
  promoteUserRole, 
  deleteUserAccount,
  getPriceProposalsGrouped,
  approveOrRejectProposalGroup,
  triggerManualScrape,
} from '../controllers/superadmin.controller.js';

const router = Router();

router.get('/users', getUsersManagement);
router.get('/regional-prices', getRegionalPricesAndCommodities);
router.get('/geospatial', getGeospatialRadarData);
router.get('/audit-logs', getAuditLogs);
router.get('/wa-status', getWaEngineStatus);
router.post('/wa-settings', updateWaSettings);
router.post('/reset-password', resetUserPassword);
router.post('/promote-role', promoteUserRole);
router.post('/delete-user', deleteUserAccount);
router.get('/price-proposals', getPriceProposalsGrouped);
router.post('/price-proposals/action', approveOrRejectProposalGroup);
router.post('/trigger-scrape', triggerManualScrape);

export default router;

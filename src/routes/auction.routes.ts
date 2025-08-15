// routes/auctionRoutes.ts
import { Router } from 'express';
import { 
  createAuction, 
  getAuction, 
  getAllAuctions, 
  placeBid, 
  getUserBids 
} from '../controllers/auction.controller';
// import { validateCreateAuction, validatePlaceBid } from '../middleware/validation';

const router = Router();

// Public routes
router.get('/auctions', getAllAuctions);
router.get('/auctions/:id', getAuction);

// Protected routes
router.post('/auctions', createAuction);
router.post('/auctions/:id/bid',placeBid);
router.get('/users/:userId/bids', getUserBids);

export default router;

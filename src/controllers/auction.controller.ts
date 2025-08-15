// controllers/auctionController.ts
import { Request, Response } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import auctionService from '../services/auction.service';
import { AuctionEngine } from '../Engine/auctionEngine';

// Extend Request type for authenticated routes
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    username: string;
    role?: string;
  };
}

export class AuctionController {
  
  /**
   * Create a new auction
   * POST /api/auctions
   */
  async createAuction(req:Request, res: Response) {
    try {
      const {
        title,
        description,
        startTime,   
        endTime,
        startingBid,
        userId
      } = req.body;

      // Additional business validation
      const now = new Date();
      const start = new Date(startTime);
      const end = new Date(endTime);

      if (start < now) {
        res.status(400).json({
          success: false,
          message: 'Start time cannot be in the past'
        });
        return;
      }

      const minDuration = 30 * 60 * 1000; // 30 minutes
      const maxDuration = 7 * 24 * 60 * 60 * 1000; // 7 days
      const duration = end.getTime() - start.getTime();

      if (duration < minDuration) {
        return res.status(400).json({
          success: false,
          message: 'Auction must run for at least 30 minutes'
        });
      }

      if (duration > maxDuration) {
        return res.status(400).json({
          success: false,
          message: 'Auction cannot run for more than 7 days'
        });
      }

      const auction = await auctionService.createAuction({
        title,
        description,
        startTime: start,
        endTime: end,
        startingBid: new Decimal(startingBid),
        creatorId: userId,
        topBid: new Decimal(0),
        topBidderId: null,
        topBidder: null, 
        status: 'Live'
      });

      return res.status(201).json({
        success: true,
        data: auction,
        message: 'Auction created successfully'
      });

    } catch (error: any ) {
      console.error('Create auction error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create auction'
      });
    }
  }

  /**
   * Get single auction by ID
   * GET /api/auctions/:id
   */
  async getAuction(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Auction ID is required'
        });
        return;
      }

      const auction = await auctionService.getAuction(id);

      if (!auction) {
        res.status(404).json({
          success: false,
          message: 'Auction not found'
        });
        return;
      }

      // Add computed fields
      const now = new Date();
      const endTime = new Date(auction.endTime);
      const timeRemaining = Math.max(0, endTime.getTime() - now.getTime());
      
      const responseData = {
        ...auction,
        timeRemaining,
        isActive: auction.status === 'Live' && timeRemaining > 0,
        totalBids: auction.bids?.length || 0
      };

      res.json({
        success: true,
        data: responseData
      });

    } catch (error) {
      console.error('Get auction error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch auction'
      });
    }
  }

  /**
   * Get all live auctions
   * GET /api/auctions
   */
  async getAllAuctions(req: Request, res: Response) {
    try {
      const { 
        page = '1', 
        limit = '20', 
        sortBy = 'endTime',
        sortOrder = 'asc',
        search 
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;

      let auctions = auctionService.listLiveAuctions();

      // Search functionality
      if (search && typeof search === 'string') {
        const searchTerm = search.toLowerCase();
        auctions = auctions.filter(auction => 
          auction.title.toLowerCase().includes(searchTerm) ||
          auction.description.toLowerCase().includes(searchTerm)
        );
      }

      // Sorting
      auctions.sort((a, b) => {
        const multiplier = sortOrder === 'desc' ? -1 : 1;
        
        switch (sortBy) {
          case 'title':
            return multiplier * a.title.localeCompare(b.title);
          case 'topBid':
            return multiplier * (Number(a.topBid) - Number(b.topBid));
          case 'endTime':
          default:
            return multiplier * (new Date(a.endTime).getTime() - new Date(b.endTime).getTime());
        }
      });

      // Pagination
      const paginatedAuctions = auctions.slice(skip, skip + limitNum);

      // Add computed fields
      const enrichedAuctions = paginatedAuctions.map(auction => {
        const now = new Date();
        const endTime = new Date(auction.endTime);
        const timeRemaining = Math.max(0, endTime.getTime() - now.getTime());
        
        return {
          ...auction,
          timeRemaining,
          isActive: auction.status === 'Live' && timeRemaining > 0,
          totalBids: auction.bids?.length || 0
        };
      });

      res.json({
        success: true,
        data: enrichedAuctions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: auctions.length,
          pages: Math.ceil(auctions.length / limitNum)
        },
        message: `Found ${auctions.length} live auctions`
      });

    } catch (error) {
      console.error('Get all auctions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch auctions'
      });
    }
  }

  /**
   * Place a bid on an auction
   * POST /api/auctions/:id/bid
   */
  async placeBid(req: Request, res: Response) {
    try {
      const { id: auctionId } = req.params;
      const { amount, userId } = req.body;

      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid bid amount is required'
        });
      }

      const bidAmount = new Decimal(amount);
      
      // Check if user is trying to bid on their own auction
      const auction = await auctionService.getAuction(auctionId);
      if (auction?.creatorId === userId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot bid on your own auction'
        });
      }

      const bid = await auctionService.placeBid(auctionId, bidAmount, userId);

      // Get updated auction info
      const updatedAuction = await auctionService.getAuction(auctionId);

      res.status(201).json({
        success: true,
        data: {
          bid,
          auction: updatedAuction
        },
        message: `Bid of $${amount} placed successfully`
      });

    } catch (error:any) {
      console.error('Place bid error:', error);
      
      // Handle specific error types
      let statusCode = 500;
      if (error.message.includes('not found')) statusCode = 404;
      if (error.message.includes('higher than') || 
          error.message.includes('Insufficient') ||
          error.message.includes('already the highest')) statusCode = 400;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to place bid'
      });
    }
  }

  /**
   * Get user's bid history
   * GET /api/users/:userId/bids
   */
  async getUserBids(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { auctionId, page = '1', limit = '20' } = req.query;

      // Authorization check
      if (!userId) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied!'
        });
      }

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));

      const bids = await auctionService.getUserBids(
        userId, 
        auctionId as string
      );

      // Pagination
      const skip = (pageNum - 1) * limitNum;
      const paginatedBids = bids.slice(skip, skip + limitNum);

      res.json({
        success: true,
        data: paginatedBids,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: bids.length,
          pages: Math.ceil(bids.length / limitNum)
        }
      });

    } catch (error) {
      console.error('Get user bids error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user bids'
      });
    }
  }

  /**
   * Get auction statistics
   * GET /api/auctions/:id/stats
   */
  async getAuctionStats(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const auction = await auctionService.getAuction(id);

      if (!auction) {
        return res.status(404).json({
          success: false,
          message: 'Auction not found'
        });
      }

      const bids = auction.bids || [];
      const uniqueBidders = new Set(bids.map(bid => bid.userId)).size;
      const averageBid = bids.length > 0 
        ? bids.reduce((sum, bid) => sum + Number(bid.amount), 0) / bids.length 
        : 0;

      const stats = {
        totalBids: bids.length,
        uniqueBidders,
        averageBid: Number(averageBid.toFixed(2)),
        currentTopBid: Number(auction.topBid),
        startingBid: Number(auction.startingBid),
        priceIncrease: Number(auction.topBid) - Number(auction.startingBid),
        timeRemaining: Math.max(0, new Date(auction.endTime).getTime() - Date.now()),
        biddingActivity: bids.slice(-10).map(bid => ({
          amount: Number(bid.amount),
          timestamp: bid.createdAt
        }))
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Get auction stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch auction statistics'
      });
    }
  }

  /**
   * Get current user's created auctions
   * GET /api/my-auctions
   */
  async getMyAuctions(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const { status } = req.query;

      // This would need to be implemented in your service
      // For now, filtering from live auctions
      const allAuctions = auctionService.listLiveAuctions();
      const myAuctions = allAuctions.filter(auction => auction.creatorId === userId);

      res.json({
        success: true,
        data: myAuctions,
        count: myAuctions.length
      });

    } catch (error) {
      console.error('Get my auctions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch your auctions'
      });
    }
  }
}

// Export controller instance
export default new AuctionController();

// Export individual methods for route binding
export const {
  createAuction,
  getAuction,
  getAllAuctions,
  placeBid,
  getUserBids,
  getAuctionStats,
  getMyAuctions
} = new AuctionController();

// Current issue: You have duplicate createAuction methods
// Remove the one in AuctionEngine and keep only in AuctionService

// Improved AuctionService:
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/Prisma';
import { AuctionEngine } from '../Engine/auctionEngine';
import { AuctionType, BidType } from '../types';

class AuctionService {
  private engine = AuctionEngine.getInstance();

  async createAuction(
    data: Omit<AuctionType, 'id' | 'bids'>
  ): Promise<AuctionType> {
    // Add validation
    if (new Date(data.startTime) >= new Date(data.endTime)) {
      throw new Error('End time must be after start time');
    }
    
    if (Number(data.startingBid) <= 0) {
      throw new Error('Starting bid must be positive');
    }

    const dbAuction = await prisma.auction.create({
      data: {
        title: data.title,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        status: 'Live',
        creatorId: data.creatorId,
        startingBid: data.startingBid,
        topBid: new Decimal(data.startingBid),
        topBidderId: null
      },
      include: {
        topBidder: { select: { id: true, username: true } },
        bids: true
      }
    });

    // Register in memory
    this.engine.registerAuction(dbAuction as AuctionType);
    return dbAuction as AuctionType;
  }

  async placeBid(
    auctionId: string,
    amount: Decimal,
    userId: string
  ): Promise<BidType> {
    return this.engine.placeBid(auctionId, amount, userId);
  }

  async getAuction(auctionId: string): Promise<AuctionType | null> {
    const mem = this.engine.getAuction(auctionId);
    if (mem) return mem.Auction;

    return prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        topBidder: { select: { id: true, username: true } },
        bids: { 
          orderBy: { createdAt: 'desc' },
          take: 50 // Limit for performance
        }
      }
    }) as Promise<AuctionType | null>;
  }

  listLiveAuctions() {
    return this.engine.getAllLiveAuctions();
  }

  async getUserBids(userId: string, auctionId?: string) {
    return prisma.bid.findMany({
      where: { 
        userId,
        ...(auctionId && { auctionId })
      },
      include: {
        auction: {
          select: { title: true, status: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

export default new AuctionService();

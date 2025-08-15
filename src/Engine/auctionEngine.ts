import { Decimal } from '@prisma/client/runtime/library';
import { AuctionType, BidType } from '../types';
import prisma from '../utils/Prisma';
import { bidQueue } from '../Queue/bidQueue';

type InMemoryAuction = {
  Auction: AuctionType;
  bids: BidType[];
  timeout: NodeJS.Timeout;
};

export class AuctionEngine {
  private static instance: AuctionEngine;
  private auctions: Map<string, InMemoryAuction> = new Map();
  private userCache: Map<string, { balances: Decimal; username: string }> = new Map();

  private constructor() {
    this.initialize();
  }

  public static getInstance(): AuctionEngine {
    if (!AuctionEngine.instance) {
      AuctionEngine.instance = new AuctionEngine();
    }
    return AuctionEngine.instance;
  }

  private async initialize() {
    try {
      // Load live auctions
      const liveAuctions = await prisma.auction.findMany({
        where: { 
          status: 'Live',
          endTime: { gt: new Date() } // Only future auctions
        },
        include: {
          topBidder: { select: { id: true, username: true } },
          bids: { 
            orderBy: { createdAt: 'asc' },
            take: 100 // Limit initial load
          }
        }
      });

      for (const auction of liveAuctions) {
        const timeLeft = new Date(auction.endTime).getTime() - Date.now();
        if (timeLeft > 0) {
          const timeout = setTimeout(() => this.endAuction(auction.id), timeLeft);
          this.auctions.set(auction.id, {
            Auction: auction as AuctionType,
            bids: auction.bids as BidType[],
            timeout
          });
        }
      }

      // Load user cache
      const users = await prisma.user.findMany({
        select: { id: true, username: true, balances: true }
      });
      
      for (const user of users) {
        this.userCache.set(user.id, {
          balances: user.balances,
          username: user.username
        });
      }

      console.log(`Initialized ${this.auctions.size} live auctions`);
    } catch (error) {
      console.error('Failed to initialize auction engine:', error);
    }
  }

  // Add this method that's referenced in AuctionService
  public registerAuction(auction: AuctionType) {
    const timeLeft = new Date(auction.endTime).getTime() - Date.now();
    if (timeLeft > 0) {
      const timeout = setTimeout(() => this.endAuction(auction.id), timeLeft);
      this.auctions.set(auction.id, {
        Auction: auction,
        bids: auction.bids || [],
        timeout
      });
    }
  }

  public getAuction(auctionId: string): InMemoryAuction | undefined {
    return this.auctions.get(auctionId);
  }

  public getAllLiveAuctions(): AuctionType[] {
    return Array.from(this.auctions.values()).map(item => item.Auction);
  }

  public async placeBid(auctionId: string, amount: Decimal, userId: string): Promise<BidType> {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new Error('Auction not found or already ended');
    }

    // Validation
    if (new Date() > new Date(auction.Auction.endTime)) {
      throw new Error('Auction has ended');
    }

    const currentTopBid = auction.Auction.topBid;
    if (amount.lte(currentTopBid)) {
      throw new Error(`Bid must be higher than current top bid of ${currentTopBid}`);
    }

    const user = this.userCache.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (amount.gt(user.balances)) {
      throw new Error('Insufficient balance');
    }

    // Prevent self-bidding
    if (auction.Auction.topBidderId === userId) {
      throw new Error('You are already the highest bidder');
    }

    const newBid: BidType = {
      id: crypto.randomUUID(),
      auctionId,
      userId,
      amount,
      createdAt: new Date()
    };

    // Update in-memory state
    auction.bids.push(newBid);
    auction.Auction.topBid = amount;
    auction.Auction.topBidderId = userId;
    auction.Auction.topBidder = {
      id: userId,
      username: user.username
    };

    // Soft close extension
    const remainingMs = new Date(auction.Auction.endTime).getTime() - Date.now();
    const SOFT_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    
    if (remainingMs <= SOFT_THRESHOLD) {
      const newEndTime = new Date(Date.now() + SOFT_THRESHOLD);
      auction.Auction.endTime = newEndTime;
      
      clearTimeout(auction.timeout);
      auction.timeout = setTimeout(() => this.endAuction(auctionId), SOFT_THRESHOLD);
      
      // Update DB with new end time
      prisma.auction.update({
        where: { id: auctionId },
        data: { endTime: newEndTime }
      }).catch(console.error);
    }

    // Queue bid for persistence
    bidQueue.add('save-bid', { bid: newBid });

    return newBid;
  }

  public async endAuction(auctionId: string) {
    const mem = this.auctions.get(auctionId);
    if (!mem) return;

    clearTimeout(mem.timeout);
    this.auctions.delete(auctionId);

    try {
      await prisma.$transaction([
        prisma.auction.update({
          where: { id: auctionId },
          data: {
            status: 'ENDED',
            topBid: mem.Auction.topBid,
            topBidderId: mem.Auction.topBidderId,
          }
        }),
        // Handle winner balance deduction and loser refunds if needed
      ]);

      console.log(`Auction ${auctionId} ended. Winner: ${mem.Auction.topBidderId}`);
    } catch (error) {
      console.error(`Failed to end auction ${auctionId}:`, error);
    }
  }

  // Update user balance in cache
  public updateUserBalance(userId: string, newBalance: Decimal) {
    const user = this.userCache.get(userId);
    if (user) {
      user.balances = newBalance;
    }
  }
}

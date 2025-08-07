import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/Prisma';
import { AuctionEngine } from '../Engine/auctionEngine';
import { AuctionType, BidType } from '../types';

class AuctionService {
  private engine = AuctionEngine.getInstance();

  /*───────────────────────────────────────────────────────────
   *  CREATE  AUCTION  (called by controller)
   *───────────────────────────────────────────────────────────*/
  async createAuction(
    data: Omit<AuctionType, 'id' | 'bids'>
  ): Promise<AuctionType> {
    // 1️⃣  Persist to DB ‑ the auction must be durable
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

    // 2️⃣  Register in memory so bids can start instantly
    this.engine.registerAuction(dbAuction as any);   // helper in engine

    return dbAuction as AuctionType;
  }

  /*───────────────────────────────────────────────────────────
   *  PLACE  BID  (delegated to engine)
   *───────────────────────────────────────────────────────────*/
  async placeBid(
    auctionId: string,
    amount: Decimal,
    userId: string
  ): Promise<BidType> {
    return this.engine.placeBid(auctionId, amount, userId);
  }

  /*───────────────────────────────────────────────────────────
   *  READ HELPERS  (for controllers / UI)
   *───────────────────────────────────────────────────────────*/
  /** Get a single live auction from memory (fallback to DB) */
  async getAuction(auctionId: string) {
    const mem = this.engine.getAuction(auctionId);
    if (mem) return mem.Auction;

    // Fallback (rare) – e.g., auction already ended or not yet cached
    return prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        topBidder: { select: { id: true, username: true } },
        bids: { orderBy: { createdAt: 'asc' } }
      }
    });
  }

  /** Return lightweight list of all live auctions (from memory) */
  listLiveAuctions() {
    return this.engine.getAllLiveAuctions();
  }
}

/*------------------------------------------------------------
 * Export a singleton so controllers can import directly
 *-----------------------------------------------------------*/
export default new AuctionService();

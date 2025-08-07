import { Decimal } from '@prisma/client/runtime/library';
import { AuctionType, BidType, UserType } from '../types';
import prisma from '../utils/Prisma';
import { bidQueue } from '../Queue/bidQueue';

type InMemoryAuction = {
    Auction: AuctionType;
    bids: BidType[];
    timeout: NodeJS.Timeout;
};



export class AuctionEngine {
    private static instance: AuctionEngine
    private auctions: Map<string, InMemoryAuction> = new Map()
    private userCache: Map<string, { balances: Decimal, username: string }> = new Map()


    private constructor() {
        this.initialize()
    }

    public static getInstance(): AuctionEngine {
        if (!AuctionEngine.instance) {
            AuctionEngine.instance = new AuctionEngine()
        }

        return AuctionEngine.instance
    }

    private async initialize() {
        const liveAuctions = await prisma.auction.findMany({
            where: { status: 'Live' },
            select: {
                id: true,
                title: true,
                status: true,
                description: true,
                startTime: true,
                endTime: true,
                topBid: true,
                topBidderId: true,
                startingBid: true,
                creatorId: true,
                topBidder: {
                    select: {
                        id: true,
                        username: true,
                    },
                },
                bids: {
                    select: {
                        id: true,
                        auctionId: true,
                        userId: true,
                        amount: true,
                        createdAt: true,
                    }
                },
            },
        });

        for (const Auction of liveAuctions) {
            const timeleft = new Date(Auction.endTime).getTime() - Date.now()
            const timeout = setTimeout(() => this.endAuction(Auction.id), timeleft)

            this.auctions.set(Auction.id, {
                Auction, bids: Auction.bids, timeout
            })
        }
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                balances: true
            }
        })
        for (const user of users) {
            this.userCache.set(user.id, {
                balances: user.balances,
                username: user.username
            })
        }
    }
    public async createAuction(auctionData: Omit<AuctionType, "id">) {
        try {
            const newAuction = await prisma.auction.create({
                data: {
                    title: auctionData.title,
                    description: auctionData.description,
                    startTime: auctionData.startTime,
                    endTime: auctionData.endTime,
                    creatorId: auctionData.creatorId,
                    startingBid: auctionData.startingBid,
                    topBid: auctionData.topBid || 0,
                    topBidderId: auctionData.topBidderId || null,
                    status: "Live",
                }

            })


        } catch (error) {
            console.error("Error creating auction:", error);
            throw new Error("Failed to create auction");
        }

    }

    public async placeBid(auctionId: string, amount: Decimal, userId: string) {

        const auction = this.auctions.get(auctionId)
        if (!auction) {
            throw new Error("Auction not found")
        }
        const currentTopBid = auction.Auction.topBid
        if (amount.lte(currentTopBid)) {
            throw new Error("Bid amount must be higher than current top bid")
        }

        const user = this.userCache.get(userId)
        if (!user) {
            throw new Error("user not found")
        }
        if (amount.gt(user.balances)) throw new Error("Insufficient balance");

        const newBid = {
            id: crypto.randomUUID(),
            auctionId,
            userId,
            amount,
            createdAt: new Date()
        }

        auction.bids.push(newBid)
        auction.Auction.topBid = amount
        auction.Auction.topBidderId = userId
        auction.Auction.topBidder = {
            id: userId,
            username: user.username
        }

        /* ► Soft‑close (optional 5 min extension) */
        const remainingMs = new Date(auction.Auction.endTime).getTime() - Date.now();
        const SOFT_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
        if (remainingMs <= SOFT_THRESHOLD) {
            auction.Auction.endTime = new Date(Date.now() + SOFT_THRESHOLD);
            clearTimeout(auction.timeout);
            auction.timeout = setTimeout(() => this.endAuction(auctionId), SOFT_THRESHOLD);
        }

        bidQueue.add("save-bid", {
            bid: newBid
        })
    }

    public async endAuction(auctionId: string) {
        const mem = this.auctions.get(auctionId);
        if (!mem) return;                                // already gone

        clearTimeout(mem.timeout);                       // tidy up
        this.auctions.delete(auctionId);                 // remove from RAM

        // Ensure final topBid & topBidder are stored
        await prisma.$transaction([
            prisma.auction.update({
                where: { id: auctionId },
                data: {
                    status: 'ENDED',
                    topBid: mem.Auction.topBid,
                    topBidderId: mem.Auction.topBidderId,
                }
            }),
            // Optionally mark losers as refunded / unlock balances here
        ]);

        // Broadcast to clients (if you have a socket layer)
        // socket.emit('auction-ended', { auctionId, winner: mem.Auction.topBidderId, topBid: mem.Auction.topBid });
    }





} 
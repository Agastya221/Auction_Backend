import { AuctionType, BidType, UserType } from '../types/auction.types';
import prisma from '../utils/Prisma';
// import { bidQueue } from './queues/bidQueue';


type InMemoryAuction = {
    Auction: AuctionType;
    bids: BidType[];
    timeout: NodeJS.Timeout;
};



class AuctionEngine {
    private static instance: AuctionEngine
    private auctions: Map<string, InMemoryAuction> = new Map()


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
                description:true,
                startTime: true,
                endTime: true,
                topBid: true,
                topBidderId: true,
                startingBid: true,
                creatorId:true,
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
            const timeout = setTimeout(() => {
                this.endAuction(Auction.id), timeleft
            })
            this.auctions.set(Auction.id, {
                Auction, bids: Auction.bids, timeout
            })
        }

    }

    public async creatAuction(auctionData: Omit<AuctionType, "id">) {
        try {
            const newAuction = await prisma.auction.create({
                data: {
                    title: auctionData.title,
                    description: auctionData.description,
                    startTime: auctionData.startTime,
                    endTime: auctionData.endTime,
                    creatorId:auctionData.creatorId,
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


    public async endAuction(auctionId: string) {
        this.auctions.delete(auctionId)
        await prisma.auction.update({
            where: {
                id: auctionId
            },
            data: {
                status: "ENDED"
            }
        })
    }




} 
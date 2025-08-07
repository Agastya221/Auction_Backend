import { Worker } from "bullmq";
import { bullMQConnection} from "./connection"
import prisma from "../utils/Prisma";
import { BidType } from "../types";

new Worker("save-bid",
    async job => {
        const { bid } = job.data as { bid: BidType };
        // Process the bid here 
        console.log(`Processing bid: ${bid}`);
        // Save the bid to the database
        await prisma.bid.create({
            data:{
                id: bid.id,
                auctionId: bid.auctionId,
                userId: bid.userId,
                amount: bid.amount,
            }
        })
        
    },
    {
        connection: bullMQConnection
    }
)
import { Queue } from "bullmq";
import { bullMQConnection } from "./connection";


export const bidQueue = new Queue('bids',{
    connection: bullMQConnection
})
import { Request, Response } from "express";


const auctionController = async(req: Request, res: Response) => {
  // Handle auction-related requests here
  const { title, description, startTime, endTime,  } = req.body;
  const aut = await 

  res.send("Auction controller");
}

export default auctionController;
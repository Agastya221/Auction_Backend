import { Request, Response } from "express";

const bidController = (req: Request, res: Response) => {
  // Handle bid-related requests here
  res.send("Bid controller");
}

export default bidController;
import { Decimal } from "@prisma/client/runtime/library";

export type UserType = {
  id: string;
  username: string;
  email?: string;
  balances?: Decimal;
};
export type LightUserType = {
  id: string ;
  username: string ;
};

export type BidType = {
  id: string;
  auctionId: string;
  amount: Decimal;
  userId: string;
  createdAt: Date;
};

export type AuctionType = {
  id: string;
  title: string;
  description: string;
  status: 'Live' | 'ENDED' | 'CANCELLED';
  startTime: Date;
  endTime: Date;
  startingBid: string;
  creatorId:string;
  topBid: Decimal;
  topBidderId: string | null;
  topBidder: LightUserType | null;
  bids: BidType[];
};

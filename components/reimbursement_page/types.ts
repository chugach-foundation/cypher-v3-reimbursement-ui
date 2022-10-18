import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export type TableInfo = {
  nativeAmount: BN;
  mintPubKey: PublicKey;
  index: number;
};

export type MintInfo = {
  decimals: number;
  symbol: string;
};

export type ReimbursementAccount = {
  claimTransferred: number;
  reimbursed: number;
};

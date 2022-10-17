import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { TOKEN_PROGRAM_ID } from "./tokens";

export async function isExistingTokenAccount(
  connection: Connection,
  publicKey: PublicKey
): Promise<boolean> {
  try {
    const account = await connection.getParsedAccountInfo(publicKey);
    //TODO find way to validate account without sols
    if (!account) {
      throw "Account doesn't exist or has no SOLs";
    }
    return true;
  } catch (ex) {
    return false;
  }
}

export function chunks<T>(array: T[], size: number): T[][] {
  const result: Array<T[]> = [];
  let i, j;
  for (i = 0, j = array.length; i < j; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export function toDecimalAmount(amount: BN, decimals: number) {
  return amount.toNumber() / 10 ** decimals!;
}

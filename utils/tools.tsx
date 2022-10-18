import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import { TOKEN_PROGRAM_ID } from "./tokens";
import { struct, u8 } from "@solana/buffer-layout";

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

export async function tryDecodeTable(reimbursementClient, group) {
  try {
    const table = await reimbursementClient.decodeTable(group.account);
    return table;
  } catch (e) {
    return null;
    //silent error
  }
}

export async function tryGetReimbursedAccounts(
  reimbursementClient,
  reimbursementAccount: PublicKey
) {
  try {
    const ra =
      await reimbursementClient!.program.account.reimbursementAccount.fetch(
        reimbursementAccount
      );
    return ra;
  } catch (e) {
    return null;
  }
}

export const WSOL_MINT_PK = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

export enum TokenInstruction {
  InitializeMint = 0,
  InitializeAccount = 1,
  InitializeMultisig = 2,
  Transfer = 3,
  Approve = 4,
  Revoke = 5,
  SetAuthority = 6,
  MintTo = 7,
  Burn = 8,
  CloseAccount = 9,
  FreezeAccount = 10,
  ThawAccount = 11,
  TransferChecked = 12,
  ApproveChecked = 13,
  MintToChecked = 14,
  BurnChecked = 15,
  InitializeAccount2 = 16,
  SyncNative = 17,
  InitializeAccount3 = 18,
  InitializeMultisig2 = 19,
  InitializeMint2 = 20,
  GetAccountDataSize = 21,
  InitializeImmutableOwner = 22,
  AmountToUiAmount = 23,
  UiAmountToAmount = 24,
  InitializeMintCloseAuthority = 25,
  TransferFeeExtension = 26,
  ConfidentialTransferExtension = 27,
  DefaultAccountStateExtension = 28,
  Reallocate = 29,
  MemoTransferExtension = 30,
  CreateNativeMint = 31,
  InitializeNonTransferableMint = 32,
  InterestBearingMintExtension = 33,
}

/** Copy from spl-token */
export interface SyncNativeInstructionData {
  instruction: TokenInstruction.SyncNative;
}

/** TODO: docs */
export const syncNativeInstructionData = struct<SyncNativeInstructionData>([
  u8("instruction"),
]);

/**
 * Construct a SyncNative instruction
 *
 * @param account   Native account to sync lamports from
 * @param programId SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createSyncNativeInstruction(
  account: PublicKey,
  programId = TOKEN_PROGRAM_ID
): TransactionInstruction {
  const keys = [{ pubkey: account, isSigner: false, isWritable: true }];

  const data = Buffer.alloc(syncNativeInstructionData.span);
  syncNativeInstructionData.encode(
    { instruction: TokenInstruction.SyncNative },
    data
  );

  return new TransactionInstruction({ keys, programId, data });
}

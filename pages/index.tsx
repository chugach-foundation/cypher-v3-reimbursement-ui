import React, { useEffect, useState } from "react";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@project-serum/anchor";
import useMangoStore from "stores/useMangoStore";
import useReimbursementStore from "stores/useReimbursementStore";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import Button from "components/Button";
import {
  chunks,
  isExistingTokenAccount,
  tryDecodeTable,
  tryGetReimbursedAccounts,
  WSOL_MINT_PK,
} from "utils/tools";
import { TOKEN_PROGRAM_ID } from "@project-serum/serum/lib/token-instructions";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { sendSignAndConfirmTransactions } from "@blockworks-foundation/mangolana/lib/transactions";
import { SequenceType } from "@blockworks-foundation/mangolana/lib/globalTypes";
import { Config } from "@blockworks-foundation/mango-client";
import { notify } from "utils/notifications";
import Loading from "components/Loading";
import { WalletIcon } from "components";
import { CurrencyDollarIcon } from "@heroicons/react/solid";
import TableRow from "components/reimbursement_page/TableRow";
import EmptyTableRows from "components/reimbursement_page/EmptyRow";
import {
  MintInfo,
  ReimbursementAccount,
  TableInfo,
} from "components/reimbursement_page/types";
import Checkbox from "components/Checkbox";

const GROUP_NUM = 32;

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, [
        "common",
        "delegate",
        "tv-chart",
        "alerts",
        "share-modal",
        "profile",
      ])),
      // Will be passed to the page component as props
    },
  };
}

const MainPage = () => {
  const connection = useMangoStore((s) => s.connection);
  const groupName = useMangoStore((s) => s.selectedMangoGroup);
  const wallet = useWallet();
  const { reimbursementClient } = useReimbursementStore();

  const [mintsForAvailableAmounts, setMintsForAvailableAmounts] = useState<{
    [key: string]: MintInfo;
  }>({});
  const [table, setTable] = useState<TableInfo[]>([]);
  const [amountsLoading, setAmountsLoading] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [reimbursementAccount, setReimbursementAccount] =
    useState<ReimbursementAccount | null>(null);
  const [transferClaim, setTransferClaim] = useState(false);
  const hasClaimedAll =
    reimbursementAccount !== null &&
    reimbursementAccount.reimbursed !== 0 &&
    reimbursementAccount.claimTransferred !== 0 &&
    reimbursementAccount.claimTransferred === reimbursementAccount.reimbursed;

  const resetAmountState = () => {
    setMintsForAvailableAmounts({});
    setTable([]);
    setReimbursementAccount(null);
  };
  const getReimbursementAccount = async (group) => {
    const reimbursementAccount = (
      await PublicKey.findProgramAddress(
        [
          Buffer.from("ReimbursementAccount"),
          group!.publicKey.toBuffer()!,
          wallet!.publicKey!.toBuffer(),
        ],
        reimbursementClient!.program.programId
      )
    )[0];
    const ra = await tryGetReimbursedAccounts(
      reimbursementClient,
      reimbursementAccount
    );
    setReimbursementAccount(ra);
  };
  const getCurrentGroup = async () => {
    const result = await reimbursementClient!.program.account.group.all();
    const group = result.find((group) => group.account.groupNum === GROUP_NUM);
    return group;
  };
  const getAccountAmountsInfo = async (walletPk: PublicKey) => {
    setAmountsLoading(true);
    try {
      const group = await getCurrentGroup();
      const config = Config.ids();
      const groupIds = config.getGroup(connection.cluster, groupName.name);

      const table = await tryDecodeTable(reimbursementClient, group);
      const balancesForUser = table.find((row) =>
        row.owner.equals(wallet.publicKey)
      )?.balances;
      if (balancesForUser) {
        const indexesToUse: number[] = [];
        for (let i in balancesForUser) {
          const isZero = balancesForUser[i].isZero();
          if (!isZero) {
            indexesToUse.push(Number(i));
          }
        }
        const tableInfo = [
          ...indexesToUse.map((idx) => {
            return {
              nativeAmount: balancesForUser[idx],
              mintPubKey: group!.account.mints[idx],
              index: idx,
            };
          }),
        ];
        const mintPks = tableInfo.map((x) => x.mintPubKey);
        const mints = await Promise.all(
          mintPks.map((x) => connection.current.getParsedAccountInfo(x))
        );
        const mintInfos = {};
        for (let i = 0; i < mintPks.length; i++) {
          const mintPk = mintPks[i];
          mintInfos[mintPk.toBase58()] = {
            decimals: (mints[i].value?.data as any).parsed.info.decimals,
            symbol: groupIds!.tokens.find(
              (x) => x.mintKey.toBase58() === mintPk.toBase58()
            )?.symbol,
          };
        }
        setMintsForAvailableAmounts(mintInfos);
        setTable(tableInfo);
        await getReimbursementAccount(group);
      } else {
        resetAmountState();
      }
    } catch (e) {
      notify({
        type: "error",
        title: "Failed to get account reimbursement amount",
        description: `${e}`,
      });
    }
    setAmountsLoading(false);
  };

  const getReimbursementAccountInstructions = async (
    group: any,
    reimbursementAccount: PublicKey
  ) => {
    const instructions: TransactionInstruction[] = [];
    const isExistingReimbursementAccount =
      await connection.current.getAccountInfo(reimbursementAccount);
    if (!isExistingReimbursementAccount) {
      const instruction = await reimbursementClient!.program.methods
        .createReimbursementAccount()
        .accounts({
          group: (group as any).publicKey,
          mangoAccountOwner: wallet.publicKey!,
          payer: wallet.publicKey!,
        })
        .instruction();
      instructions.push(instruction);
    }
    return instructions;
  };
  const getReimbursementInstructions = async (
    group: any,
    reimbursementAccountPk: PublicKey,
    transferClaim: boolean
  ) => {
    const instructions: TransactionInstruction[] = [];
    const owner = wallet.publicKey!;
    const table = await tryDecodeTable(reimbursementClient, group);
    for (const availableMintPk of Object.keys(mintsForAvailableAmounts)) {
      const mintIndex = group?.account.mints.findIndex(
        (x) => x.toBase58() === availableMintPk
      );
      const mintPk = group?.account.mints[mintIndex];
      const claimMintPk = group?.account.claimMints[mintIndex];
      const isWSolMint = mintPk.toBase58() === WSOL_MINT_PK.toBase58();
      const tableIndex = table.findIndex((row) =>
        row.owner.equals(wallet.publicKey)
      );
      const isTokenClaimed = reimbursementAccount
        ? await reimbursementClient!.reimbursed(reimbursementAccount, mintIndex)
        : false;

      if (!isTokenClaimed) {
        const [ataPk, daoAtaPk] = await Promise.all([
          Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
            TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
            mintPk, // mint
            owner, // owner
            true
          ),
          Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
            TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
            claimMintPk,
            group?.account.claimTransferDestination!,
            true
          ),
        ]);

        const isExistingAta = await isExistingTokenAccount(
          connection.current,
          ataPk
        );
        if (!isExistingAta) {
          instructions.push(
            Token.createAssociatedTokenAccountInstruction(
              ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
              TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
              mintPk, // mint
              ataPk, // ata
              owner, // owner of token account
              owner // fee payer
            )
          );
        }

        instructions.push(
          await reimbursementClient!.program.methods
            .reimburse(new BN(mintIndex), new BN(tableIndex), transferClaim)
            .accounts({
              group: (group as any).publicKey,
              vault: group?.account.vaults[mintIndex],
              tokenAccount: ataPk,
              claimMint: claimMintPk,
              claimMintTokenAccount: daoAtaPk,
              reimbursementAccount: reimbursementAccountPk,
              mangoAccountOwner: wallet.publicKey!,
              table: group?.account.table,
            })
            .instruction()
        );
        if (isWSolMint) {
          const unwrapAllSol = Token.createCloseAccountInstruction(
            TOKEN_PROGRAM_ID,
            ataPk!,
            wallet.publicKey!,
            wallet.publicKey!,
            []
          );
          instructions.push(unwrapAllSol);
        }
      }
    }

    return instructions;
  };
  const handleReimbursement = async (transferClaim: boolean) => {
    setTransferLoading(true);
    try {
      const group = await getCurrentGroup();
      const reimbursementAccount = (
        await PublicKey.findProgramAddress(
          [
            Buffer.from("ReimbursementAccount"),
            group!.publicKey.toBuffer()!,
            wallet!.publicKey!.toBuffer(),
          ],
          reimbursementClient!.program.programId
        )
      )[0];
      const accountInstructions = await getReimbursementAccountInstructions(
        group,
        reimbursementAccount
      );
      const reimburseInstructions = await getReimbursementInstructions(
        group,
        reimbursementAccount,
        transferClaim
      );
      const reimburseInstructionsChunks = chunks([...reimburseInstructions], 4);
      const instructionsToSend = [
        ...accountInstructions.map((x) => {
          return {
            instructionsSet: [x].map((j) => {
              return { transactionInstruction: j, signers: [] };
            }),
            sequenceType: SequenceType.Sequential,
          };
        }),
        ...reimburseInstructionsChunks.map((x) => {
          return {
            instructionsSet: x.map((j) => {
              return { transactionInstruction: j, signers: [] };
            }),
            sequenceType: SequenceType.Sequential,
          };
        }),
      ];

      await sendSignAndConfirmTransactions({
        connection: connection.current,
        wallet,
        transactionInstructions: instructionsToSend,
      });
      getReimbursementAccount(group);
      notify({
        title: "Successful reimbursement",
        type: "success",
      });
    } catch (e) {
      notify({
        title: "Something wen't wrong",
        description: `${e.message}`,
        txid: e?.txid,
        type: "error",
      });
    }
    setTransferLoading(false);
  };

  useEffect(() => {
    if (reimbursementClient) {
      if (wallet.publicKey) {
        getAccountAmountsInfo(wallet.publicKey);
      } else {
        resetAmountState();
      }
    }
  }, [reimbursementClient !== null, wallet.publicKey?.toBase58()]);

  return (
    <div className="flex min-h-[400px] flex-col items-center p-4 pt-[50px]">
      <div className="flex w-2/3 flex-col space-y-4 lg:w-1/2">
        <h2>Mango V3 Claim Funds</h2>
        <div className="text-th-fgd-3">
          On this interface you can redeem your Mango V3 protocol funds.
        </div>
        <div className="text-th-fgd-3">
          Mango has secured funds for users to redeem a settlement amount. You
          can connect your funds to see the amounts available for all mango
          accounts owned by the connected wallet.
        </div>
        <h3 className="">Connected wallet</h3>
        <div className="border border-th-bkg-3 p-4">
          <div className="flex items-center text-xs">
            {wallet.connected ? (
              <div className="flex flex-row items-center text-xs">
                <WalletIcon className="mr-3 w-5"></WalletIcon>
                {wallet.publicKey?.toBase58()}
              </div>
            ) : (
              <div className="flex w-full items-center justify-center">
                <WalletIcon className="mr-3 w-5"></WalletIcon> Please connect
                your wallet
              </div>
            )}
          </div>
        </div>
        <h3>Tokens</h3>
        {wallet.connected ? (
          <div className="border border-th-bkg-3 p-4">
            <div className="flex justify-center">
              {amountsLoading && <Loading></Loading>}
            </div>
            {!amountsLoading && (
              <div>
                <div className="mb-2 grid grid-cols-12 gap-3 border-b border-th-bkg-3 pb-2">
                  <div className="col-span-1"></div>
                  <div className="col-span-7">Token</div>
                  <div className="col-span-2">Amount</div>
                  <div className="col-span-2">Claimed</div>
                </div>
                {table.length ? (
                  <div className="space-y-3">
                    {table.map((x) => (
                      <TableRow
                        reimbursementAccount={reimbursementAccount}
                        key={x.mintPubKey.toBase58()}
                        mintsForAvailableAmounts={mintsForAvailableAmounts}
                        item={x}
                      ></TableRow>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-row">
                    <CurrencyDollarIcon className="mr-3 w-5"></CurrencyDollarIcon>{" "}
                    No tokens to reimburse for currently connected wallet
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="border border-th-bkg-3 p-4">
            <div className="mb-2 grid grid-cols-12 border-b border-th-bkg-3 pb-2">
              <div className="col-span-1"></div>
              <div className="col-span-7">Token</div>
              <div className="col-span-2">Amount</div>
            </div>
            <div className="space-y-3">
              <EmptyTableRows />
            </div>
          </div>
        )}

        <div className="flex flex-col justify-end space-x-4 pt-4">
          <div className="mt-6 flex flex-col">
            {/* {wallet.connected && (
              // <Checkbox
              //   disabled={transferLoading || !table.length || hasClaimedAll}
              //   checked={transferClaim}
              //   onChange={(e) => setTransferClaim(e.target.checked)}
              // >
              //   Transfer legal claim to dao
              // </Checkbox>
            )} */}
            {wallet.connected && table.length ? (
              <div className="text-xs text-th-fgd-3">
                <div className="text-sm">
                  Below is language explaining that you agree to assign your
                  claims to Mango Labs, LLC as well as release claims against
                  it, the DAO, and related entities and people. Mango Labs, LLC
                  reserves its rights to enforce the assigned claims, and it
                  intends to then transfer any proceeds, after costs, to the
                  DAO.
                </div>
                <div className="mt-4">
                  By clicking and accepting the funds . . ., I hereby
                  irrevocably sell, convey, transfer and assign to Mango Labs,
                  LLC all of my right, title and interest in, to and under all
                  claims arising out of or related to the loss of my tokens in
                  the October 2022 incident, including, without limitation, all
                  of my causes of action or other rights with respect to such
                  claims, all rights to receive any amounts or property or other
                  distribution in respect of or in connection with such claims,
                  and any and all proceeds of any of the foregoing (including
                  proceeds of proceeds). I further irrevocably and
                  unconditionally release all claims I may have against Mango
                  Labs, LLC, the Mango Decentralized Autonomous Entity, its core
                  contributors, and any of their agents, affiliates, officers,
                  employees, or principals related to this matter. This release
                  constitutes an express, informed, knowing and voluntary waiver
                  and relinquishment to the fullest extent permitted by law.
                </div>
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex justify-center">
            <Button
              onClick={() => handleReimbursement(transferClaim)}
              disabled={transferLoading || !table.length || hasClaimedAll}
              className="px-14 py-3 text-base"
            >
              {transferLoading ? <Loading></Loading> : "Claim tokens"}
            </Button>
          </div>
        </div>
    </div>
  </div>
  );
};

export default MainPage;

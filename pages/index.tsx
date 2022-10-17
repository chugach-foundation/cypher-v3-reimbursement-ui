import React, { useEffect, useState } from "react";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@project-serum/anchor";
import useMangoStore from "stores/useMangoStore";
import useReimbursementStore from "stores/useReimbursementStore";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import Button from "components/Button";
import { chunks, isExistingTokenAccount, toDecimalAmount } from "utils/tools";
import { TOKEN_PROGRAM_ID } from "@project-serum/serum/lib/token-instructions";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { sendSignAndConfirmTransactions } from "@blockworks-foundation/mangolana/lib/transactions";
import { SequenceType } from "@blockworks-foundation/mangolana/lib/globalTypes";
import { Config } from "@blockworks-foundation/mango-client";
import { notify } from "utils/notifications";
import Loading from "components/Loading";

const GROUP_NUM = 5;

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

type TableInfo = {
  nativeAmount: BN;
  mintPubKey: PublicKey;
};

type MintInfo = {
  decimals: number;
  symbol: string;
};

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
  const [claimTransferLoading, setClaimTransferLoading] = useState(false);
  const getAccountAmountsInfo = async (walletPk: PublicKey) => {
    setAmountsLoading(true);
    try {
      const result = await reimbursementClient.program.account.group.all();
      const group = result.find(
        (group) => group.account.groupNum === GROUP_NUM
      );
      const config = Config.ids();
      const groupIds = config.getGroup(connection.cluster, groupName.name);
      const table = await reimbursementClient.decodeTable(group);
      const balancesForUser = table.rows.find((row) =>
        row.owner.equals(walletPk)
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
              mintPubKey: group.account.mints[idx],
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
      } else {
        resetAmountState();
      }
    } catch (e) {
      notify({
        type: "error",
        title: "Failed to get account reimbursment amount",
        description: `${e}`,
      });
    }
    setAmountsLoading(false);
  };
  const resetAmountState = () => {
    setMintsForAvailableAmounts({});
    setTable([]);
  };

  const getReimbursementAccountInstructions = async (
    group: any,
    reimbursementAccount: PublicKey
  ) => {
    const instructions: TransactionInstruction[] = [];
    const isExistingReimbursementAccount =
      await connection.current.getAccountInfo(reimbursementAccount);
    if (!isExistingReimbursementAccount) {
      const instruction = await reimbursementClient.program.methods
        .createReimbursementAccount()
        .accounts({
          group: (group as any).publicKey,
          mangoAccountOwner: wallet.publicKey,
          payer: wallet.publicKey,
        })
        .instruction();
      instructions.push(instruction);
    }
    return instructions;
  };
  const getReimbursementInstructions = async (
    group: any,
    reimbursementAccount: PublicKey,
    transferClaim: boolean
  ) => {
    const instructions: TransactionInstruction[] = [];
    //TODO run in loop for every mint that account is eligible
    const owner = wallet.publicKey!;
    for (const availableMintPk of Object.keys(mintsForAvailableAmounts)) {
      const mintIndex = group?.account.mints.findIndex(
        (x) => x.toBase58() === availableMintPk
      );
      const mintPk = group?.account.mints[mintIndex];
      const claimMintPk = group?.account.claimMints[mintIndex];
      const ataPk = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
        TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
        mintPk, // mint
        owner, // owner
        true
      );
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
      const daoAtaPk = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
        TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
        claimMintPk,
        group?.account.claimTransferDestination!,
        true
      );
      const isExistingDaoAta = await isExistingTokenAccount(
        connection.current,
        daoAtaPk
      );
      if (!isExistingDaoAta) {
        instructions.push(
          Token.createAssociatedTokenAccountInstruction(
            ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
            TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
            claimMintPk, // mint
            daoAtaPk, // ata
            group?.account.claimTransferDestination, // owner of token account
            owner // fee payer
          )
        );
      }
      instructions.push(
        await reimbursementClient.program.methods
          .reimburse(new BN(mintIndex), new BN(mintIndex), transferClaim)
          .accounts({
            group: (group as any).publicKey,
            vault: group?.account.vaults[mintIndex],
            tokenAccount: ataPk,
            mint: mintPk,
            claimMint: claimMintPk,
            claimMintTokenAccount: daoAtaPk,
            reimbursementAccount,
            mangoAccountOwner: wallet.publicKey,
            table: group?.account.table,
          })
          .instruction()
      );
    }

    return instructions;
  };
  const handleReimbursement = async (transferClaim: boolean) => {
    if (transferClaim) {
      setClaimTransferLoading(true);
    } else {
      setTransferLoading(true);
    }
    try {
      const result = await reimbursementClient.program.account.group.all();
      const group = result.find(
        (group) => group.account.groupNum === GROUP_NUM
      );
      const reimbursementAccount = (
        await PublicKey.findProgramAddress(
          [
            Buffer.from("ReimbursementAccount"),
            group!.publicKey.toBuffer()!,
            wallet!.publicKey!.toBuffer(),
          ],
          reimbursementClient.program.programId
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
    if (transferClaim) {
      setClaimTransferLoading(false);
    } else {
      setTransferLoading(false);
    }
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
    <div className="min-h-[400px] p-4">
      {wallet.connected ? (
        <>
          <div className="pb-4">
            Connected wallet: {wallet.publicKey?.toBase58()}
          </div>
          {amountsLoading && <Loading></Loading>}
          {!amountsLoading && (
            <div className="mb-4">
              {table.length ? (
                <>
                  Amounts
                  <div className="mb-4">
                    {table.map((x) => (
                      <div key={x.mintPubKey.toBase58()}>
                        <div>{x.mintPubKey.toBase58()}</div>
                        <div>
                          {mintsForAvailableAmounts[x.mintPubKey.toBase58()]
                            ? toDecimalAmount(
                                x.nativeAmount,
                                mintsForAvailableAmounts[
                                  x.mintPubKey.toBase58()
                                ].decimals
                              )
                            : null}
                        </div>
                        <div>
                          {
                            mintsForAvailableAmounts[x.mintPubKey.toBase58()]
                              ?.symbol
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>No tokens to reimburse for currently connected wallet</>
              )}
            </div>
          )}
          <div className="space-x-4">
            <Button
              onClick={() => handleReimbursement(false)}
              disabled={transferLoading || !table.length}
            >
              {transferLoading ? <Loading></Loading> : "Reimburse"}
            </Button>
            <Button
              disabled={claimTransferLoading || !table.length}
              onClick={() => handleReimbursement(true)}
            >
              {claimTransferLoading ? (
                <Loading></Loading>
              ) : (
                "Transfer claim to dao"
              )}
            </Button>
          </div>
        </>
      ) : (
        <div>Please connect your wallet</div>
      )}
    </div>
  );
};

export default MainPage;

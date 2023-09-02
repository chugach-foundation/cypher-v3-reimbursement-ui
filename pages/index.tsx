import React, { useEffect, useState } from "react"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useWallet } from "@solana/wallet-adapter-react"
import { BN } from "@coral-xyz/anchor"
import useMangoStore, { TOKEN_CONFIGS } from "stores/useMangoStore"
import useReimbursementStore from "stores/useReimbursementStore"
import { PublicKey, TransactionInstruction } from "@solana/web3.js"
import Button from "components/Button"
import {
  chunks,
  isExistingTokenAccount,
  tryDecodeTable,
  tryGetReimbursedAccounts,
  WSOL_MINT_PK,
} from "utils/tools"
import { TOKEN_PROGRAM_ID } from "@project-serum/serum/lib/token-instructions"
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token"
import { sendSignAndConfirmTransactions } from "@blockworks-foundation/mangolana/lib/transactions"
import { SequenceType } from "@blockworks-foundation/mangolana/lib/globalTypes"
import { Config } from "@blockworks-foundation/mango-client"
import { notify } from "utils/notifications"
import Loading from "components/Loading"
import { WalletIcon } from "components"
import {
  CurrencyDollarIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/solid"
import TableRow from "components/reimbursement_page/TableRow"
import {
  MintInfo,
  ReimbursementAccount,
  TableInfo,
} from "components/reimbursement_page/types"
import { abbreviateAddress, sleep } from "utils"
import AgreementModal from "components/reimbursement_page/AgreementModal"
import Link from "next/link"



const GROUP_NUM = 0

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
  }
}

const MainPage = () => {
  const connection = useMangoStore((s) => s.connection)
  // const groupName =  useMangoStore((s) => s.selectedMangoGroup)
  let  wallet = useWallet()
  // wallet.publicKey = new PublicKey('any key to check');
  const { reimbursementClient } = useReimbursementStore()

  const [mintsForAvailableAmounts, setMintsForAvailableAmounts] = useState<{
    [key: string]: MintInfo
  }>({})
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false)
  const [table, setTable] = useState<TableInfo[]>([])
  const [amountsLoading, setAmountsLoading] = useState(false)
  const [transferLoading, setTransferLoading] = useState(false)
  const [reimbursementAccount, setReimbursementAccount] =
    useState<ReimbursementAccount | null>(null)
  const [toLowAmountInOneOfVaults, setToLowAmountInOneOfVaults] =
    useState(false)
  // const mangoAccounts = useMangoStore((s) => s.mangoAccounts)
  const [hasClaimedAll, setHasClaimedAll] = useState(false)
  // const hasClaimedAll =
  //   reimbursementAccount !== null &&
  //   reimbursementAccount.reimbursed !== 0 &&
  //   reimbursementAccount.claimTransferred !== 0 &&
  //   reimbursementAccount.claimTransferred === reimbursementAccount.reimbursed

  useEffect(() => {
    const checkClaimStatus = async () => {
      let allClaimed = false
      for (const item of table) {
        const isTokenClaimed = reimbursementClient!.reimbursed(
          reimbursementAccount,
          item.index
        )
        if (!isTokenClaimed) {
          allClaimed = false
          break
        } else {
          allClaimed = true
        }
      }
      setHasClaimedAll(allClaimed)
    }
    if (table && reimbursementClient && reimbursementAccount) {
      checkClaimStatus()
    }
  }, [table, reimbursementClient, reimbursementAccount])

  const resetAmountState = () => {
    setMintsForAvailableAmounts({})
    setTable([])
    setReimbursementAccount(null)
  }
  const handleSetReimbursementAccountWithDelay = async (group, delayMs) => {
    await sleep(delayMs)
    handleSetReimbursementAccount(group)
  }
  const handleSetReimbursementAccount = async (group) => {
    const reimbursementAccount = (
      await PublicKey.findProgramAddress(
        [
          Buffer.from("ReimbursementAccount"),
          group!.publicKey.toBuffer()!,
          wallet!.publicKey!.toBuffer(),
        ],
        reimbursementClient!.program.programId
      )
    )[0]
    const ra = await tryGetReimbursedAccounts(
      reimbursementClient,
      reimbursementAccount
    )
    setReimbursementAccount(ra)
  }
  const getCurrentGroup = async () => {
    const result = await reimbursementClient!.program.account.group.all()
    const group = result.find((group) => group.account.groupNum === GROUP_NUM)
    return group
  }
  const getAreAmountsInVaultHighEnough = async (tableInfo: TableInfo[]) => {
    const group = await getCurrentGroup()
    const vaultsPks = [...tableInfo.map((x) => group!.account.vaults[x.index]!)]
    const amounts = await Promise.all([
      ...vaultsPks.map((x) => connection.current.getTokenAccountBalance(x)),
    ])

    const areAmountsInVaultHighEnough = amounts.every(
      (x, idx) =>
        new BN(x.value.amount).cmp(tableInfo[idx].nativeAmount) === 0 ||
        new BN(x.value.amount).cmp(tableInfo[idx].nativeAmount) === 1
    )
    return areAmountsInVaultHighEnough
  }
  const getAccountAmountsInfo = async (walletPk: PublicKey) => {
    setAmountsLoading(true)
    try {
      const group = await getCurrentGroup()
      // const config = Config.ids()
      // const groupIds = config.getGroup(connection.cluster, groupName.name)
      const table = await tryDecodeTable(reimbursementClient, group)
      const balancesForUser = table.find((row) =>
        row.owner.equals(wallet.publicKey)
      )?.balances
      if (balancesForUser) {
        const tokenIndexesToUse: number[] = []
        for (let i in balancesForUser) {
          const isZero = balancesForUser[i].isZero()
          if (!isZero) {
            tokenIndexesToUse.push(Number(i))
          }
        }
        const tableInfo = [
          ...tokenIndexesToUse.map((idx) => {
            return {
              nativeAmount: balancesForUser[idx],
              mintPubKey: group!.account.mints[idx],
              index: idx,
            }
          }),
        ]
        const mintPks = tableInfo.map((x) => x.mintPubKey)
        const mints = await Promise.all(
          mintPks.map((x) => connection.current.getParsedAccountInfo(x))
        )
        const mintInfos = {}
        for (let i = 0; i < mintPks.length; i++) {
          const mintPk = mintPks[i]
          mintInfos[mintPk.toBase58()] = {
            decimals: (mints[i].value?.data as any).parsed.info.decimals,
            symbol: TOKEN_CONFIGS!.find(
              (x) => x.mintKey.toBase58() === mintPk.toBase58()
            )?.symbol,
          }
        }
        setMintsForAvailableAmounts(mintInfos)
        setTable(tableInfo)
        const areAmountsInVaultHighEnough =
          await getAreAmountsInVaultHighEnough(tableInfo)
        setToLowAmountInOneOfVaults(!areAmountsInVaultHighEnough)
        await handleSetReimbursementAccount(group)
      } else {
        resetAmountState()
      }
    } catch (e) {
      notify({
        type: "error",
        title: "Failed to get account reimbursement amount",
        description: `${e}`,
      })
    }
    setAmountsLoading(false)
  }

  const getReimbursementAccountInstructions = async (
    group: any,
    reimbursementAccount: PublicKey
  ) => {
    const instructions: TransactionInstruction[] = []
    const isExistingReimbursementAccount =
      await connection.current.getAccountInfo(reimbursementAccount)
    if (!isExistingReimbursementAccount) {
      const instruction = await reimbursementClient!.program.methods
        .createReimbursementAccount()
        .accounts({
          group: (group as any).publicKey,
          cypherAccountOwner: wallet.publicKey!,
          payer: wallet.publicKey!,
        })
        .instruction()
      instructions.push(instruction)
    }
    return instructions
  }
  const getReimbursementInstructions = async (
    group: any,
    reimbursementAccountPk: PublicKey,
    transferClaim: boolean
  ) => {
    const instructions: TransactionInstruction[] = []
    const owner = wallet.publicKey!
    const table = await tryDecodeTable(reimbursementClient, group)
    for (const availableMintPk of Object.keys(mintsForAvailableAmounts)) {
      const mintIndex = group?.account.mints.findIndex(
        (x) => x.toBase58() === availableMintPk
      )
      const mintPk = group?.account.mints[mintIndex]
      const claimMintPk = group?.account.claimMints[mintIndex]
      const isWSolMint = mintPk.toBase58() === WSOL_MINT_PK.toBase58()
      const tableIndex = table.findIndex((row) =>
        row.owner.equals(wallet.publicKey)
      )
      const isTokenClaimed = reimbursementAccount
        ? await reimbursementClient!.reimbursed(reimbursementAccount, mintIndex)
        : false

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
        ])

        const isExistingAta = await isExistingTokenAccount(
          connection.current,
          ataPk
        )
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
          )
        }

        instructions.push(
          await reimbursementClient!.program.methods
          // @ts-ignore
            .reimburse(new BN(mintIndex), new BN(tableIndex), transferClaim)
            .accounts({
              group: (group as any).publicKey,
              vault: group?.account.vaults[mintIndex],
              tokenAccount: ataPk,
              claimMint: claimMintPk,
              claimMintTokenAccount: daoAtaPk,
              reimbursementAccount: reimbursementAccountPk,
              cypherAccountOwner: wallet.publicKey!,
              table: group?.account.table,
            })
            .instruction()
        )
        if (isWSolMint) {
          const unwrapAllSol = Token.createCloseAccountInstruction(
            TOKEN_PROGRAM_ID,
            ataPk!,
            wallet.publicKey!,
            wallet.publicKey!,
            []
          )
          instructions.push(unwrapAllSol)
        }
      }
    }

    return instructions
  }
  const handleReimbursement = async (transferClaim: boolean) => {
    setTransferLoading(true)
    try {
      const group = await getCurrentGroup()
      const reimbursementAccount = (
        await PublicKey.findProgramAddress(
          [
            Buffer.from("ReimbursementAccount"),
            group!.publicKey.toBuffer()!,
            wallet!.publicKey!.toBuffer(),
          ],
          reimbursementClient!.program.programId
        )
      )[0]
      const accountInstructions = await getReimbursementAccountInstructions(
        group,
        reimbursementAccount
      )
      const reimburseInstructions = await getReimbursementInstructions(
        group,
        reimbursementAccount,
        transferClaim
      )
      const reimburseInstructionsChunks = chunks([...reimburseInstructions], 4)
      const instructionsToSend = [
        ...accountInstructions.map((x) => {
          return {
            instructionsSet: [x].map((j) => {
              return { transactionInstruction: j, signers: [] }
            }),
            sequenceType: SequenceType.Sequential,
          }
        }),
        ...reimburseInstructionsChunks.map((x) => {
          return {
            instructionsSet: x.map((j) => {
              return { transactionInstruction: j, signers: [] }
            }),
            sequenceType: SequenceType.Sequential,
          }
        }),
      ]
      const areAmountsInVaultHighEnough = await getAreAmountsInVaultHighEnough(
        table
      )
      if (!areAmountsInVaultHighEnough) {
        notify({
          title: "Token vault needs refilled",
          description:
            "To protect users funds, the vault with claimable tokens is refilled in batches. Please reach out on Discord or Twitter.",
          type: "error",
        })
        setTransferLoading(false)
        return
      }
      await sendSignAndConfirmTransactions({
        connection: connection.current,
        wallet,
        transactionInstructions: instructionsToSend,
      })
      handleSetReimbursementAccount(group)
      handleSetReimbursementAccountWithDelay(group, 10000)
      setIsAgreementModalOpen(false)
      notify({
        title: "Successful reimbursement",
        type: "success",
        txid: wallet.publicKey!.toString(),
      })
    } catch (e) {
      let isInsufficientFunds
      if (e?.txid) {
        const txResp = await tryPoolTx(e.txid)
        const logString = (txResp as any)?.meta?.logMessages?.toString()
        isInsufficientFunds =
          logString?.includes("Instruction: Reimburse") &&
          logString?.includes("Error: insufficient funds")
      }

      if (isInsufficientFunds) {
        notify({
          title: "Token vault needs refilled",
          description:
            "To protect users funds, the vault with claimable tokens is refilled in batches. Please reach out on Discord or Twitter.",
          txid: e?.txid,
          type: "error",
        })
      } else {
        notify({
          title: "Something wen't wrong",
          description: `${e?.message}.`,
          txid: e?.txid,
          type: "error",
        })
      }
    }
    setTransferLoading(false)
  }
  const tryPoolTx = async (txId) => {
    let interval: NodeJS.Timeout | null = null
    const poolPromise = () =>
      new Promise((resolve, reject) => {
        let maxCount = 10
        let runCount = 0

        interval = setInterval(async () => {
          runCount++
          try {
            const resp = await connection.current.getTransaction(txId, {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0,
            })
            if (resp) {
              resolve(resp)
              if (interval) {
                clearInterval(interval)
              }
            }
          } catch (e) {
            console.log(e)
          }
          if (maxCount <= runCount) {
            resolve(null)
            if (interval) {
              clearInterval(interval)
            }
          }
        }, 500)
      })
    const result = await poolPromise()
    if (interval) {
      clearInterval(interval)
    }
    return result
  }
  useEffect(() => {
    if (reimbursementClient) {
      if (wallet.publicKey) {
        getAccountAmountsInfo(wallet.publicKey)
      } else {
        resetAmountState()
      }
    }
  }, [reimbursementClient !== null, wallet.publicKey?.toBase58()])

  return (
    <div className="flex min-h-[400px] flex-col items-center p-4 pb-10 pt-[50px]">
      <div className="flex w-full flex-col md:w-4/5 lg:w-2/3 xl:w-1/2">
        <h1 className="mb-3">Cypher Exploit Recovery</h1>
        <p className="text-base text-th-fgd-3">
          Claim your first redemption package as outlined in the{" "}
          <a
            href="https://cypherlabs.notion.site/Loss-of-Funds-Resolution-4778af0828034445876a9e43e60b7dc1"
            target="_blank"
            rel="noopener noreferrer"
          >
            Loss of Funds Resolution
          </a>
          . If you have more than one Cypher Account for your connected wallet
          the recovery amounts are combined.
        </p>
        {wallet.connected ? (
          <div className="mb-4 mt-2 grid grid-cols-2 rounded-md bg-th-bkg-2 px-4 md:divide-x md:divide-th-bkg-3">
            <div className="col-span-2 pt-4 md:col-span-1 md:pb-4">
              <h3 className="mb-2 text-sm font-normal text-th-fgd-2">
                Connected Wallet:
              </h3>
              <div className="flex w-max flex-row items-center rounded-full bg-th-bkg-4 py-1 px-3 text-xs">
                <WalletIcon className="mr-2 h-4 w-4 text-th-green"></WalletIcon>
                {abbreviateAddress(wallet.publicKey!)}
              </div>
            </div>
            
            {/* {mangoAccounts?.length && table.length ? (
              <div className="col-span-2 py-4 md:col-span-1 md:pl-4">
                <h3 className="text-sm font-normal text-th-fgd-2">
                  {mangoAccounts.length} Mango Account
                  {mangoAccounts.length === 1 ? "" : "s"}:
                </h3>
                <div className="flex flex-wrap">
                  {mangoAccounts.map((mangoAccount) => {
                    return (
                      <div className="mt-2 mr-2 flex flex-row items-center rounded-full bg-th-bkg-4 py-1 px-3 text-xs">
                        <CurrencyDollarIcon className="mr-2 h-4 w-4 text-th-fgd-3"></CurrencyDollarIcon>
                        {abbreviateAddress(mangoAccount.publicKey!)}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null} */}

          </div>
        ) : null}
        <div className="flex items-center pb-4 pt-1">
          <h3 className="mr-3">Your Tokens:</h3>
        </div>
        {wallet.connected ? (
          <div>
            {amountsLoading && (
              <div className="flex justify-center py-10">
                <Loading></Loading>
              </div>
            )}

            {!amountsLoading && (
              <div>
                <div className="mb-2 grid grid-cols-12 gap-3 px-4 text-xs text-th-fgd-3">
                  <div className="col-span-5">Token</div>
                  <div className="col-span-4 text-right">Amount</div>
                  <div className="col-span-3 text-right">Claimed</div>
                </div>
                {table.length ? (
                  <div className="space-y-2">
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
                  <div className="flex items-center justify-center rounded-md border border-th-bkg-3 p-4">
                    <ExclamationCircleIcon className="mr-2 w-5"></ExclamationCircleIcon>{" "}
                    No tokens to recover for your connected wallet
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex w-full flex-col items-center justify-center rounded-lg border border-th-bkg-3 p-6">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-th-bkg-3">
              <WalletIcon className="h-6 w-6 text-th-primary"></WalletIcon>
            </div>
            <span className="text-center text-base text-th-fgd-3">
              Connect an eligible wallet
              <br />
              to view your claimable tokens
            </span>
          </div>
        )}
        <div className="flex flex-col justify-end">
          <div className="flex flex-col">
            {wallet.connected && table.length ? (
              <div className="pt-6 text-xs text-th-fgd-3">
                <div className="text-sm">
                  Below is language explaining that you agree to assign your
                  claims to DENALI LABS INC as well as release claims against
                  it, the DAO, and related entities and people. DENALI LABS INC
                  reserves its rights to enforce the assigned claims, and it
                  intends to then transfer any proceeds, after costs, to the
                  DAO.
                </div>
                <div className="mt-4">
                  By clicking and accepting the tokens, I recognize I am
                  receiving ±0.2619 cents on the dollar based on snapshot at 2 September 2023 21:26:29 GMT and hereby
                  irrevocably sell, convey, transfer and assign to DENALI LABS INC all of
                  my right, title and interest in, to and under all claims arising out of or
                  related to the loss of my tokens in the August 2023 incident, including,
                  without limitation, all of my causes of action or other rights with respect
                  to such claims, all rights to receive any amounts or property or other
                  distribution in respect of or in connection with such claims, and any and
                  all proceeds of any of the foregoing (including proceeds of proceeds).
                  I further irrevocably and unconditionally release all claims I may have
                  against DENALI LABS INC, OFFPISTE IO INC, the Cypher Decentralized
                  Autonomous Organization, its core contributors, and any of their agents,
                  affiliates, officers, employees, representatives, contractors, or principals
                  related to this matter. This release constitutes an express, informed, knowing
                  and voluntary waiver and relinquishment to the fullest extent permitted by law.
                </div>
              </div>
            ) : null}
          </div>
          <div className="mt-8 flex justify-center">
            {isAgreementModalOpen && (
              <AgreementModal
                isLoading={transferLoading}
                isOpen={isAgreementModalOpen}
                onClose={() => setIsAgreementModalOpen(false)}
                onAggree={() => {
                  handleReimbursement(true)
                }}
              ></AgreementModal>
            )}
            <Button
              onClick={() => setIsAgreementModalOpen(true)}
              disabled={
                transferLoading ||
                !table.length ||
                hasClaimedAll ||
                toLowAmountInOneOfVaults
              }
              className="h-14 w-48 text-lg"
            >
              {transferLoading ? <Loading></Loading> : "Claim Tokens"}
            </Button>
          </div>
          {toLowAmountInOneOfVaults && table?.length ? (
            <div className="mt-2 rounded p-4 text-th-red">
              There are not enough funds in the claimable token vault. To
              protect user's funds, the vaults with claimable tokens are
              refilled in batches. Please reach out on{" "}
              <Link href="https://discord.gg/mangomarkets">Discord</Link> or{" "}
              <Link href="https://twitter.com/mangomarkets">Twitter</Link>.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default MainPage

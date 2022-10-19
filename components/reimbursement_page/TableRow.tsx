import { CheckIcon, XIcon } from "@heroicons/react/solid"
import { useState, useEffect } from "react"
import useReimbursementStore from "stores/useReimbursementStore"
import { usdFormatter } from "utils"
import { toDecimalAmount } from "utils/tools"
import { MintInfo, ReimbursementAccount, TableInfo } from "./types"

const TableRow = ({
  mintsForAvailableAmounts,
  item,
  reimbursementAccount,
}: {
  mintsForAvailableAmounts: { [key: string]: MintInfo }
  item: TableInfo
  reimbursementAccount: ReimbursementAccount | null
}) => {
  const { reimbursementClient } = useReimbursementStore()
  const mintPk = item.mintPubKey
  const symbol = mintsForAvailableAmounts[mintPk.toBase58()]?.symbol
  const mintInfo = mintsForAvailableAmounts[mintPk.toBase58()]
  const [isClaimed, setIsClaimed] = useState(false)
  const handleSetIsReimbused = async () => {
    const isTokenClaimed = await reimbursementClient!.reimbursed(
      reimbursementAccount,
      item.index
    )
    setIsClaimed(isTokenClaimed)
  }
  useEffect(() => {
    if (reimbursementClient && reimbursementAccount) {
      handleSetIsReimbused()
    } else {
      setIsClaimed(false)
    }
  }, [
    reimbursementClient !== null,
    reimbursementAccount && JSON.stringify(reimbursementAccount),
  ])
  return (
    <div className="grid grid-cols-12 items-center gap-3 rounded-md border border-th-bkg-3 p-4">
      <div className="col-span-5 flex flex-col overflow-hidden">
        <div className="flex items-center text-sm text-th-fgd-1">
          <img
            className="mr-2 w-5"
            src={`assets/icons/${symbol.toLocaleLowerCase()}.svg`}
          ></img>
          {symbol}
        </div>
        {/* <div>{mintPk.toBase58()}</div> */}
      </div>

      <div className="col-span-4 text-right">
        {mintInfo
          ? usdFormatter(
              toDecimalAmount(item.nativeAmount, mintInfo.decimals),
              mintInfo.decimals,
              false
            )
          : null}
      </div>
      <div className="col-span-3 flex justify-end">
        {isClaimed ? (
          <CheckIcon className="w-5"></CheckIcon>
        ) : (
          <XIcon className="w-5"></XIcon>
        )}
      </div>
    </div>
  )
}

export default TableRow

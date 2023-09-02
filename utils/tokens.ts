import { TokenAccountLayout } from "@blockworks-foundation/mango-client"
import { PublicKey, Connection } from "@solana/web3.js"
import { AccountInfo } from "@solana/spl-token"
import { CLUSTER } from "stores/useMangoStore"

export interface TokenConfig {
  symbol: string
  mintKey: PublicKey
  decimals: number
  index: number
}

export const devnetTokens: TokenConfig[] = [
  {
    symbol: "SOL",
    mintKey: new PublicKey("So11111111111111111111111111111111111111112"),
    decimals: 9,
    index: 0,
  },
]
//RLB,RAY,ORCA,mSOL,SOL,BONK,UXD,jitoSOL,USDC,USDT,ETH,
export const mainnetTokens: TokenConfig[] = [
  {
    symbol: "RLB",
    mintKey: new PublicKey("RLBxxFkseAZ4RgJH3Sqn8jXxhmGoz9jWxDNJMh8pL7a"),
    decimals: 2,
    index: 0,
  },
  {
    symbol: "RAY",
    mintKey: new PublicKey("4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"),
    decimals: 6,
    index: 1,
  },
  {
    symbol: "ORCA",
    mintKey: new PublicKey("orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE"),
    decimals: 6,
    index: 2,
  },
  {
    symbol: "mSOL",
    mintKey: new PublicKey("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So"),
    decimals: 9,
    index: 3,
  },
  {
    symbol: "SOL",
    mintKey: new PublicKey("So11111111111111111111111111111111111111112"),
    decimals: 9,
    index: 4,
  },
  {
    symbol: "BONK",
    mintKey: new PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"),
    decimals: 5,
    index: 5,
  },
  {
    symbol: "UXD",
    mintKey: new PublicKey("7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT"),
    decimals: 6,
    index: 6,
  },
  {
    symbol: "jitoSOL",
    mintKey: new PublicKey("J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn"),
    decimals: 9,
    index: 7,
  },
  {
    symbol: "USDC",
    mintKey: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    decimals: 6,
    index: 8,
  },
  {
    symbol: "USDT",
    mintKey: new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
    decimals: 6,
    index: 9,
  },
  {
    symbol: "ETH",
    mintKey: new PublicKey("7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs"),
    decimals: 8,
    index: 10,
  },
]

export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
)
export const INVESTIN_PROGRAM_ID = new PublicKey(
  "HDFNSB26prLvBB2vvAoUoDEbQYbUxdUJztRcjozNakfz"
)

export type ProgramAccount<T> = {
  publicKey: PublicKey
  account: T
}

export function parseTokenAccountData(data: Buffer): {
  mint: PublicKey
  owner: PublicKey
  amount: number
} {
  const { mint, owner, amount } = TokenAccountLayout.decode(data)
  return {
    mint: new PublicKey(mint),
    owner: new PublicKey(owner),
    amount,
  }
}

export const coingeckoIds = [
  { id: "bitcoin", symbol: "BTC" },
  { id: "ethereum", symbol: "ETH" },
  { id: "solana", symbol: "SOL" },
  { id: "mango-markets", symbol: "MNGO" },
  { id: "binancecoin", symbol: "BNB" },
  { id: "serum", symbol: "SRM" },
  { id: "raydium", symbol: "RAY" },
  { id: "ftx-token", symbol: "FTT" },
  { id: "avalanche-2", symbol: "AVAX" },
  { id: "terra-luna", symbol: "LUNA" },
  { id: "cope", symbol: "COPE" },
  { id: "cardano", symbol: "ADA" },
  { id: "msol", symbol: "MSOL" },
  { id: "tether", symbol: "USDT" },
  { id: "stepn", symbol: "GMT" },
]

export async function getTokenAccountsByMint(
  connection: Connection,
  mint: string
): Promise<ProgramAccount<any>[]> {
  const results = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: [
      {
        dataSize: 165,
      },
      {
        memcmp: {
          offset: 0,
          bytes: mint,
        },
      },
    ],
  })
  return results.map((r) => {
    const publicKey = r.pubkey
    const data = Buffer.from(r.account.data)
    const account = parseTokenAccountData(data)
    return { publicKey, account }
  })
}

export const fetchNftsFromHolaplexIndexer = async (owner: PublicKey) => {
  const result = await fetch("https://graph.holaplex.com/v1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        query nfts($owners: [PublicKey!]) {
            nfts(
              owners: $owners,
               limit: 10000, offset: 0) {
              name
              mintAddress
              address
              image
              updateAuthorityAddress
              collection {
                creators {
                  verified
                  address
                }
                mintAddress
              }

            }

        }
      `,
      variables: {
        owners: [owner.toBase58()],
      },
    }),
  })

  const body = await result.json()
  return body.data
}

export type TokenProgramAccount<T> = {
  publicKey: PublicKey
  account: T
}

export type TokenAccount = AccountInfo

import create, { State } from "zustand";
import { CypherV3ReimbursementClient } from "@chugach-foundation/cypher-v3-reimbursement-lib";
import { Connection } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { AnchorProvider } from '@coral-xyz/anchor'
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

interface reimbursementStore extends State {
  reimbursementClient: CypherV3ReimbursementClient | null;
  setClient: (connection: Connection, wallet: WalletContextState) => void;
}

const useReimbursementStore = create<reimbursementStore>((set, _get) => ({
  reimbursementClient: null,
  setClient: (connection: Connection, wallet: WalletContextState) => {
    const options = AnchorProvider.defaultOptions();
    const provider = new AnchorProvider(
      connection,
      // @ts-ignore
      wallet as unknown as NodeWallet,
      options
    );
    const cypherV3ReimbursementClient = new CypherV3ReimbursementClient(provider);
    console.log(cypherV3ReimbursementClient);
    set((s) => {
      s.reimbursementClient = cypherV3ReimbursementClient;
    });
  },
}));

export default useReimbursementStore;

import create, { State } from "zustand";
import { MangoV3ReimbursementClient } from "@blockworks-foundation/mango-v3-reimbursement-lib/dist";
import { Connection } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";

interface reimbursementStore extends State {
  reimbursementClient: MangoV3ReimbursementClient | null;
  setClient: (connection: Connection, wallet: WalletContextState) => void;
}

const useReimbursementStore = create<reimbursementStore>((set, _get) => ({
  reimbursementClient: null,
  setClient: (connection: Connection, wallet: WalletContextState) => {
    const options = AnchorProvider.defaultOptions();
    const provider = new AnchorProvider(
      connection,
      wallet as unknown as NodeWallet,
      options
    );
    const mangoV3ReimbursementClient = new MangoV3ReimbursementClient(provider);
    console.log(mangoV3ReimbursementClient);
    set((s) => {
      s.reimbursementClient = mangoV3ReimbursementClient;
    });
  },
}));

export default useReimbursementStore;

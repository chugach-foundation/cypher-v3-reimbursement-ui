import { ConnectWalletButton } from "./ConnectWalletButton";
import GlobalNotification from "./GlobalNotification";
import { useCallback, useState } from "react";
import AccountsModal from "./AccountsModal";
import { useRouter } from "next/router";
import FavoritesShortcutBar from "./FavoritesShortcutBar";
import SettingsModal from "./SettingsModal";
import { useTranslation } from "next-i18next";
import { useWallet } from "@solana/wallet-adapter-react";
import useMangoStore from "stores/useMangoStore";
import { Transition } from "@headlessui/react";

const Layout = ({ children }) => {
  const router = useRouter();
  const { pathname } = router;

  return (
    <div className={`flex-grow bg-th-bkg-1 text-th-fgd-1 transition-all`}>
      <div className="flex">
        <div className="w-full overflow-hidden">
          <GlobalNotification />
          <TopBar />
          {pathname === "/" ? <FavoritesShortcutBar /> : null}
          <div className="h-full">{children}</div>
        </div>
      </div>
    </div>
  );
};

const TopBar = () => {
  const { t } = useTranslation(["common", "delegate"]);
  const { publicKey } = useWallet();
  const mangoAccount = useMangoStore((s) => s.selectedMangoAccount.current);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const handleCloseAccounts = useCallback(() => {
    setShowAccountsModal(false);
  }, []);

  const canWithdraw =
    mangoAccount?.owner && publicKey
      ? mangoAccount?.owner?.equals(publicKey)
      : false;

  return (
    <>
      <div className="flex h-14 items-center justify-between border-b border-th-bkg-3 bg-th-bkg-1 px-6">
        <div className="flex items-center justify-center">
          <div className={`flex flex-shrink-0 cursor-pointer items-center`}>
            <img
              className={`h-8 w-auto`}
              src="/assets/icons/logo.svg"
              alt="next"
            />
            <Transition
              show={true}
              appear={true}
              enter="transition-all ease-in duration-300"
              enterFrom="opacity-50"
              enterTo="opacity-100"
              leave="transition ease-out duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <span className="ml-2 text-lg font-bold text-th-fgd-1">
                Mango
              </span>
            </Transition>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <ConnectWalletButton />
        </div>
      </div>
      {showAccountsModal ? (
        <AccountsModal
          onClose={handleCloseAccounts}
          isOpen={showAccountsModal}
        />
      ) : null}
      {showSettingsModal ? (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          isOpen={showSettingsModal}
        />
      ) : null}
    </>
  );
};

export default Layout;

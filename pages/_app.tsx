import Head from "next/head";
import { ThemeProvider } from "next-themes";
import "../node_modules/react-grid-layout/css/styles.css";
import "../node_modules/react-resizable/css/styles.css";
import "intro.js/introjs.css";
import "../styles/index.css";
import "react-nice-dates/build/style.css";
import "../styles/datepicker.css";
import useHydrateStore from "../hooks/useHydrateStore";
import Notifications from "../components/Notification";
import { ViewportProvider } from "../hooks/useViewport";
import { appWithTranslation } from "next-i18next";
import ErrorBoundary from "../components/ErrorBoundary";
import { useMemo } from "react";

import { WalletProvider, WalletListener } from "components/WalletAdapter";
import {
  BackpackWalletAdapter,
  CoinbaseWalletAdapter,
  ExodusWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  SolletWalletAdapter,
  SlopeWalletAdapter,
  BitpieWalletAdapter,
  GlowWalletAdapter,
  WalletConnectWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { HuobiWalletAdapter } from "@solana/wallet-adapter-huobi";
import Layout from "components/Layout";
import { CLUSTER } from "stores/useMangoStore";

const MangoStoreUpdater = () => {
  useHydrateStore();
  return null;
};

const PageTitle = () => {
  return (
    <Head>
      <title>Mango Markets</title>
    </Head>
  );
};

function App({ Component, pageProps }) {
  const wallets = useMemo(
    () => [
      new BackpackWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new ExodusWalletAdapter(),
      new SolletWalletAdapter(),
      new GlowWalletAdapter(),
      new SlopeWalletAdapter(),
      new BitpieWalletAdapter(),
      new HuobiWalletAdapter(),
      new WalletConnectWalletAdapter({
        network:
          CLUSTER === "mainnet"
            ? WalletAdapterNetwork.Mainnet
            : WalletAdapterNetwork.Devnet,
        options: {
          projectId: "f3d38b197d7039c03c345f82ed68ef9b",
          metadata: {
            name: "Mango Markets",
            description: "Mango Markets",
            url: "https://trade.mango.markets/",
            icons: ["https://trade.mango.markets/assets/icons/logo.svg"],
          },
        },
      }),
    ],
    []
  );

  return (
    <>
      <Head>
        <title>Mango Markets</title>
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="Mango Markets" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="keywords"
          content="Mango Markets, Serum, SRM, Serum DEX, DEFI, Decentralized Finance, Decentralised Finance, Crypto, ERC20, Ethereum, Decentralize, Solana, SOL, SPL, Cross-Chain, Trading, Fastest, Fast, SerumBTC, SerumUSD, SRM Tokens, SPL Tokens"
        />
        <meta
          name="description"
          content="Mango Markets - Decentralised, cross-margin trading up to 10x leverage with lightning speed and near-zero fees."
        />
        <link
          rel="apple-touch-icon"
          sizes="192x192"
          href="/apple-touch-icon.png"
        />
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Mango Markets" />
        <meta
          name="twitter:description"
          content="Mango Markets - Decentralised, cross-margin trading up to 20x leverage with lightning speed and near-zero fees."
        />
        <meta
          name="twitter:image"
          content="https://www.mango.markets/socials/twitter-image-1200x600.png?34567878"
        />
        <meta name="google" content="notranslate" />
        <link rel="manifest" href="/manifest.json"></link>
      </Head>
      <ThemeProvider defaultTheme="Mango">
        <ErrorBoundary>
          <WalletProvider wallets={wallets}>
            <PageTitle />
            <MangoStoreUpdater />
            <WalletListener />
            <ViewportProvider>
              <div className="min-h-screen bg-th-bkg-1">
                <ErrorBoundary>
                  <Layout>
                    <Component {...pageProps} />
                  </Layout>
                </ErrorBoundary>
              </div>

              <Notifications />
            </ViewportProvider>
          </WalletProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </>
  );
}

export default appWithTranslation(App);

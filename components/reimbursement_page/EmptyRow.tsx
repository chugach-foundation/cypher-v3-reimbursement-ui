const EmptyTableRows = () => {
  const TOKENS = [
    "BTC",
    "ETH",
    "USDC",
    "MNGO",
    "SOL",
    "SRM",
    "FTT",
    "RAY",
    "BNB",
    "GMT",
    "AVAX",
    "USDT",
    "MSOL",
  ];
  return (
    <>
      {TOKENS.map((x) => {
        return (
          <div key={x} className="grid grid-cols-12 items-center gap-3 text-xs">
            <div className="col-span-1">
              <img
                className="w-5"
                src={`assets/icons/${x.toLocaleLowerCase()}.svg`}
              ></img>
            </div>
            <div className="col-span-7">{x}</div>
            <div className="col-span-2">-</div>
          </div>
        );
      })}
    </>
  );
};
export default EmptyTableRows;

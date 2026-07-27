import { createContext, useCallback, useContext, useMemo } from "react";

import { STORAGE_KEYS } from "../utils/storageKeys";
import { usePersistentState } from "../utils/usePersistentState";

// The money that moves between the three savings pages.
//
// Piggy bank -> wallet -> account is a one-way flow, and each page owns one
// balance. Keeping them in a single context is what makes a transfer a
// transfer: the amount has to leave one place to arrive at the other, and
// there is exactly one writer per balance so the two halves cannot disagree.

const MoneyContext = createContext(undefined);

const round2 = (n) => Math.round(n * 100) / 100;

export const DEFAULT_DEPOSITS = [
  { id: "drone", label: "קרן רחפן", target: 4500, icon: "wind" },
  { id: "travel", label: "קרן נסיעות", target: 1200, icon: "map" },
];

export function MoneyProvider({ children }) {
  const [piggy, setPiggy] = usePersistentState(STORAGE_KEYS.moneyPiggy, 0);
  const [wallet, setWallet] = usePersistentState(STORAGE_KEYS.moneyWallet, 0);
  const [liquid, setLiquid] = usePersistentState(STORAGE_KEYS.moneyLiquid, 0);
  const [deposits, setDeposits] = usePersistentState(STORAGE_KEYS.moneyDeposits, DEFAULT_DEPOSITS);
  const [ledger, setLedger] = usePersistentState(STORAGE_KEYS.moneyLedger, []);

  const log = useCallback(
    (entry) => setLedger((l) => [{ at: Date.now(), ...entry }, ...(l || [])].slice(0, 60)),
    [setLedger]
  );

  const addToPiggy = useCallback(
    (amount) => {
      setPiggy((p) => round2((p || 0) + amount));
      log({ kind: "coin", amount });
    },
    [setPiggy, log]
  );

  const addToWallet = useCallback(
    (amount) => {
      setWallet((w) => round2((w || 0) + amount));
      log({ kind: "note", amount });
    },
    [setWallet, log]
  );

  // Transfers move the whole balance and return what moved, so the caller can
  // show it. Returning 0 means nothing happened — the UI uses that to warn
  // instead of animating an empty transfer.
  const piggyToWallet = useCallback(() => {
    const amount = round2(piggy || 0);
    if (amount <= 0) return 0;
    setPiggy(0);
    setWallet((w) => round2((w || 0) + amount));
    log({ kind: "piggy-to-wallet", amount });
    return amount;
  }, [piggy, setPiggy, setWallet, log]);

  const walletToAccount = useCallback(
    (amount) => {
      const moving = round2(Math.min(amount, wallet || 0));
      if (moving <= 0) return 0;
      setWallet((w) => round2((w || 0) - moving));
      setLiquid((l) => round2((l || 0) + moving));
      log({ kind: "wallet-to-account", amount: moving });
      return moving;
    },
    [wallet, setWallet, setLiquid, log]
  );

  const toDeposit = useCallback(
    (depositId, amount) => {
      const moving = round2(Math.min(amount, liquid || 0));
      if (moving <= 0) return 0;
      setLiquid((l) => round2((l || 0) - moving));
      setDeposits((list) =>
        (list || []).map((d) => (d.id === depositId ? { ...d, saved: round2((d.saved || 0) + moving) } : d))
      );
      log({ kind: "deposit", amount: moving, depositId });
      return moving;
    },
    [liquid, setLiquid, setDeposits, log]
  );

  const fromDeposit = useCallback(
    (depositId, amount) => {
      const deposit = (deposits || []).find((d) => d.id === depositId);
      const moving = round2(Math.min(amount, deposit?.saved || 0));
      if (moving <= 0) return 0;
      setDeposits((list) =>
        (list || []).map((d) => (d.id === depositId ? { ...d, saved: round2((d.saved || 0) - moving) } : d))
      );
      setLiquid((l) => round2((l || 0) + moving));
      log({ kind: "withdraw", amount: moving, depositId });
      return moving;
    },
    [deposits, setDeposits, setLiquid, log]
  );

  const addDeposit = useCallback(
    (label, target) => {
      const id = `d-${Date.now()}`;
      setDeposits((list) => [...(list || []), { id, label, target, saved: 0, icon: "target" }]);
      return id;
    },
    [setDeposits]
  );

  const removeDeposit = useCallback(
    (depositId) => {
      // Returning the money rather than deleting it: a fund you close should
      // give its contents back, not evaporate them.
      const deposit = (deposits || []).find((d) => d.id === depositId);
      if (deposit?.saved) setLiquid((l) => round2((l || 0) + deposit.saved));
      setDeposits((list) => (list || []).filter((d) => d.id !== depositId));
    },
    [deposits, setDeposits, setLiquid]
  );

  const totalDeposited = useMemo(
    () => round2((deposits || []).reduce((sum, d) => sum + (d.saved || 0), 0)),
    [deposits]
  );

  const value = useMemo(
    () => ({
      piggy: piggy || 0,
      wallet: wallet || 0,
      liquid: liquid || 0,
      deposits: deposits || [],
      ledger: ledger || [],
      totalDeposited,
      netWorth: round2((piggy || 0) + (wallet || 0) + (liquid || 0) + totalDeposited),
      addToPiggy,
      addToWallet,
      piggyToWallet,
      walletToAccount,
      toDeposit,
      fromDeposit,
      addDeposit,
      removeDeposit,
    }),
    [
      piggy, wallet, liquid, deposits, ledger, totalDeposited,
      addToPiggy, addToWallet, piggyToWallet, walletToAccount,
      toDeposit, fromDeposit, addDeposit, removeDeposit,
    ]
  );

  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export function useMoney() {
  const ctx = useContext(MoneyContext);
  if (ctx === undefined) throw new Error("useMoney must be used within a MoneyProvider");
  return ctx;
}

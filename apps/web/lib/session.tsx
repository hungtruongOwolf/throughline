"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { STAFF, type AgentRun, type StaffMember } from "@throughline/shared";
import { RUNTIME_URL } from "./runtime";

// ---- who is signed in --------------------------------------------------------------------

const USER_KEY = "tl_user";

interface UserState {
  user: StaffMember | undefined;
  ready: boolean;
  signIn: (id: string) => void;
  signOut: () => void;
}

const UserContext = createContext<UserState>({
  user: undefined,
  ready: false,
  signIn: () => undefined,
  signOut: () => undefined,
});

function readUser(): string | undefined {
  try {
    return window.localStorage.getItem(USER_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | undefined>();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setId(readUser());
    setReady(true);
  }, []);
  const signIn = useCallback((next: string) => {
    setId(next);
    try {
      window.localStorage.setItem(USER_KEY, next);
    } catch {
      // Private windows: the choice lasts for this tab only.
    }
  }, []);
  const signOut = useCallback(() => {
    setId(undefined);
    try {
      window.localStorage.removeItem(USER_KEY);
    } catch {
      // Nothing stored.
    }
  }, []);
  const value = useMemo(
    () => ({ user: STAFF.find((s) => s.id === id), ready, signIn, signOut }),
    [id, ready, signIn, signOut],
  );
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);

// ---- the live stream ---------------------------------------------------------------------

interface StreamState {
  /** Bumps (at most every 600 ms) whenever anything happens; screens refetch on it. */
  version: number;
  /** The most recent agent runs, newest first. */
  runs: AgentRun[];
  connected: boolean;
}

const StreamContext = createContext<StreamState>({ version: 0, runs: [], connected: false });

/** One EventSource per tab: domain events and agent runs from the runtime (SSE). */
export function StreamProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [connected, setConnected] = useState(false);
  const pending = useRef<number | undefined>(undefined);
  useEffect(() => {
    const bump = () => {
      if (pending.current !== undefined) return;
      pending.current = window.setTimeout(() => {
        pending.current = undefined;
        setVersion((v) => v + 1);
      }, 600);
    };
    const source = new EventSource(`${RUNTIME_URL}/events/stream`);
    source.addEventListener("hello", () => setConnected(true));
    source.addEventListener("domain", bump);
    source.addEventListener("run", (e) => {
      try {
        const run = JSON.parse((e as MessageEvent<string>).data) as AgentRun;
        if (run.agent === "sensing" && run.outcome === "applied") return;
        setRuns((list) => [run, ...list].slice(0, 30));
        bump();
      } catch {
        // A malformed frame is skipped.
      }
    });
    source.onerror = () => setConnected(false);
    return () => {
      source.close();
      if (pending.current !== undefined) window.clearTimeout(pending.current);
    };
  }, []);
  const value = useMemo(() => ({ version, runs, connected }), [version, runs, connected]);
  return <StreamContext.Provider value={value}>{children}</StreamContext.Provider>;
}

export const useStream = () => useContext(StreamContext);

/** Loads with `load` and reloads whenever the stream reports a change. */
export function useLive<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const { version } = useStream();
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  const loader = useCallback(load, deps);
  useEffect(() => {
    let alive = true;
    loader()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(false);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [loader, version, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload };
}

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
import { STAFF, type AgentRun, type Hospital, type StaffMember } from "@throughline/shared";
import { onStream, RUNTIME_URL } from "./runtime";

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
      }, 1200);
    };
    const stop = onStream((name, data) => {
      if (name === "hello") setConnected(true);
      if (name === "error") setConnected(false);
      if (name === "domain") {
        // Queue counts move every simulated minute; screens that show them poll on their own.
        if (data.includes('"type":"QueueStateUpdated"')) return;
        bump();
      }
      if (name === "run") {
        try {
          const run = JSON.parse(data) as AgentRun;
          if (run.agent === "sensing" && run.outcome === "applied") return;
          setRuns((list) => [run, ...list].slice(0, 30));
          bump();
        } catch {
          // A malformed frame is skipped.
        }
      }
    });
    return () => {
      stop();
      if (pending.current !== undefined) window.clearTimeout(pending.current);
    };
  }, []);
  const value = useMemo(() => ({ version, runs, connected }), [version, runs, connected]);
  return <StreamContext.Provider value={value}>{children}</StreamContext.Provider>;
}

export const useStream = () => useContext(StreamContext);

/** Last answer per loader, so a screen you come back to shows at once and refreshes behind. */
const LIVE_CACHE = new Map<string, unknown>();

/** Loads with `load` and reloads whenever the stream reports a change. */
export function useLive<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const { version } = useStream();
  const key = `${load.toString()}|${JSON.stringify(deps)}`;
  const [data, setData] = useState<T | undefined>(() => LIVE_CACHE.get(key) as T | undefined);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  const loader = useCallback(load, deps);
  useEffect(() => {
    let alive = true;
    if (LIVE_CACHE.has(key)) setData(LIVE_CACHE.get(key) as T);
    loader()
      .then((d) => {
        LIVE_CACHE.set(key, d);
        if (!alive) return;
        setData(d);
        setError(false);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
    // the cache key changes exactly when the loader does
  }, [loader, version, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload };
}

// ---- the hospital this workspace serves --------------------------------------------------

const NO_HOSPITAL: Hospital = {
  id: "",
  name: "Your hospital",
  short_name: "Your hospital",
  city: "",
  specialties: [],
  phone: "",
  phone_href: "",
  payers: [],
  status: "live",
};

interface Hospitals {
  hospital: Hospital;
  list: Hospital[];
  /** Switches the workspace; remembered on this device. */
  choose: (id: string) => void;
  /** Reloads the list, such as after a hospital is added. */
  refresh: () => void;
}

const HospitalContext = createContext<Hospitals>({
  hospital: NO_HOSPITAL,
  list: [],
  choose: () => undefined,
  refresh: () => undefined,
});
const PICK = "throughline.hospital";

/** Loads the hospitals once and keeps the chosen one; every screen reads it from here. */
export function HospitalProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Hospital[]>([]);
  const [picked, setPicked] = useState<string | undefined>();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("hospital");
      setPicked(fromUrl ?? window.localStorage.getItem(PICK) ?? undefined);
    } catch {
      // storage can be off; the first hospital is the default
    }
  }, []);
  useEffect(() => {
    void fetch(`${RUNTIME_URL}/api/hospitals`)
      .then((r) => (r.ok ? (r.json() as Promise<Hospital[]>) : []))
      .then(setList)
      .catch(() => undefined);
  }, [tick]);
  const choose = useCallback((id: string) => {
    setPicked(id);
    try {
      window.localStorage.setItem(PICK, id);
    } catch {
      // the choice still holds for this visit
    }
  }, []);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const hospital = list.find((h) => h.id === picked) ?? list[0] ?? NO_HOSPITAL;
  const value = useMemo(
    () => ({ hospital, list, choose, refresh }),
    [hospital, list, choose, refresh],
  );
  return <HospitalContext.Provider value={value}>{children}</HospitalContext.Provider>;
}

export const useHospital = () => useContext(HospitalContext).hospital;
export const useHospitals = () => useContext(HospitalContext);

/**
 * Patient plans and the building map belong to the hospital that holds the journey, whichever
 * hospital a staff member has open: inside, every name and phone number is that hospital's.
 */
export function LiveWorkspace({ children }: { children: ReactNode }) {
  const outer = useContext(HospitalContext);
  const live = outer.list.find((h) => h.forecasts) ?? outer.list[0] ?? outer.hospital;
  const value = useMemo(() => ({ ...outer, hospital: live }), [outer, live]);
  return <HospitalContext.Provider value={value}>{children}</HospitalContext.Provider>;
}

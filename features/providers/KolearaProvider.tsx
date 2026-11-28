"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ConvexProvider,
  ConvexReactClient,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { LanguageCode, ServiceResult, User } from "@/lib/contracts";

const SESSION_STORAGE_KEY = "koleara_session_token_v2";
const CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210";

let browserConvexClient: ConvexReactClient | null = null;

function getOrCreateConvexClient(): ConvexReactClient {
  if (!browserConvexClient) {
    browserConvexClient = new ConvexReactClient(CONVEX_URL);
  }
  return browserConvexClient;
}

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)?.trim();
    return raw || null;
  } catch {
    return null;
  }
}

const sessionListeners = new Set<() => void>();

function notifySessionListeners(): void {
  for (const listener of sessionListeners) {
    listener();
  }
}

function subscribeSessionToken(listener: () => void): () => void {
  sessionListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SESSION_STORAGE_KEY) {
      listener();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    sessionListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function writeStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
  notifySessionListeners();
}

export type RequestOtpResult = ServiceResult<{
  email: string;
  expiresAt: number;
  delivery: "resend" | "demo";
  demoOtp?: string;
}>;

export type SessionAuthContextValue = {
  hydrated: boolean;
  sessionToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTutor: boolean;
  needsOnboarding: boolean;
  requestEmailOtp: (args: {
    email: string;
    mode: "login" | "signup";
    name?: string;
  }) => Promise<RequestOtpResult>;
  verifyEmailOtp: (args: {
    email: string;
    otp: string;
    mode: "login" | "signup";
    name?: string;
  }) => Promise<ServiceResult<{ user: User; sessionToken: string; expiresAt: number }>>;
  logout: () => Promise<void>;
  updateOnboardingProfile: (args: {
    name?: string;
    department: string;
    cohortYear?: number;
    preferredLanguage: LanguageCode;
    whatsapp: string;
  }) => Promise<ServiceResult<User>>;
  uploadFile: (
    file: File
  ) => Promise<ServiceResult<{ storageId: Id<"_storage">; fileName: string }>>;
};

const SessionAuthContext = createContext<SessionAuthContextValue | null>(null);

function SessionAuthInner({ children }: { children: ReactNode }) {
  const tokenHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const sessionToken = useSyncExternalStore(
    subscribeSessionToken,
    readStoredToken,
    () => null
  );
  const seedAttemptedRef = useRef(false);

  const courses = useQuery(api.tutors.listCourses, {});
  const ensureSeeded = useMutation(api.seed.ensureSeeded);

  const meQuery = useQuery(
    api.auth.getMe,
    tokenHydrated && sessionToken ? { sessionToken } : "skip"
  );

  const requestEmailOtpAction = useAction(api.auth.requestEmailOtp);
  const verifyEmailOtpMutation = useMutation(api.auth.verifyEmailOtp);
  const logoutMutation = useMutation(api.auth.logout);
  const updateOnboardingMutation = useMutation(api.auth.updateOnboardingProfile);
  const generateUploadUrlMutation = useMutation(api.storage.generateUploadUrl);

  // Ensure initial course/catalog seed exists on fresh Convex deployment
  useEffect(() => {
    if (courses !== undefined && courses.length === 0 && !seedAttemptedRef.current) {
      seedAttemptedRef.current = true;
      ensureSeeded({}).catch(() => {
        seedAttemptedRef.current = false;
      });
    }
  }, [courses, ensureSeeded]);

  // Clear expired/revoked session token automatically from external storage
  useEffect(() => {
    if (tokenHydrated && sessionToken && meQuery === null) {
      writeStoredToken(null);
    }
  }, [tokenHydrated, sessionToken, meQuery]);

  const hydrated =
    tokenHydrated && (!sessionToken || meQuery !== undefined);
  const user: User | null = sessionToken ? (meQuery ?? null) : null;

  const requestEmailOtp = useCallback(
    async (args: { email: string; mode: "login" | "signup"; name?: string }) => {
      try {
        return await requestEmailOtpAction(args);
      } catch (error) {
        return {
          ok: false as const,
          code: "NETWORK_ERROR",
          error:
            error instanceof Error
              ? error.message
              : "Gagal menghubungi server autentikasi.",
        };
      }
    },
    [requestEmailOtpAction]
  );

  const verifyEmailOtp = useCallback(
    async (args: {
      email: string;
      otp: string;
      mode: "login" | "signup";
      name?: string;
    }) => {
      try {
        const res = await verifyEmailOtpMutation(args);
        if (res.ok) {
          writeStoredToken(res.data.sessionToken);
        }
        return res;
      } catch (error) {
        return {
          ok: false as const,
          code: "NETWORK_ERROR",
          error:
            error instanceof Error
              ? error.message
              : "Gagal memverifikasi kode OTP.",
        };
      }
    },
    [verifyEmailOtpMutation]
  );

  const logout = useCallback(async () => {
    const activeToken = sessionToken;
    writeStoredToken(null);
    if (activeToken) {
      await logoutMutation({ sessionToken: activeToken }).catch(() => {});
    }
  }, [sessionToken, logoutMutation]);

  const updateOnboardingProfile = useCallback(
    async (args: {
      name?: string;
      department: string;
      cohortYear?: number;
      preferredLanguage: LanguageCode;
      whatsapp: string;
    }) => {
      if (!sessionToken) {
        return {
          ok: false as const,
          code: "UNAUTHORIZED",
          error: "Sesi login tidak ditemukan.",
        };
      }
      return await updateOnboardingMutation({
        sessionToken,
        ...args,
      });
    },
    [sessionToken, updateOnboardingMutation]
  );

  const uploadFile = useCallback(
    async (
      file: File
    ): Promise<ServiceResult<{ storageId: Id<"_storage">; fileName: string }>> => {
      if (!sessionToken) {
        return {
          ok: false,
          code: "UNAUTHORIZED",
          error: "Silakan login terlebih dahulu untuk mengunggah file.",
        };
      }
      if (file.size > 5 * 1024 * 1024) {
        return {
          ok: false,
          code: "FILE_TOO_LARGE",
          error: "Ukuran berkas maksimal 5 MB.",
        };
      }
      const urlRes = await generateUploadUrlMutation({ sessionToken });
      if (!urlRes.ok) {
        return urlRes;
      }
      try {
        const uploadRes = await fetch(urlRes.data.uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!uploadRes.ok) {
          return {
            ok: false,
            code: "UPLOAD_FAILED",
            error: "Gagal mengunggah berkas ke penyimpanan.",
          };
        }
        const json = (await uploadRes.json()) as { storageId?: Id<"_storage"> };
        if (!json.storageId) {
          return {
            ok: false,
            code: "UPLOAD_FAILED",
            error: "Server penyimpanan tidak mengembalikan ID berkas.",
          };
        }
        return {
          ok: true,
          data: { storageId: json.storageId, fileName: file.name },
        };
      } catch {
        return {
          ok: false,
          code: "UPLOAD_FAILED",
          error: "Koneksi gagal saat mengunggah berkas.",
        };
      }
    },
    [sessionToken, generateUploadUrlMutation]
  );

  const value = useMemo<SessionAuthContextValue>(
    () => ({
      hydrated,
      sessionToken,
      user,
      isAuthenticated: Boolean(user),
      isAdmin: Boolean(user && (user.isAdmin || user.role === "admin")),
      isTutor: Boolean(user && user.role === "tutor"),
      needsOnboarding: Boolean(
        user && !user.onboardedAt && !user.isAdmin && user.role !== "admin"
      ),
      requestEmailOtp,
      verifyEmailOtp,
      logout,
      updateOnboardingProfile,
      uploadFile,
    }),
    [
      hydrated,
      sessionToken,
      user,
      requestEmailOtp,
      verifyEmailOtp,
      logout,
      updateOnboardingProfile,
      uploadFile,
    ]
  );

  return (
    <SessionAuthContext.Provider value={value}>
      {children}
    </SessionAuthContext.Provider>
  );
}

export function useSessionAuth(): SessionAuthContextValue {
  const ctx = useContext(SessionAuthContext);
  if (!ctx) {
    throw new Error("useSessionAuth must be used inside KolearaProvider");
  }
  return ctx;
}

export function KolearaProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => getOrCreateConvexClient(), []);
  return (
    <ConvexProvider client={client}>
      <SessionAuthInner>{children}</SessionAuthInner>
    </ConvexProvider>
  );
}

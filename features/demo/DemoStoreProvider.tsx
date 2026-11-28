"use client";

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ConvexProvider,
  ConvexReactClient,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import type { DemoState } from "@/lib/contracts";
import {
  applyRemoteCollections,
  getDemoHydratedServerSnapshot,
  getDemoHydratedSnapshot,
  getDemoServerSnapshot,
  getDemoStateSnapshot,
  hydrateDemoStore,
  registerConvexMutationHandlers,
  subscribeDemoStore,
} from "@/lib/mock/store";

export function useDemoState(): DemoState {
  return useSyncExternalStore(
    subscribeDemoStore,
    getDemoStateSnapshot,
    getDemoServerSnapshot
  );
}

export function useDemoHydrated(): boolean {
  return useSyncExternalStore(
    subscribeDemoStore,
    getDemoHydratedSnapshot,
    getDemoHydratedServerSnapshot
  );
}

function ConvexRealtimeBridge() {
  const remoteState = useQuery(api.state.getAppState, {});
  const ensureSeeded = useMutation(api.seed.ensureSeeded);
  const verifyDemoOtp = useMutation(api.auth.verifyDemoOtp);
  const submitApplication = useMutation(api.tutors.submitApplication);
  const getOrCreateConversation = useMutation(api.chat.getOrCreateConversation);
  const sendMessage = useMutation(api.chat.sendMessage);
  const markRead = useMutation(api.chat.markRead);
  const createOffer = useMutation(api.bookings.createOffer);
  const createDirectBooking = useMutation(api.bookings.createDirectBooking);
  const acceptOffer = useMutation(api.bookings.acceptOffer);
  const declineOffer = useMutation(api.bookings.declineOffer);
  const startPayment = useMutation(api.payments.startPayment);
  const submitDemoProof = useMutation(api.payments.submitDemoProof);
  const completeDemoQris = useMutation(api.payments.completeDemoQris);
  const simulateVerification = useMutation(api.payments.simulateVerification);

  const seedingRequestedRef = useRef(false);

  useEffect(() => {
    const safeSync = (promise: Promise<unknown>) => {
      promise.catch((err) => {
        console.warn("[Convex sync]", err);
      });
    };

    registerConvexMutationHandlers({
      verifyDemoOtp: (args) => {
        safeSync(verifyDemoOtp(args));
      },
      submitApplication: (args) => {
        safeSync(submitApplication(args));
      },
      getOrCreateConversation: (args) => {
        safeSync(getOrCreateConversation(args));
      },
      sendMessage: (args) => {
        safeSync(sendMessage(args));
      },
      markRead: (args) => {
        safeSync(markRead(args));
      },
      createOffer: (args) => {
        safeSync(createOffer(args));
      },
      createDirectBooking: (args) => {
        safeSync(createDirectBooking(args));
      },
      acceptOffer: (args) => {
        safeSync(acceptOffer(args));
      },
      declineOffer: (args) => {
        safeSync(declineOffer(args));
      },
      startPayment: (args) => {
        safeSync(startPayment(args));
      },
      submitDemoProof: (args) => {
        safeSync(submitDemoProof(args));
      },
      completeDemoQris: (args) => {
        safeSync(completeDemoQris(args));
      },
      simulateVerification: (args) => {
        safeSync(simulateVerification(args));
      },
    });

    return () => {
      registerConvexMutationHandlers(null);
    };
  }, [
    acceptOffer,
    completeDemoQris,
    createDirectBooking,
    createOffer,
    declineOffer,
    getOrCreateConversation,
    markRead,
    sendMessage,
    simulateVerification,
    startPayment,
    submitApplication,
    submitDemoProof,
    verifyDemoOtp,
  ]);

  useEffect(() => {
    if (!remoteState) return;
    if (!remoteState.seeded) {
      if (!seedingRequestedRef.current) {
        seedingRequestedRef.current = true;
        ensureSeeded({}).catch((err) => {
          seedingRequestedRef.current = false;
          console.warn("[Convex seed]", err);
        });
      }
      return;
    }
    seedingRequestedRef.current = false;
    applyRemoteCollections(remoteState);
  }, [remoteState, ensureSeeded]);

  return null;
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
let browserConvexClient: ConvexReactClient | null = null;

function getOrCreateBrowserConvexClient(): ConvexReactClient | null {
  if (typeof window === "undefined" || !CONVEX_URL) return null;
  if (!browserConvexClient) {
    browserConvexClient = new ConvexReactClient(CONVEX_URL);
  }
  return browserConvexClient;
}

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const hydrated = useDemoHydrated();

  useEffect(() => {
    hydrateDemoStore();
  }, []);

  const convexClient = hydrated ? getOrCreateBrowserConvexClient() : null;

  if (!convexClient) {
    return <>{children}</>;
  }

  return (
    <ConvexProvider client={convexClient}>
      <ConvexRealtimeBridge />
      {children}
    </ConvexProvider>
  );
}

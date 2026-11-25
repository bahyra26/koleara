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
  getConvexConnectedServerSnapshot,
  getConvexConnectedSnapshot,
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

export function useConvexConnected(): boolean {
  return useSyncExternalStore(
    subscribeDemoStore,
    getConvexConnectedSnapshot,
    getConvexConnectedServerSnapshot
  );
}

function ConvexRealtimeBridge() {
  const remoteState = useQuery(api.state.getAppState, {});
  const ensureSeeded = useMutation(api.seed.ensureSeeded);
  const resetDemoData = useMutation(api.seed.resetDemoData);
  const verifyDemoOtp = useMutation(api.auth.verifyDemoOtp);
  const submitApplication = useMutation(api.tutors.submitApplication);
  const getOrCreateConversation = useMutation(api.chat.getOrCreateConversation);
  const sendMessage = useMutation(api.chat.sendMessage);
  const markRead = useMutation(api.chat.markRead);
  const createOffer = useMutation(api.bookings.createOffer);
  const acceptOffer = useMutation(api.bookings.acceptOffer);
  const declineOffer = useMutation(api.bookings.declineOffer);
  const startPayment = useMutation(api.payments.startPayment);
  const submitDemoProof = useMutation(api.payments.submitDemoProof);
  const simulateVerification = useMutation(api.payments.simulateVerification);

  const seedingRequestedRef = useRef(false);

  useEffect(() => {
    registerConvexMutationHandlers({
      verifyDemoOtp: (args) => {
        void verifyDemoOtp(args);
      },
      resetDemoData: () => {
        void resetDemoData({});
      },
      submitApplication: (args) => {
        void submitApplication(args);
      },
      getOrCreateConversation: (args) => {
        void getOrCreateConversation(args);
      },
      sendMessage: (args) => {
        void sendMessage(args);
      },
      markRead: (args) => {
        void markRead(args);
      },
      createOffer: (args) => {
        void createOffer(args);
      },
      acceptOffer: (args) => {
        void acceptOffer(args);
      },
      declineOffer: (args) => {
        void declineOffer(args);
      },
      startPayment: (args) => {
        void startPayment(args);
      },
      submitDemoProof: (args) => {
        void submitDemoProof(args);
      },
      simulateVerification: (args) => {
        void simulateVerification(args);
      },
    });

    return () => {
      registerConvexMutationHandlers(null);
    };
  }, [
    acceptOffer,
    createOffer,
    declineOffer,
    getOrCreateConversation,
    markRead,
    resetDemoData,
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
        void ensureSeeded({});
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

/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as bookings from "../bookings.js";
import type * as chat from "../chat.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as matching from "../matching.js";
import type * as metrics from "../metrics.js";
import type * as midtrans from "../midtrans.js";
import type * as notifications from "../notifications.js";
import type * as payments from "../payments.js";
import type * as reviews from "../reviews.js";
import type * as seed from "../seed.js";
import type * as state from "../state.js";
import type * as storage from "../storage.js";
import type * as tutors from "../tutors.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  bookings: typeof bookings;
  chat: typeof chat;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  matching: typeof matching;
  metrics: typeof metrics;
  midtrans: typeof midtrans;
  notifications: typeof notifications;
  payments: typeof payments;
  reviews: typeof reviews;
  seed: typeof seed;
  state: typeof state;
  storage: typeof storage;
  tutors: typeof tutors;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as characters from "../characters.js";
import type * as covers from "../covers.js";
import type * as discover from "../discover.js";
import type * as geo from "../geo.js";
import type * as http from "../http.js";
import type * as illustrators from "../illustrators.js";
import type * as legends from "../legends.js";
import type * as library from "../library.js";
import type * as scenes from "../scenes.js";
import type * as stories from "../stories.js";
import type * as storyCards from "../storyCards.js";
import type * as storyCodes from "../storyCodes.js";
import type * as taxonomy from "../taxonomy.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  characters: typeof characters;
  covers: typeof covers;
  discover: typeof discover;
  geo: typeof geo;
  http: typeof http;
  illustrators: typeof illustrators;
  legends: typeof legends;
  library: typeof library;
  scenes: typeof scenes;
  stories: typeof stories;
  storyCards: typeof storyCards;
  storyCodes: typeof storyCodes;
  taxonomy: typeof taxonomy;
  users: typeof users;
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

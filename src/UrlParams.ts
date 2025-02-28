/*
Copyright 2022 - 2023 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */

import { useMemo } from "react";
import { useLocation } from "react-router-dom";

import { Config } from "./config/Config";

interface UrlParams {
  roomAlias: string | null;
  roomId: string | null;
  viaServers: string[];
  /**
   * Whether the app is running in embedded mode, and should keep the user
   * confined to the current room.
   */
  isEmbedded: boolean;
  /**
   * Whether the app should pause before joining the call until it sees an
   * io.element.join widget action, allowing it to be preloaded.
   */
  preload: boolean;
  /**
   * Whether to hide the room header when in a call.
   */
  hideHeader: boolean;
  /**
   * Whether to hide the screen-sharing button.
   */
  hideScreensharing: boolean;
  /**
   * Whether to start a walkie-talkie call instead of a video call.
   */
  isPtt: boolean;
  /**
   * Whether to use end-to-end encryption.
   */
  e2eEnabled: boolean;
  /**
   * The user's ID (only used in matryoshka mode).
   */
  userId: string | null;
  /**
   * The display name to use for auto-registration.
   */
  displayName: string | null;
  /**
   * The device's ID (only used in matryoshka mode).
   */
  deviceId: string | null;
  /**
   * The base URL of the homeserver to use for media lookups in matryoshka mode.
   */
  baseUrl: string | null;
  /**
   * The BCP 47 code of the language the app should use.
   */
  lang: string | null;
  /**
   * The fonts which the interface should use, if not empty.
   */
  fonts: string[];
  /**
   * The factor by which to scale the interface's font size.
   */
  fontScale: number | null;
  /**
   * The Posthog analytics ID. It is only available if the user has given consent for sharing telemetry in element web.
   */
  analyticsID: string | null;
  /**
   * Whether the app is allowed to use fallback STUN servers for ICE in case the
   * user's homeserver doesn't provide any.
   */
  allowIceFallback: boolean;
}

/**
 * Gets the app parameters for the current URL.
 * @param ignoreRoomAlias If true, does not try to parse a room alias from the URL
 * @param search The URL search string
 * @param pathname The URL path name
 * @param hash The URL hash
 * @returns The app parameters encoded in the URL
 */
export const getUrlParams = (
  ignoreRoomAlias?: boolean,
  search = window.location.search,
  pathname = window.location.pathname,
  hash = window.location.hash
): UrlParams => {
  let roomAlias: string | undefined;
  if (!ignoreRoomAlias) {
    if (hash === "") {
      roomAlias = pathname.substring(1); // Strip the "/"

      // Delete "/room/" and "?", if present
      if (roomAlias.startsWith("room/")) {
        roomAlias = roomAlias.substring("room/".length);
      }
      // Add "#", if not present
      if (!roomAlias.startsWith("#")) {
        roomAlias = `#${roomAlias}`;
      }
    } else {
      roomAlias = hash;
    }

    // Add server part, if not present
    if (!roomAlias.includes(":")) {
      roomAlias = `${roomAlias}:${Config.defaultServerName()}`;
    }
  }

  const fragmentQueryStart = hash.indexOf("?");
  const fragmentParams = new URLSearchParams(
    fragmentQueryStart === -1 ? "" : hash.substring(fragmentQueryStart)
  );
  const queryParams = new URLSearchParams(search);

  // Normally, URL params should be encoded in the fragment so as to avoid
  // leaking them to the server. However, we also check the normal query
  // string for backwards compatibility with versions that only used that.
  const hasParam = (name: string): boolean =>
    fragmentParams.has(name) || queryParams.has(name);
  const getParam = (name: string): string | null =>
    fragmentParams.get(name) ?? queryParams.get(name);
  const getAllParams = (name: string): string[] => [
    ...fragmentParams.getAll(name),
    ...queryParams.getAll(name),
  ];

  const fontScale = parseFloat(getParam("fontScale") ?? "");

  return {
    roomAlias: !roomAlias || roomAlias.includes("!") ? null : roomAlias,
    roomId: getParam("roomId"),
    viaServers: getAllParams("via"),
    isEmbedded: hasParam("embed"),
    preload: hasParam("preload"),
    hideHeader: hasParam("hideHeader"),
    hideScreensharing: hasParam("hideScreensharing"),
    isPtt: hasParam("ptt"),
    e2eEnabled: getParam("enableE2e") !== "false", // Defaults to true
    userId: getParam("userId"),
    displayName: getParam("displayName"),
    deviceId: getParam("deviceId"),
    baseUrl: getParam("baseUrl"),
    lang: getParam("lang"),
    fonts: getAllParams("font"),
    fontScale: Number.isNaN(fontScale) ? null : fontScale,
    analyticsID: getParam("analyticsID"),
    allowIceFallback: hasParam("allowIceFallback"),
  };
};

/**
 * Hook to simplify use of getUrlParams.
 * @returns The app parameters for the current URL
 */
export const useUrlParams = (): UrlParams => {
  const { search, pathname, hash } = useLocation();
  return useMemo(
    () => getUrlParams(false, search, pathname, hash),
    [search, pathname, hash]
  );
};

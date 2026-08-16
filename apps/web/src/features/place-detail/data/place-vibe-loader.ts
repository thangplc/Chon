import "server-only";

import { cache } from "react";

import { getPlaceVibeBySlug } from "./place-vibe-repository";

export const loadPlaceVibeBySlug = cache(getPlaceVibeBySlug);

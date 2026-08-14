import "server-only";

import { cache } from "react";

import { getPlaceDetailBySlug } from "./place-detail-repository";

export const loadPlaceDetailBySlug = cache(getPlaceDetailBySlug);

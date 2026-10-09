/**
 * Thin FE re-export of shared scoring helpers (UB-13/14).
 * Nuxt/Vite consumers can also import `#shared/scoring` via the alias in nuxt.config.
 */

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const scoring = require('../../../shared/scoring')

export const getTierFromProgress = scoring.getTierFromProgress as (
  progress: number
) => string
export const getPointsForTier = scoring.getPointsForTier as (tier: string) => {
  required: number
  optional: number
}
export const calculateTaskPoints = scoring.calculateTaskPoints as (
  isOptional: boolean,
  currentProgress: number,
  isLegendary?: boolean
) => number
export const calculateMonthScore = scoring.calculateMonthScore as (
  month: any
) => number
export const TIER_POINTS = scoring.TIER_POINTS
export const TIER_THRESHOLDS = scoring.TIER_THRESHOLDS

export default scoring

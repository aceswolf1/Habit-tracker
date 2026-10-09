/**
 * Thin FE re-export of shared progress helpers (UB-13/14).
 * Nuxt/Vite consumers can also import `#shared/progress` via the alias in nuxt.config.
 * monthStore cutover is owned by W3 — do not wire the store here.
 */

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const progress = require('../../../shared/progress')

export const calculateProgress = progress.calculateProgress as (cycle: any) => void
export const createEmptyMonth = progress.createEmptyMonth as (name?: string) => any
export const generateUuid = progress.generateUuid as (prefix?: string) => string

export default progress

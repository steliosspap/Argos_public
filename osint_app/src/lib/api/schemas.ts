/**
 * Zod validation schemas for API endpoints
 * Backend API Agent - Request/Response Validation
 */

import { z } from 'zod';

// Common schemas
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Conflict Events schemas
export const conflictEventFiltersSchema = z.object({
  regions: z.array(z.string()).optional(),
  types: z.array(z.string()).optional(),
  minReliability: z.coerce.number().min(0).max(1).optional(),
  ...dateRangeSchema.shape,
  ...paginationSchema.shape,
});

export const createConflictEventSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string(),
  type: z.enum([
    'military_action',
    'terrorist_attack',
    'civil_unrest',
    'border_conflict',
    'cyber_attack',
    'diplomatic_crisis',
    'humanitarian_crisis',
    'other',
  ]),
  region: z.string().min(1),
  country: z.string().min(2).max(2), // ISO country code
  coordinates: coordinatesSchema,
  reliability_score: z.number().min(0).max(1),
  sources: z.array(z.string().url()).min(1),
  ai_analysis: z.string().optional(),
});

// Arms Deals schemas
export const armsDealsFiltersSchema = z.object({
  buyer_country: z.string().min(2).max(2).optional(),
  seller_country: z.string().min(2).max(2).optional(),
  weapon_type: z.string().optional(),
  minValue: z.coerce.number().positive().optional(),
  maxValue: z.coerce.number().positive().optional(),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional(),
  ...dateRangeSchema.shape,
  ...paginationSchema.shape,
});

export const createArmsDealSchema = z.object({
  buyer_country: z.string().min(2).max(2),
  seller_country: z.string().min(2).max(2),
  weapon_type: z.string().min(1),
  quantity: z.number().int().positive(),
  value_usd: z.number().positive(),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
  delivery_date: z.string().datetime().optional(),
  date: z.string().datetime(),
  description: z.string().optional(),
  sources: z.array(z.string().url()).min(1),
});

// News schemas
export const newsFiltersSchema = z.object({
  search: z.string().optional(),
  regions: z.array(z.string()).optional(),
  minEscalationScore: z.coerce.number().min(0).max(10).optional(),
  ...dateRangeSchema.shape,
  ...paginationSchema.shape,
});

export const createNewsSchema = z.object({
  title: z.string().min(1).max(500),
  url: z.string().url(),
  source: z.string().min(1),
  content: z.string(),
  published_at: z.string().datetime(),
  region: z.string().optional(),
  country: z.string().min(2).max(2).optional(),
  coordinates: coordinatesSchema.optional(),
  escalation_score: z.number().min(0).max(10).optional(),
  ai_summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Analytics schemas
export const regionAnalyticsSchema = z.object({
  region: z.string().min(1).optional(),
  ...dateRangeSchema.shape,
});

export const timelineAnalyticsSchema = z.object({
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  ...dateRangeSchema.shape,
});

export const topCountriesSchema = z.object({
  metric: z.enum(['events', 'escalation', 'arms_deals']).default('events'),
  limit: z.coerce.number().int().positive().max(50).default(10),
  ...dateRangeSchema.shape,
});

// Response schemas for type safety
export const conflictEventResponseSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  ...createConflictEventSchema.shape,
});

export const armsDealResponseSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  ...createArmsDealSchema.shape,
});

export const newsResponseSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  ...createNewsSchema.shape,
});

// Type exports
export type ConflictEventFilters = z.infer<typeof conflictEventFiltersSchema>;
export type CreateConflictEvent = z.infer<typeof createConflictEventSchema>;
export type ConflictEventResponse = z.infer<typeof conflictEventResponseSchema>;

export type ArmsDealsFilters = z.infer<typeof armsDealsFiltersSchema>;
export type CreateArmsDeal = z.infer<typeof createArmsDealSchema>;
export type ArmsDealResponse = z.infer<typeof armsDealResponseSchema>;

export type NewsFilters = z.infer<typeof newsFiltersSchema>;
export type CreateNews = z.infer<typeof createNewsSchema>;
export type NewsResponse = z.infer<typeof newsResponseSchema>;
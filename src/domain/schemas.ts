import { z } from 'zod';

export const languageSchema = z.enum(['en', 'fr', 'ar']);
export const roleSchema = z.enum(['DSA_ADMIN', 'CHAMBER_ADMIN', 'FARMER']);
export const stockUnitSchema = z.enum(['L', 'mL', 'kg', 'g']);
export const doseUnitSchema = z.enum(['L/ha', 'mL/ha', 'kg/ha', 'g/ha']);

const requiredText = (max = 200) =>
  z.string().trim().min(1, 'validation.required').max(max, 'validation.tooLong');

const optionalText = (max = 500) =>
  z.string().trim().max(max, 'validation.tooLong').optional();

const positive = (message = 'validation.positive') =>
  z.number({ invalid_type_error: 'validation.number' }).finite('validation.number').positive(message);

const optionalPositive = () =>
  z.number({ invalid_type_error: 'validation.number' }).finite('validation.number').positive('validation.positive').optional();

const optionalNonNegative = () =>
  z.number({ invalid_type_error: 'validation.number' }).min(0, 'validation.nonNegative').optional();

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .max(200, 'validation.tooLong')
  .email('validation.email');

export const phoneSchema = z
  .string()
  .trim()
  .min(8, 'validation.phone')
  .max(24, 'validation.phone')
  .regex(/^[+0-9][0-9 ()-]{7,23}$/, 'validation.phone');

const dateString = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'validation.date');

const optionalDateString = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), 'validation.date');

export const registrationSchema = z.object({
  fullName: requiredText(120),
  email: emailSchema,
  phone: phoneSchema,
  preferredLanguage: languageSchema,
  holdingName: requiredText(120),
  commune: requiredText(80),
  cultivatedAreaHa: positive(),
  mainCrops: requiredText(300),
  agriculturalId: optionalText(80),
  supportingInfo: optionalText(1000),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'validation.consent' }),
  }),
});

export type RegistrationFormValues = z.input<typeof registrationSchema>;

export const farmerUpdateSchema = z.object({
  fullName: requiredText(120),
  email: emailSchema,
  phone: phoneSchema,
  preferredLanguage: languageSchema,
  agriculturalId: optionalText(80),
  supportingInfo: optionalText(1000),
});

export const farmerAdminUpdateSchema = farmerUpdateSchema.extend({
  commune: requiredText(80),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']),
  notes: optionalText(1000),
});

export const holdingSchema = z
  .object({
    name: requiredText(120),
    ownerFarmerId: z.string().trim().min(1, 'validation.required').optional(),
    commune: requiredText(80),
    address: optionalText(300),
    latitude: z.number({ invalid_type_error: 'validation.number' }).min(-90, 'validation.latitude').max(90, 'validation.latitude').optional(),
    longitude: z.number({ invalid_type_error: 'validation.number' }).min(-180, 'validation.longitude').max(180, 'validation.longitude').optional(),
    totalCultivatedAreaHa: positive(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
  })
  .superRefine((value, ctx) => {
    const hasLat = value.latitude !== undefined;
    const hasLng = value.longitude !== undefined;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasLat ? ['longitude'] : ['latitude'],
        message: 'validation.coordinatesPair',
      });
    }
  });

export const plotSchema = z.object({
  name: requiredText(120),
  areaHa: positive(),
  soilType: optionalText(120),
  notes: optionalText(500),
});

export const cropSchema = z
  .object({
    plotId: z.string().trim().min(1, 'validation.required'),
    seasonId: z.string().trim().min(1, 'validation.required'),
    name: requiredText(120),
    category: requiredText(80),
    areaHa: positive(),
    plantingDate: optionalDateString,
    harvestDate: optionalDateString,
    notes: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (value.plantingDate && value.harvestDate && value.plantingDate > value.harvestDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['harvestDate'],
        message: 'validation.dateOrder',
      });
    }
  });

export const seasonSchema = z
  .object({
    label: requiredText(80),
    startDate: dateString,
    endDate: dateString,
    status: z.enum(['ACTIVE', 'CLOSED']),
  })
  .superRefine((value, ctx) => {
    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'validation.dateOrder',
      });
    }
  });

export const productSchema = z
  .object({
    commercialName: requiredText(120),
    activeIngredient: requiredText(160),
    category: requiredText(80),
    formulation: requiredText(80),
    manufacturer: requiredText(120),
    registrationReference: optionalText(120),
    intendedCrops: z.array(z.string().trim().min(1)).min(1, 'validation.atLeastOneCrop'),
    targetPests: z.array(z.string().trim().min(1)).min(1, 'validation.atLeastOneTarget'),
    referenceDose: optionalPositive(),
    referenceDoseUnit: doseUnitSchema.optional(),
    referenceSource: optionalText(300),
    safetyInfo: requiredText(1000),
    preHarvestIntervalDays: optionalNonNegative(),
    reEntryIntervalHours: optionalNonNegative(),
    stockUnit: stockUnitSchema,
    lowStockThreshold: z.number({ invalid_type_error: 'validation.number' }).min(0, 'validation.nonNegative'),
    verificationStatus: z.enum(['VERIFIED', 'DEMO', 'UNVERIFIED']),
    archived: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.referenceDose !== undefined) {
      if (!value.referenceDoseUnit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['referenceDoseUnit'],
          message: 'validation.referenceDoseUnitRequired',
        });
      }
      if (!value.referenceSource) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['referenceSource'],
          message: 'validation.referenceSourceRequired',
        });
      }
    }
    if (value.referenceDoseUnit) {
      const volumeDose = value.referenceDoseUnit === 'L/ha' || value.referenceDoseUnit === 'mL/ha';
      const volumeStock = value.stockUnit === 'L' || value.stockUnit === 'mL';
      if (volumeDose !== volumeStock) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['referenceDoseUnit'],
          message: 'validation.doseStockMismatch',
        });
      }
    }
    if (value.verificationStatus === 'VERIFIED' && !value.registrationReference) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['registrationReference'],
        message: 'validation.registrationReferenceRequired',
      });
    }
  });

/**
 * UI-only variant of the product schema. The form edits crop and target lists as
 * comma-separated text, while the service receives real arrays.
 */
export const productFormSchema = z
  .object({
    commercialName: requiredText(120),
    activeIngredient: requiredText(160),
    category: requiredText(80),
    formulation: requiredText(80),
    manufacturer: requiredText(120),
    registrationReference: optionalText(120),
    intendedCrops: requiredText(600),
    targetPests: requiredText(600),
    referenceDose: optionalPositive(),
    referenceDoseUnit: doseUnitSchema.optional(),
    referenceSource: optionalText(300),
    safetyInfo: requiredText(1000),
    preHarvestIntervalDays: optionalNonNegative(),
    reEntryIntervalHours: optionalNonNegative(),
    stockUnit: stockUnitSchema,
    lowStockThreshold: z.number({ invalid_type_error: 'validation.number' }).min(0, 'validation.nonNegative'),
    verificationStatus: z.enum(['VERIFIED', 'DEMO', 'UNVERIFIED']),
    archived: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.referenceDose !== undefined) {
      if (!value.referenceDoseUnit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['referenceDoseUnit'],
          message: 'validation.referenceDoseUnitRequired',
        });
      }
      if (!value.referenceSource) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['referenceSource'],
          message: 'validation.referenceSourceRequired',
        });
      }
    }
    if (value.referenceDoseUnit) {
      const volumeDose = value.referenceDoseUnit === 'L/ha' || value.referenceDoseUnit === 'mL/ha';
      const volumeStock = value.stockUnit === 'L' || value.stockUnit === 'mL';
      if (volumeDose !== volumeStock) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['referenceDoseUnit'],
          message: 'validation.doseStockMismatch',
        });
      }
    }
    if (value.verificationStatus === 'VERIFIED' && !value.registrationReference) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['registrationReference'],
        message: 'validation.registrationReferenceRequired',
      });
    }
  });

export const movementSchema = z
  .object({
    holdingId: z.string().trim().min(1, 'validation.required'),
    productId: z.string().trim().min(1, 'validation.required'),
    type: z.enum(['OPENING_BALANCE', 'RECEIPT', 'CONSUMPTION', 'ADJUSTMENT', 'RETURN']),
    occurredAt: dateString,
    quantity: positive(),
    unit: stockUnitSchema,
    adjustmentDirection: z.enum(['IN', 'OUT']).optional(),
    supplierOrReference: optionalText(200),
    notes: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'ADJUSTMENT' && !value.adjustmentDirection) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['adjustmentDirection'],
        message: 'validation.adjustmentDirection',
      });
    }
  });

export const treatmentSchema = z.object({
  holdingId: z.string().trim().min(1, 'validation.required'),
  plotId: z.string().trim().min(1, 'validation.required'),
  cropId: z.string().trim().min(1, 'validation.required'),
  seasonId: z.string().trim().min(1, 'validation.required'),
  treatmentDate: dateString,
  productId: z.string().trim().min(1, 'validation.required'),
  target: requiredText(160),
  treatedAreaHa: positive(),
  totalCropAreaHa: positive(),
  appliedDose: positive(),
  appliedDoseUnit: doseUnitSchema,
  quantityApplied: positive(),
  quantityUnit: stockUnitSchema,
  applicationMethod: optionalText(120),
  fieldConditions: optionalText(300),
  notes: optionalText(1000),
  sourceInfo: optionalText(500),
});

export const treatmentReverseSchema = z.object({
  reason: requiredText(500),
});

export const reviewSchema = z.object({
  notes: optionalText(1000),
});

export const tfiConfigSchema = z.object({
  normalization: z.enum(['CROP_AREA', 'TREATED_AREA']),
  requireVerifiedDose: z.boolean(),
  allowDemoReferenceDoses: z.boolean(),
  notes: optionalText(500),
});

export const tfiRequestSchema = z.object({
  scopeType: z.enum(['TREATMENT', 'CROP', 'PLOT', 'HOLDING', 'SEASON', 'ALL']),
  scopeId: optionalText(120),
  seasonId: optionalText(120),
  dateFrom: optionalDateString,
  dateTo: optionalDateString,
});

export const settingsSchema = z.object({
  applicationName: requiredText(160),
  institution: requiredText(160),
  lowStockThreshold: z.number({ invalid_type_error: 'validation.number' }).min(0, 'validation.nonNegative'),
  allowSelfRegistration: z.boolean(),
  defaultLanguage: languageSchema,
  communes: z.array(z.string().trim().min(1)).min(1, 'validation.atLeastOneCommune'),
  cropCategories: z.array(z.string().trim().min(1)).min(1, 'validation.atLeastOneCategory'),
  cropSuggestions: z.array(z.string().trim().min(1)),
});

export const roleSwitchSchema = z.object({
  userId: z.string().trim().min(1),
});

export type RegistrationInput = z.output<typeof registrationSchema>;
export type RegistrationFormState = Omit<z.input<typeof registrationSchema>, 'consent'> & {
  consent: boolean;
};
export type FarmerSelfInput = z.output<typeof farmerUpdateSchema>;
export type FarmerAdminInput = z.output<typeof farmerAdminUpdateSchema>;
export type HoldingInput = z.output<typeof holdingSchema>;
export type PlotInput = z.output<typeof plotSchema>;
export type CropInput = z.output<typeof cropSchema>;
export type ProductInput = z.output<typeof productSchema>;
export type ProductFormState = z.input<typeof productFormSchema>;
export type MovementInput = z.output<typeof movementSchema>;
export type TreatmentInput = z.output<typeof treatmentSchema>;
export type TFIConfigInput = z.output<typeof tfiConfigSchema>;
export type SettingsInput = z.output<typeof settingsSchema>;

import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form';
import type { ZodTypeAny } from 'zod';

/**
 * Small typed wrapper around react-hook-form + Zod.
 *
 * The resolver is cast because Zod transforms make the input and output types
 * differ for a few schemas (for example optional strings trimmed by the service).
 * Pages still get full field typing from the generic.
 */
export function useZodForm<T extends FieldValues>(
  schema: ZodTypeAny,
  defaultValues: DefaultValues<T>,
): UseFormReturn<T> {
  return useForm<T>({
    resolver: zodResolver(schema) as unknown as Resolver<T>,
    defaultValues,
    mode: 'onBlur',
  });
}

/** Registers a number input while keeping an empty value as `undefined`. */
export const numberValue = {
  setValueAs: (value: unknown): number | undefined => {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  },
};

/** Registers a required number input. */
export const requiredNumberValue = {
  setValueAs: (value: unknown): number => {
    if (value === '' || value === null || value === undefined) return Number.NaN;
    return Number(value);
  },
};

export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinList(value: string[] | undefined): string {
  return (value ?? []).join(', ');
}

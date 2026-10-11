import type { DateComparable, DurationUnit } from '../types.ts';

const unitsToMilliseconds = {
  milliseconds: { milliseconds: 1 },
  seconds: { milliseconds: 1000 },
  minutes: { milliseconds: 60 * 1000 },
  hours: { milliseconds: 24 * 60 * 1000 },
  days: { days: 1 },
  weeks: { days: 7 },
  months: { months: 1 },
  years: { years: 1 },
};

interface DurationLookup {
  days?: number;
  milliseconds?: number;
  months?: number;
  years?: number;
}

// biome-ignore lint/complexity/noStaticOnlyClass: The published runtime exposes DateUtils as a constructible class.
export default class DateUtils {
  static durationAsMilliseconds(count: number, units: DurationUnit): number;
  static durationAsMilliseconds(count: number, units: string): number | undefined;
  static durationAsMilliseconds(count: number, units: string): number | undefined {
    const lookup = Reflect.get(unitsToMilliseconds, units) as DurationLookup | undefined;
    if (!lookup) throw new Error(`DateUtils.durationAsMilliseconds :Unrecognized units: ${units}`);
    if (lookup.milliseconds) return count * lookup.milliseconds;
    if (lookup.days) return count * 864e5 * lookup.days;
    if (lookup.months) return count * lookup.months * 2592e6;
    if (lookup.years) return count * lookup.years * 31536e6;
  }

  static isBefore(modelValue: DateComparable, targetValue: DateComparable): boolean {
    return (modelValue.valueOf() as number) < (targetValue.valueOf() as number);
  }

  static isAfter(modelValue: DateComparable, targetValue: DateComparable): boolean {
    return (modelValue.valueOf() as number) > (targetValue.valueOf() as number);
  }

  static isEqual(modelValue: unknown, targetValue: unknown): boolean {
    return +(modelValue as number) === +(targetValue as number);
  }
}

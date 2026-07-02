export const NODEMCU_D_PINS = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'] as const;

const D_PIN_TO_GPIO: Record<(typeof NODEMCU_D_PINS)[number], number> = {
  D0: 16,
  D1: 5,
  D2: 4,
  D3: 0,
  D4: 2,
  D5: 14,
  D6: 12,
  D7: 13,
  D8: 15
};

const GPIO_TO_D_PIN: Record<number, (typeof NODEMCU_D_PINS)[number]> = Object.fromEntries(
  Object.entries(D_PIN_TO_GPIO).map(([dPin, gpio]) => [Number(gpio), dPin as (typeof NODEMCU_D_PINS)[number]])
) as Record<number, (typeof NODEMCU_D_PINS)[number]>;

export function normalizeDPinLabel(label: unknown): (typeof NODEMCU_D_PINS)[number] | null {
  if (typeof label !== 'string') return null;
  const trimmed = label.trim().toUpperCase();
  return (NODEMCU_D_PINS as readonly string[]).includes(trimmed) ? (trimmed as (typeof NODEMCU_D_PINS)[number]) : null;
}

export function dPinToGpio(label: unknown): number | null {
  const normalized = normalizeDPinLabel(label);
  if (!normalized) return null;
  return D_PIN_TO_GPIO[normalized];
}

export function gpioToDPin(gpio: unknown): (typeof NODEMCU_D_PINS)[number] | null {
  if (typeof gpio !== 'number') return null;
  return GPIO_TO_D_PIN[gpio] || null;
}


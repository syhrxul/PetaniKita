export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function calculateRealisticTypingDelay(text: string): number {
  const charsCount = text.length;
  const baseSpeedPerChar = 40;
  const randomJitter = Math.floor(Math.random() * 1000) + 500;
  const calculatedDelay = (charsCount * baseSpeedPerChar) + randomJitter;
  return Math.min(Math.max(calculatedDelay, 1500), 6000);
}

/** AI 호출 실패. retry=true면 혼잡(429/과부하) 때문이라 잠시 후 다시 시도하면 됨 */
export class AIError extends Error {
  constructor(message: string, public retry: boolean) {
    super(message);
  }
}

export type AIResult = { text: string; tokensIn: number; tokensOut: number; model: string };

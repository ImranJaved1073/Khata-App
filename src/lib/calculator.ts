import { formatMoneyInput, parseMoneyInput } from "./money";
import type { Paisa } from "../types/models";

export type CalculatorOperator = "+" | "-" | "×" | "÷";

export interface CalculatorState {
  /** The value already committed by a previous operator chain, or null if nothing entered yet. */
  accumulator: Paisa | null;
  pendingOperator: CalculatorOperator | null;
  /** Raw text of the number currently being typed, e.g. "1500" or "1500.5". */
  currentInput: string;
  /** True when the next digit press should start a fresh number instead of appending. */
  overwrite: boolean;
  /** True right after "=" — the next operator/digit starts a brand new expression. */
  justEvaluated: boolean;
  /** Tokens for the running expression line, e.g. ["1,500", "+"]. */
  expressionTokens: string[];
}

export function createCalculatorState(initial: Paisa = 0): CalculatorState {
  return {
    accumulator: null,
    pendingOperator: null,
    currentInput: formatMoneyInput(initial).replace(/\.00$/, ""),
    overwrite: true,
    justEvaluated: false,
    expressionTokens: [],
  };
}

function currentInputPaisa(state: CalculatorState): Paisa {
  return parseMoneyInput(state.currentInput || "0");
}

function applyOperator(a: Paisa, op: CalculatorOperator, b: Paisa): Paisa {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return Math.round((a * b) / 100);
    case "÷":
      return b === 0 ? a : Math.round((a * 100) / b);
  }
}

function groupThousands(rupeeWhole: string): string {
  const negative = rupeeWhole.startsWith("-");
  const digits = negative ? rupeeWhole.slice(1) : rupeeWhole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return negative ? `-${grouped}` : grouped;
}

/** Formats a raw typed-number string (not yet paisa) for the expression line, e.g. "1500" -> "1,500". */
function formatTypedNumber(raw: string): string {
  if (!raw) return "0";
  const [whole, frac] = raw.split(".");
  const groupedWhole = groupThousands(whole || "0");
  return frac !== undefined ? `${groupedWhole}.${frac}` : groupedWhole;
}

export function inputDigit(state: CalculatorState, digit: string): CalculatorState {
  if (state.overwrite) {
    return {
      ...state,
      currentInput: digit === "00" ? "0" : digit,
      overwrite: false,
      justEvaluated: false,
    };
  }
  const [, frac] = state.currentInput.split(".");
  if (frac !== undefined && frac.length >= 2) return state;
  if (state.currentInput === "0") {
    return { ...state, currentInput: digit === "00" ? "0" : digit };
  }
  return { ...state, currentInput: state.currentInput + digit };
}

export function inputDecimalPoint(state: CalculatorState): CalculatorState {
  if (state.overwrite) {
    return { ...state, currentInput: "0.", overwrite: false, justEvaluated: false };
  }
  if (state.currentInput.includes(".")) return state;
  return { ...state, currentInput: `${state.currentInput}.` };
}

export function backspace(state: CalculatorState): CalculatorState {
  if (state.overwrite) return state;
  const next = state.currentInput.slice(0, -1);
  return { ...state, currentInput: next === "" || next === "-" ? "0" : next };
}

export function clear(): CalculatorState {
  return createCalculatorState(0);
}

export function inputOperator(state: CalculatorState, op: CalculatorOperator): CalculatorState {
  // Changed their mind right after pressing an operator — swap it instead of chaining again.
  if (state.overwrite && state.pendingOperator && !state.justEvaluated) {
    return {
      ...state,
      pendingOperator: op,
      expressionTokens: [...state.expressionTokens.slice(0, -1), op],
    };
  }

  // Mid-chain: a number was typed after a pending operator — apply it, then queue the new one.
  if (state.pendingOperator && !state.overwrite) {
    const typedLabel = formatTypedNumber(state.currentInput);
    const result = applyOperator(
      state.accumulator ?? 0,
      state.pendingOperator,
      currentInputPaisa(state),
    );
    return {
      accumulator: result,
      pendingOperator: op,
      currentInput: formatMoneyInput(result).replace(/\.00$/, ""),
      overwrite: true,
      justEvaluated: false,
      expressionTokens: [...state.expressionTokens, typedLabel, op],
    };
  }

  // Fresh number (including a just-evaluated result) — start a new expression.
  const typedLabel = formatTypedNumber(state.currentInput);
  return {
    accumulator: currentInputPaisa(state),
    pendingOperator: op,
    currentInput: state.currentInput,
    overwrite: true,
    justEvaluated: false,
    expressionTokens: [typedLabel, op],
  };
}

/** Percent key: treats the typed number as a percentage of the accumulator (e.g. 200 + 10% -> 200 + 20). */
export function inputPercent(state: CalculatorState): CalculatorState {
  const base = state.accumulator ?? currentInputPaisa(state);
  const percentValue = Math.round((base * currentInputPaisa(state)) / 10000);
  return {
    ...state,
    currentInput: formatMoneyInput(percentValue).replace(/\.00$/, ""),
    overwrite: false,
    justEvaluated: false,
  };
}

export function inputEquals(state: CalculatorState): CalculatorState {
  if (!state.pendingOperator) {
    return { ...state, overwrite: true, justEvaluated: true };
  }
  const typedLabel = formatTypedNumber(state.currentInput);
  const result = applyOperator(
    state.accumulator ?? 0,
    state.pendingOperator,
    currentInputPaisa(state),
  );
  return {
    accumulator: null,
    pendingOperator: null,
    currentInput: formatMoneyInput(result).replace(/\.00$/, ""),
    overwrite: true,
    justEvaluated: true,
    expressionTokens: [...state.expressionTokens, typedLabel],
  };
}

/** The big display value: the live current input, or the just-computed result. */
export function displayValuePaisa(state: CalculatorState): Paisa {
  return currentInputPaisa(state);
}

/** The small running-expression line above the display, or null when there's nothing extra to show. */
export function expressionLabel(state: CalculatorState): string | null {
  if (state.expressionTokens.length === 0) {
    return state.currentInput === "0" ? null : formatTypedNumber(state.currentInput);
  }
  if (state.justEvaluated) return state.expressionTokens.join(" ");
  const trailing = state.overwrite ? [] : [formatTypedNumber(state.currentInput)];
  return [...state.expressionTokens, ...trailing].join(" ");
}

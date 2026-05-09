/**
 * PO Status Transition Validator
 *
 * Encodes the allowed status transition graph for Purchase Orders.
 * Every status change must go through validateTransition() before being applied.
 */

const ALLOWED_TRANSITIONS = {
  draft: ["raised"],
  raised: ["confirmed", "cancelled"],
  confirmed: ["in_transit", "cancelled"],
  in_transit: ["partially_received", "received"],
  partially_received: ["received"],
  received: [], // terminal
  cancelled: [], // terminal
};

const TERMINAL_STATES = ["received", "cancelled"];

/**
 * @param {string} from - Current PO status
 * @param {string} to   - Desired next status
 * @throws {Error} if the transition is not allowed
 */
export function validateTransition(from, to) {
  if (!ALLOWED_TRANSITIONS[from]) {
    throw new Error(`Invalid current status: "${from}"`);
  }
  if (TERMINAL_STATES.includes(from)) {
    throw new Error(
      `Purchase order is in a terminal state ("${from}") and cannot be changed`
    );
  }
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(
      `Transition from "${from}" to "${to}" is not allowed. ` +
        `Allowed: ${ALLOWED_TRANSITIONS[from].join(", ") || "none"}`
    );
  }
}

export function isTerminal(status) {
  return TERMINAL_STATES.includes(status);
}

export function getAllowedNext(status) {
  return ALLOWED_TRANSITIONS[status] || [];
}

export default { validateTransition, isTerminal, getAllowedNext };

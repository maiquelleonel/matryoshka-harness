/**
 * Matryoshka-Harness (baba / bbyg / matryoshka)
 * Adaptive Context-Fencing, Anti-Slop AGENTS.md Compiler & L4 Maturity Remediation
 *
 * Copyright (c) 2026 Maiquel Leonel
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
export interface Review {
  user: {
    login: string;
  };
  state: string;
}

export interface MaintainerGateResult {
  authorized: boolean;
  reason: string;
}

export const AUTHORIZED_MAINTAINERS: readonly string[] = Object.freeze([
  "maiquelleonel",
]);

/**
 * Validates whether a pull request is authorized to be merged into protected branches.
 * A pull request is considered authorized if:
 * 1. It is authored by an authorized maintainer.
 * 2. It has received an explicit 'APPROVED' review from an authorized maintainer.
 */
export function verifyMaintainerAuthorization(params: {
  author: string;
  reviews?: Review[];
  authorizedMaintainers?: readonly string[];
}): MaintainerGateResult {
  const maintainers = params.authorizedMaintainers ?? AUTHORIZED_MAINTAINERS;
  const authorClean = params.author.replace(/^@/, "").trim().toLowerCase();

  const isAuthorMaintainer = maintainers.some(
    (m) => m.toLowerCase() === authorClean,
  );

  if (isAuthorMaintainer) {
    return {
      authorized: true,
      reason: `PR authored by authorized maintainer (@${authorClean})`,
    };
  }

  const reviews = params.reviews ?? [];
  const hasMaintainerApproval = reviews.some((review) => {
    const reviewerClean = review.user.login.replace(/^@/, "").trim().toLowerCase();
    const isReviewerMaintainer = maintainers.some(
      (m) => m.toLowerCase() === reviewerClean,
    );
    return isReviewerMaintainer && review.state.toUpperCase() === "APPROVED";
  });

  if (hasMaintainerApproval) {
    return {
      authorized: true,
      reason: "PR approved by an authorized maintainer",
    };
  }

  const maintainerList = maintainers.map((m) => `@${m}`).join(", ");
  return {
    authorized: false,
    reason: `PR requires approval from an authorized maintainer (${maintainerList}) before merging into main`,
  };
}

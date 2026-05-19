export type Create = {
  result: {
    bankTransactionId: string;
    status: "AUTO_MATCHED" | "NEEDS_REVIEW" | "UNMATCHED";
    matchedPaymentId: string | null;
    candidateCount: number;
  };
};

export type Get = {
  result: {
    transactions: {
      id: string;
      amount: number;
      depositor: string;
      receivedAt: number;
      rawText: string;
      source: string;
      status: string;
      matchedPaymentId: string | null;
      createdAt: number;
      candidates: {
        paymentId: string;
        orderId: string;
        tableName: string;
        displayNumber: number | null;
        paymentCode: number | null;
        originalAmount: number;
        expectedTransferAmount: number;
        diff: number;
        reason: string;
      }[];
    }[];
  };
};

export type Confirm = {
  result: string;
};

export type Ignore = {
  result: string;
};

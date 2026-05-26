import type { PaymentSettings } from "db/schema";

export const defaultPaymentSettings: PaymentSettings = {
  id: "default",
  bankName: "토스뱅크",
  accountNumber: "1000-1234-5678",
  accountHolder: "연컴 홈런포차",
  tossTransferUrlTemplate: "supertoss://send?amount={amount}&bank={bankName}&accountNo={accountNumber}",
  depositGuide: "주문금액이 아니라 결제코드가 차감된 입금액을 1원 단위까지 정확하게 이체해 주세요. 입금액이 다를 경우 입금 자동 확인이 지연되거나 지불 취소 처리가 필요할 수 있습니다.",
  createdAt: 0,
  updatedAt: 0,
};

export function normalizePaymentSettings(settings: Partial<PaymentSettings> | null | undefined): PaymentSettings {
  return {
    ...defaultPaymentSettings,
    ...settings,
    bankName: settings?.bankName?.trim() || defaultPaymentSettings.bankName,
    accountNumber: settings?.accountNumber?.trim() || defaultPaymentSettings.accountNumber,
    accountHolder: settings?.accountHolder?.trim() || defaultPaymentSettings.accountHolder,
    tossTransferUrlTemplate: settings?.tossTransferUrlTemplate?.trim() || defaultPaymentSettings.tossTransferUrlTemplate,
    depositGuide: settings?.depositGuide?.trim() || defaultPaymentSettings.depositGuide,
  };
}

export function getAccountCopyText(settings: PaymentSettings) {
  return `${settings.bankName} ${settings.accountNumber}`;
}

export function getAccountHolderLabel(settings: PaymentSettings, language = "ko") {
  return language === "ko" ? `예금주: ${settings.accountHolder}` : `Holder: ${settings.accountHolder}`;
}

export function buildTossTransferUrl(settings: PaymentSettings, amount: number) {
  const replacements: Record<string, string> = {
    amount: String(amount),
    bank: settings.bankName,
    bankName: settings.bankName,
    accountNo: settings.accountNumber,
    accountNumber: settings.accountNumber,
    accountHolder: settings.accountHolder,
  };

  return settings.tossTransferUrlTemplate.replace(/\{([A-Za-z]+)\}/g, (match, key: string) => (
    replacements[key] === undefined ? match : encodeURIComponent(replacements[key])
  ));
}

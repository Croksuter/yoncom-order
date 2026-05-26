import unittest

from kb_bank_webhook.models import deposit_payload
from kb_bank_webhook.parser import extract_rows_from_html, parse_dom_rows


class ParserTest(unittest.TestCase):
    def test_parses_kb_transaction_table(self):
        html = """
        <table class="tType01 tbl-fixed" summary="거래상세내역(거래일시, 적요, 보낸분/받는분, 출금액(원), 입금액(원), 잔액(원), 송금메모, 거래점)">
          <thead>
            <tr>
              <th>선택</th><th>거래일시</th><th>적요</th><th>보낸분/받는분</th>
              <th>출금액(원)</th><th>입금액(원)</th><th>잔액(원)</th><th>송금메모</th><th>거래점</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><input type="checkbox"></td>
              <td>2026.05.27 00:15:22</td>
              <td>전자금융</td>
              <td><span class="data1" title="홍길동">홍길동</span></td>
              <td class="tRight">0</td>
              <td class="tRight">1,000</td>
              <td class="tRight">2,000</td>
              <td><span class="data1" title=""></span></td>
              <td>하나은행</td>
            </tr>
          </tbody>
        </table>
        """

        rows = extract_rows_from_html(html)
        transactions = parse_dom_rows(rows)

        self.assertEqual(len(transactions), 1)
        self.assertEqual(transactions[0].direction, "입금")
        self.assertEqual(transactions[0].amount, 1000)
        self.assertEqual(transactions[0].balance, 2000)
        self.assertEqual(transactions[0].memo, "홍길동")
        self.assertIn("거래점 하나은행", transactions[0].raw_text)

    def test_builds_deposit_payload(self):
        transaction = parse_dom_rows([{
            "거래일시": "2026.05.27 00:15:22",
            "적요": "전자금융",
            "보낸분/받는분": "홍길동",
            "출금액(원)": "0",
            "입금액(원)": "1,000",
            "잔액(원)": "2,000",
            "송금메모": "",
            "거래점": "하나은행",
        }])[0]

        payload = deposit_payload(transaction)

        self.assertEqual(payload["amount"], 1000)
        self.assertEqual(payload["bank"], "KB")
        self.assertEqual(payload["name"], "홍길동")
        self.assertEqual(payload["source"], "SELENIUM")
        self.assertTrue(payload["dedupeKey"].startswith("KB:"))


if __name__ == "__main__":
    unittest.main()

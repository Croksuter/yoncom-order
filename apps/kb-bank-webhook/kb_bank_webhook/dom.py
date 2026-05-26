from __future__ import annotations

import time

from selenium.common.exceptions import ElementClickInterceptedException, TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


QUERY_BUTTON_SELECTOR = "form[name='IBF'] button.btn-com.c2"


def wait_for_query_screen(driver: WebDriver, timeout: int) -> None:
    WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, QUERY_BUTTON_SELECTOR))
    )


def click_query_button(driver: WebDriver, timeout: int) -> None:
    arm_transaction_observer(driver)
    button = WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, QUERY_BUTTON_SELECTOR))
    )
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", button)
    try:
        button.click()
    except ElementClickInterceptedException:
        driver.execute_script("arguments[0].click();", button)


def wait_for_transaction_table_settled(driver: WebDriver, timeout: int) -> None:
    WebDriverWait(driver, timeout).until(lambda browser: table_signature(browser) is not None)
    deadline = time.monotonic() + timeout
    started_at = time.monotonic()
    last_signature = None
    stable_count = 0
    while time.monotonic() < deadline:
        status = table_status(driver)
        signature = status.get("signature")
        changed_after_click = status.get("lastMutation", 0) >= status.get("clickAt", 0)
        quiet_after_change = status.get("now", 0) - status.get("lastMutation", 0) >= 700
        ajax_idle = status.get("ajaxActive", 0) == 0
        if signature and changed_after_click and quiet_after_change and ajax_idle and time.monotonic() - started_at >= 1:
            return

        allow_same_result_fallback = time.monotonic() - started_at >= 3
        if allow_same_result_fallback and signature and signature == last_signature:
            stable_count += 1
            if stable_count >= 2:
                return
        else:
            stable_count = 0
            last_signature = signature
        time.sleep(0.5)
    raise TimeoutException("transaction table did not settle")


def arm_transaction_observer(driver: WebDriver) -> None:
    driver.execute_script(
        """
        const target = document.querySelector("#b061342") || document.body;
        window.__kbWebhookClickAt = Date.now();
        window.__kbWebhookLastMutation = 0;
        if (window.__kbWebhookObserver) window.__kbWebhookObserver.disconnect();
        window.__kbWebhookObserver = new MutationObserver(() => {
          window.__kbWebhookLastMutation = Date.now();
        });
        window.__kbWebhookObserver.observe(target, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true
        });
        """
    )


def table_signature(driver: WebDriver) -> str | None:
    return table_status(driver).get("signature")


def table_status(driver: WebDriver) -> dict:
    return driver.execute_script(
        """
        const table = findTransactionTable();
        if (!table) return {
          signature: null,
          now: Date.now(),
          clickAt: window.__kbWebhookClickAt || 0,
          lastMutation: window.__kbWebhookLastMutation || 0,
          ajaxActive: window.jQuery ? window.jQuery.active : 0
        };
        const rows = Array.from(table.querySelectorAll("tbody tr"));
        const signature = rows.length === 0
          ? "__EMPTY_TRANSACTION_TABLE__"
          : rows.map((row) => row.innerText.replace(/\\s+/g, " ").trim()).join("\\n");
        return {
          signature,
          now: Date.now(),
          clickAt: window.__kbWebhookClickAt || 0,
          lastMutation: window.__kbWebhookLastMutation || 0,
          ajaxActive: window.jQuery ? window.jQuery.active : 0
        };

        function findTransactionTable() {
          const tables = Array.from(document.querySelectorAll("table"));
          return tables.find((table) => {
            const summary = table.getAttribute("summary") || "";
            const caption = table.querySelector("caption")?.textContent || "";
            return summary.includes("거래상세내역") || caption.includes("거래상세내역");
          });
        }
        """
    )


def extract_transaction_rows(driver: WebDriver) -> list[dict[str, str]]:
    return driver.execute_script(
        """
        const table = findTransactionTable();
        if (!table) return [];
        const headers = Array.from(table.querySelectorAll("thead th")).map((th) => norm(th.textContent));
        return Array.from(table.querySelectorAll("tbody tr")).map((tr) => {
          const cells = Array.from(tr.cells);
          const row = {};
          headers.forEach((header, index) => {
            row[header] = norm(cells[index]?.innerText || cells[index]?.textContent || "");
          });
          const counterparty = cells[3]?.querySelector(".data1");
          const transferMemo = cells[7]?.querySelector(".data1");
          if (counterparty?.getAttribute("title")) row.counterpartyTitle = norm(counterparty.getAttribute("title"));
          if (transferMemo?.getAttribute("title")) row.transferMemoTitle = norm(transferMemo.getAttribute("title"));
          return row;
        });

        function findTransactionTable() {
          const tables = Array.from(document.querySelectorAll("table"));
          return tables.find((table) => {
            const summary = table.getAttribute("summary") || "";
            const caption = table.querySelector("caption")?.textContent || "";
            return summary.includes("거래상세내역") || caption.includes("거래상세내역");
          });
        }

        function norm(value) {
          return String(value || "").replace(/\\s+/g, " ").trim();
        }
        """
    )

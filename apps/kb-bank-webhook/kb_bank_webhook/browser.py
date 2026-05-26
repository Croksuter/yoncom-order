from __future__ import annotations

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

from .config import Settings


def create_driver(settings: Settings) -> webdriver.Chrome:
    options = Options()
    if settings.chrome_binary:
        options.binary_location = settings.chrome_binary

    if settings.chrome_debugger_address:
        options.add_experimental_option("debuggerAddress", settings.chrome_debugger_address)
    else:
        options.add_argument(f"--user-data-dir={settings.chrome_user_data_dir}")
        if settings.chrome_profile_directory:
            options.add_argument(f"--profile-directory={settings.chrome_profile_directory}")
        if settings.chrome_remote_debugging_port > 0:
            options.add_argument(f"--remote-debugging-port={settings.chrome_remote_debugging_port}")
        options.add_experimental_option("detach", settings.chrome_detach)

    if settings.chrome_headless:
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,1100")

    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(settings.dom_wait_seconds)
    return driver

import { sequence_id } from "./config";
import { windows } from "@crawlora/browser";
import { Page } from "puppeteer-extra-plugin/dist/puppeteer";

type NonNegativeInteger<T extends number> = number extends T
  ? never
  : `${T}` extends `-${string}` | `${string}.${string}`
  ? never
  : T;

export default async function ({ urls }: { urls: string }) {
  const formedData = urls
    .trim()
    .split("\n")
    .map((v) => v.trim());

  await windows(formedData, async (url, { page, wait, output, debug }) => {
    try {
      debug(`Processing URL: ${url}`);

      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

      debug(`Navigated to ${url}`);

      await wait(2);

      // Handle pop-ups or dialogs
      await handlePopUp(page, wait, debug);

      const detail = await scrapeFacebook(page, wait, debug);

      await output.create({
        sequence_id,
        sequence_output: {
          Url: url,
          ...detail,
        },
      });
    } catch (error) {
      const e = error as Error;
      debug(`Error processing URL ${url}: ${e.message}`);
    }
  });
}

async function handlePopUp(
  page: Page,
  wait: <N extends number>(sec: NonNegativeInteger<N>) => Promise<void>,
  debug: debug.Debugger
) {
  try {
    const closeButton = await page.$('div[aria-label="Close"]');
    if (closeButton) {
      debug("Detected Facebook dialog");
      await closeButton.click();
      await wait(1);
      debug("Closed Facebook dialog.");
    }
  } catch (error) {
    const e = error as Error;
    debug(`Error handling pop-up: ${e.message}`);
  }
}

async function scrapeFacebook(
  page: Page,
  wait: <N extends number>(sec: NonNegativeInteger<N>) => Promise<void>,
  debug: debug.Debugger
) {
  return await page.evaluate(() => {
    const getText = (element: Element | null): string =>
      element?.textContent?.trim() || "N/A";

    const mainElement = document.querySelector("div.xvrxa7q");
    if (!mainElement) {
      debug("Main element not found; returning default values.");
      return {
        Followers: "N/A",
        Following: "N/A",
        Username: "N/A",
        Verified_account: "N/A",
      };
    }

    const userText = getText(mainElement.querySelector("h1"));

    let followers = "N/A";
    let following = "N/A";

    Array.from(mainElement.querySelectorAll('a[role="link"]')).forEach(
      (link) => {
        const text = getText(link);
        if (text.includes("followers")) {
          followers = text.replace("followers", "").trim();
        } else if (text.includes("following")) {
          following = text.replace("following", "").trim();
        }
      }
    );

    return {
      Followers: followers,
      Following: following,
      Username: userText?.split("Verified account")[0].trim() || "N/A",
      Verified_account: userText.includes("Verified account"),
    };
  });
}

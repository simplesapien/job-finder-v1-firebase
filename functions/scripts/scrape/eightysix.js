const puppeteer = require("puppeteer");

// Find the description of a job posting
async function findDescription(browser, url) {
  const newPage = await browser.newPage();
  await newPage.goto(url, {
    waitUntil: "networkidle0",
    timeout: 60000,
  });
  const description = await newPage.evaluate(
    () =>
      document.querySelector(".job-posting--details > div > p:nth-of-type(3)")
        .innerText
  );
  await newPage.close();
  return description;
}

// Main scraping function
async function eightysix() {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  // Navigate to the target URL and wait until the network is idle
  await page.goto("https://www.86network.com/search/jobs/vancouver-bc", {
    waitUntil: "networkidle0",
    timeout: 60000,
  });

  const data = await page.evaluate(() => {
    // Get the jobs section of the page
    const list = document.querySelector("div[data-regular-jobs]");
    if (!list) return null;

    // Get all job items
    const listItems = list.querySelectorAll("a");
    let jobs = [];

    // Iterate through job items and extract relevant data
    for (let i = 0; i < listItems.length; i++) {
      const item = listItems[i];
      const jobTitle = item.querySelector(".job-title-headline").textContent;

      // Check if the job title contains certain keywords and doesn't contain certain keywords
      const contain = item.innerText.match(/\b(server|bartender)\b/i);
      const dontContain = item.innerText.match(/\b(assistant)\b/i);
      const matchFound = contain && !dontContain;

      // Added this second check so only desired posts are scraped (featured job listings don't have a date posted)
      let datePosted = item.querySelector(
        ".job-posting-logo-wrapper > div > div:nth-child(2)"
      );

      if (matchFound && datePosted) {
        let unformatteDate = new Date();
        datePosted = datePosted.textContent;
        const dateMatch = datePosted.match(/(\d+)\s*(minute|hour|day)s?/i);

        // The date is written as 'x minutes ago', 'x hours ago', or 'x days ago', so this is a way to normalize it
        const timeUnit = dateMatch[2];
        const value = dateMatch[1];
        if (timeUnit == "minute") {
          unformatteDate.setMinutes(
            unformatteDate.getMinutes() - parseInt(value)
          );
        } else if (timeUnit == "hour") {
          unformatteDate.setHours(unformatteDate.getHours() - parseInt(value));
        } else if (timeUnit == "day") {
          unformatteDate.setDate(unformatteDate.getDate() - parseInt(value));
        }

        // Set the address default to N/A unless an address is found
        let address = "N/A";
        let addressContainer = item.querySelector(
          ".job-posting-card-text > div"
        );

        // Check for presence of an address as a text node (the address isn't wrapped in any kind of element/tag)
        for (var j = 0; j < addressContainer.childNodes.length; j++) {
          var node = addressContainer.childNodes[j];

          // Check if the node is a text node
          if (node.nodeType === Node.TEXT_NODE) {
            let textNode = node.textContent.trim();
            if (textNode != "") address = textNode;
          }
        }

        const job = {
          title: jobTitle,
          link: item.href,
          location: address,
          restaurant: item.querySelector(".bolded-company-name").textContent,
          date: unformatteDate.toString(),
        };

        jobs.push(job);
      }
    }
    return jobs;
  });

  // Add the job descriptions to each job object
  for (let job of data) {
    job.description = await findDescription(browser, job.link);
  }

  await browser.close();

  return data;
}

module.exports = eightysix;
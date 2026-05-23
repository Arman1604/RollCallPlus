import * as cheerio from "cheerio";

const BASE_URL = "https://agclms.in";
const GNDU_RESULT_URL =
  "https://collegeadmissions.gndu.ac.in/studentarea/gnduexamresult.aspx";
const CACHE_TTL = 3 * 60 * 1000;
const MAX_LOGIN_BODY_BYTES = 4096;
const LOGIN_IP_LIMIT = 30;
const LOGIN_IP_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_ACCOUNT_LIMIT = 8;
const LOGIN_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;
const loginCache = new Map();
const rateBuckets = new Map();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

function json(data, status = 200, headers = {}, requestId = "") {
  const payload =
    requestId && data && typeof data === "object" && !Array.isArray(data)
      ? { ...data, requestId }
      : data;

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(requestId ? { "X-Request-Id": requestId } : {}),
      ...headers,
    },
  });
}

function createRequestId() {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `rc-${Date.now().toString(36)}-${random}`;
}

function logEvent(level, event, details = {}) {
  const safeDetails = {
    ...details,
    password: undefined,
  };

  console[level](
    JSON.stringify({
      event,
      ...safeDetails,
    })
  );
}

function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function pruneRateBuckets(now = Date.now()) {
  for (const [key, bucket] of rateBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateBuckets.delete(key);
    }
  }
}

function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  pruneRateBuckets(now);

  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return null;
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  }

  return null;
}

async function readJsonBody(
  request,
  requestId,
  maxBytes = MAX_LOGIN_BODY_BYTES
) {
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength > maxBytes) {
    return {
      response: json({ message: "Request body is too large" }, 413, {}, requestId),
    };
  }

  const bodyText = await request.text();

  if (new TextEncoder().encode(bodyText).length > maxBytes) {
    return {
      response: json({ message: "Request body is too large" }, 413, {}, requestId),
    };
  }

  try {
    const body = bodyText ? JSON.parse(bodyText) : {};

    if (!body || Array.isArray(body) || typeof body !== "object") {
      return {
        response: json(
          { message: "Request body must be a JSON object" },
          400,
          {},
          requestId
        ),
      };
    }

    return { body, bodyText };
  } catch (error) {
    return {
      response: json({ message: "Invalid JSON body" }, 400, {}, requestId),
    };
  }
}

function validateLoginPayload(body, requestId) {
  const rollNumber = String(body.rollNumber || "").trim();
  const password = String(body.password || "");

  if (!rollNumber || !password) {
    return {
      response: json(
        { message: "Roll number and password required" },
        400,
        {},
        requestId
      ),
    };
  }

  if (!/^[A-Za-z0-9/_-]{3,40}$/.test(rollNumber)) {
    return {
      response: json({ message: "Invalid roll number format" }, 400, {}, requestId),
    };
  }

  if (password.length < 1 || password.length > 80) {
    return {
      response: json({ message: "Invalid password length" }, 400, {}, requestId),
    };
  }

  return {
    payload: {
      ...body,
      rollNumber,
      password,
      forceRefresh: body.forceRefresh === true,
    },
  };
}

function validateGnduPayload(body, requestId) {
  const rollNumber = String(body.rollNumber || "").trim();

  if (!/^[0-9A-Za-z/-]{3,20}$/.test(rollNumber)) {
    return {
      response: json(
        { message: "Valid GNDU roll number is required" },
        400,
        {},
        requestId
      ),
    };
  }

  return {
    payload: {
      rollNumber,
      year: String(body.year || ""),
      month: String(body.month || ""),
      courseType: String(body.courseType || ""),
      courseCode: String(body.courseCode || ""),
      semesterCode: String(body.semesterCode || ""),
    },
  };
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function getCacheKey(rollNumber) {
  return `student:${rollNumber}`;
}

function getCachedData(rollNumber) {
  const cached = loginCache.get(getCacheKey(rollNumber));
  if (!cached) return null;

  if (Date.now() - cached.time > CACHE_TTL) {
    loginCache.delete(getCacheKey(rollNumber));
    return null;
  }

  return cached.data;
}

function setCachedData(rollNumber, data) {
  loginCache.set(getCacheKey(rollNumber), {
    time: Date.now(),
    data,
  });
}

function makeFullUrl(src) {
  if (!src) return "";
  if (src.startsWith("http")) return src;
  if (src.startsWith("/")) return `${BASE_URL}${src}`;
  return `${BASE_URL}/${src}`;
}

function cleanValue(value) {
  if (!value) return "Not Available";
  const cleaned = String(value).replace(/\s+/g, " ").replace(/^:/, "").trim();
  return cleaned || "Not Available";
}

function getLines($) {
  return $("body")
    .text()
    .split("\n")
    .map((line) => cleanValue(line))
    .filter((line) => line && line !== "Not Available");
}

function getValueByLabel($, labelName) {
  const lines = getLines($);
  const label = labelName.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i].toLowerCase();

    if (current === label || current === `${label}:`) {
      return cleanValue(lines[i + 1]);
    }

    if (current.startsWith(`${label}:`)) {
      return cleanValue(lines[i].slice(labelName.length + 1));
    }

    if (current.startsWith(label)) {
      const value = lines[i]
        .replace(new RegExp(`^${labelName}`, "i"), "")
        .replace(/^:/, "")
        .trim();

      if (value) return cleanValue(value);
    }
  }

  return "Not Available";
}

function extractProfileData($) {
  const className = getValueByLabel($, "Class Name");
  const batch = getValueByLabel($, "Batch");
  const universityRollNo = getValueByLabel($, "University Rollno");
  const fatherName = getValueByLabel($, "Father Name");
  const motherName = getValueByLabel($, "Mother Name");
  const email = getValueByLabel($, "Email Id");

  let semester = "Not Available";
  let section = "Not Available";
  let labGroup = "Not Available";

  const semMatch = className.match(/Sem[-\s]*([IVX0-9]+)/i);
  if (semMatch?.[1]) semester = `Sem-${semMatch[1].toUpperCase()}`;

  const sectionMatch =
    className.match(/Sec\s*([A-Z]-[A-Z])/i) ||
    className.match(/Section\s*([A-Z]-[A-Z])/i);

  if (sectionMatch?.[1]) section = sectionMatch[1].trim();

  const labGroupMatch = className.match(/Lab Group\s*:?\s*([A-Za-z0-9-]+)/i);
  if (labGroupMatch?.[1]) labGroup = labGroupMatch[1].trim();

  return {
    course: className,
    semester,
    section,
    labGroup,
    batch,
    universityRollNo,
    fatherName,
    motherName,
    email,
  };
}

function findProfileImage($) {
  let selectedImage = "";

  $("img").each((index, img) => {
    const src = $(img).attr("src");

    if (
      src &&
      !src.toLowerCase().includes("agc-amritsar") &&
      !src.toLowerCase().includes("logo") &&
      !src.toLowerCase().includes("banner") &&
      !src.toLowerCase().includes("icon")
    ) {
      selectedImage = src;
    }
  });

  return selectedImage;
}

function findResultBaseUrl(dashboardPage) {
  let resultUrl = "";

  dashboardPage("a").each((index, element) => {
    const text = dashboardPage(element).text().trim().toLowerCase();
    const href = dashboardPage(element).attr("href");

    if (href && text.includes("result")) {
      resultUrl = href.startsWith("http") ? href : makeFullUrl(href);
    }
  });

  return resultUrl || `${BASE_URL}/DashBoardStudent/Results`;
}

function extractResultFromPage($) {
  let sgpa = "0";
  let creditsEarned = "0";
  let resultStatus = "PASS";
  const subjects = [];

  $("table tr").each((index, row) => {
    const cells = $(row)
      .find("td, th")
      .map((i, cell) => cleanValue($(cell).text()))
      .get()
      .filter((cell) => cell && cell !== "Not Available");

    if (cells.length === 0) return;

    const joined = cells.join(" ").toLowerCase();

    if (
      joined.includes("s.no") ||
      joined.includes("subject name") ||
      joined.includes("course") ||
      joined.includes("semester") ||
      joined.includes("rollno") ||
      joined.includes("father") ||
      joined.includes("examination")
    ) {
      return;
    }

    if (joined.includes("sgpa")) {
      const sgpaMatch = joined.match(/sgpa\s*:?[\s-]*([0-9]+(?:\.[0-9]+)?)/i);
      if (sgpaMatch) sgpa = sgpaMatch[1];

      const creditMatch = joined.match(
        /credit[s]?\s*earned\s*:?[\s-]*([0-9]+(?:\.[0-9]+)?)/i
      );
      if (creditMatch) creditsEarned = creditMatch[1];

      if (joined.includes("pass")) resultStatus = "PASS";
      if (joined.includes("fail")) resultStatus = "FAIL";
      if (joined.includes("reappear")) resultStatus = "REAPPEAR";

      return;
    }

    if (cells.length >= 5) {
      const serial = cells[0];
      const name = cells[1];
      const code = cells[2];
      const credits = cells[3];
      const grade = cells[4];

      if (!/^\d+$/.test(serial)) return;

      subjects.push({
        name,
        code,
        credits,
        grade,
      });
    }
  });

  if (creditsEarned === "0" && subjects.length > 0) {
    creditsEarned = String(
      subjects.reduce((sum, subject) => {
        const grade = String(subject.grade || "").toLowerCase();
        const credit = Number(subject.credits || 0);
        if (grade.includes("f") || grade.includes("ab")) return sum;
        return sum + credit;
      }, 0)
    );
  }

  return {
    sgpa,
    creditsEarned,
    resultStatus,
    subjects,
  };
}

function getHiddenFields($) {
  const params = new URLSearchParams();

  $("input[type='hidden']").each((index, element) => {
    const name = $(element).attr("name");
    if (name) params.set(name, $(element).attr("value") || "");
  });

  return params;
}

function getSelectOptions($, selector) {
  const options = [];

  $(selector)
    .find("option")
    .each((index, element) => {
      const value = $(element).attr("value") || "";
      const text = cleanValue($(element).text());

      if (value && text && text !== "Not Available") {
        options.push({ value, text });
      }
    });

  return options;
}

async function postGnduStep(client, html, values) {
  const $ = cheerio.load(html);
  const params = getHiddenFields($);

  Object.entries({
    __EVENTTARGET: "",
    __EVENTARGUMENT: "",
    __LASTFOCUS: "",
    DrpDwnYear: "",
    DrpDwnMonth: "",
    DropDownCourseType: "",
    DrpDwnCMaster: "",
    DrpDwnCdetail: "",
    textboxRno: "",
    ...values,
  }).forEach(([key, value]) => {
    params.set(key, value);
  });

  const response = await client.postForm(
    GNDU_RESULT_URL,
    params.toString(),
    {
      Referer: GNDU_RESULT_URL,
    }
  );

  return response.text;
}

class GnduClient {
  constructor() {
    this.cookies = new Map();
  }

  storeCookies(headers) {
    const getSetCookie =
      typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : splitSetCookieHeader(headers.get("set-cookie"));

    getSetCookie.forEach((cookie) => {
      const pair = cookie.split(";")[0];
      const index = pair.indexOf("=");
      if (index <= 0) return;
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    });
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  async request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "User-Agent": "RollCallPlus-Cloudflare-GNDU",
        ...(this.cookieHeader() ? { Cookie: this.cookieHeader() } : {}),
        ...(options.headers || {}),
      },
    });

    this.storeCookies(response.headers);
    return response;
  }

  async get(url) {
    const response = await this.request(url, {
      method: "GET",
    });

    return {
      response,
      text: await response.text(),
      url: response.url,
    };
  }

  async postForm(url, body, headers = {}) {
    const response = await this.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...headers,
      },
      body,
    });

    return {
      response,
      text: await response.text(),
      url: response.url,
    };
  }
}

function extractGnduResultFromPage(html, meta = {}) {
  const $ = cheerio.load(html);
  const result = extractResultFromPage($);
  const pageText = cleanValue($("body").text());
  const statusMatch = pageText.match(/Result\s*:\s*([A-Za-z ]+)(?:\s*-\s*([0-9]+))?/i);
  const totalMatch = pageText.match(/Total Marks\s+([0-9]+)\s+([0-9]+)/i);

  if (result.sgpa === "0") {
    const sgpaMatch = pageText.match(/(?:sgpa|grade point average)\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)/i);
    if (sgpaMatch) result.sgpa = sgpaMatch[1];
  }

  if (statusMatch) {
    result.resultStatus = cleanValue(statusMatch[1]).toUpperCase();
  }

  if (totalMatch) {
    const obtained = Number(totalMatch[1]);
    const total = Number(totalMatch[2]);

    if (obtained > 0 && total > 0 && result.sgpa === "0") {
      result.sgpa = ((obtained / total) * 10).toFixed(2);
      result.creditsEarned = `${obtained}/${total}`;
    }
  }

  if (result.subjects.length === 0) {
    $("tr").each((index, row) => {
      const cells = $(row)
        .find("td")
        .map((cellIndex, cell) => cleanValue($(cell).text()))
        .get()
        .filter((value) => value && value !== "Not Available");

      if (cells.length >= 4 && /[A-Z]{1,2}\+?|PASS|FAIL|REAPPEAR/i.test(cells[cells.length - 1])) {
        result.subjects.push({
          code: cells[0],
          name: cells[1] || cells[0],
          credits: cells.find((value) => /^[0-9]+(?:\.[0-9]+)?$/.test(value)) || "0",
          grade: cells[cells.length - 1],
        });
      }

      if (/^PAPER[-\s]?[IVX]+/i.test(cells[0] || "") && cells.length >= 5) {
        const marks = cells
          .slice(1)
          .filter((value) => /^[0-9]+$/.test(value))
          .map(Number);
        const obtained = marks[0] || 0;
        const maximum = marks[marks.length - 1] || 100;

        result.subjects.push({
          code: cells[0].split(":")[0],
          name: cleanValue(cells[0].replace(/^PAPER[-\s]?[IVX]+\s*:\s*/i, "")),
          credits: String(maximum),
          grade: String(obtained),
        });
      }
    });
  }

  return {
    available:
      result.sgpa !== "0" ||
      result.subjects.length > 0 ||
      !!totalMatch ||
      !!statusMatch,
    semester: meta.semester || "GNDU Semester",
    source: "GNDU",
    ...result,
  };
}

async function scrapeGnduResult(payload) {
  const years = payload.year
    ? [payload.year]
    : [new Date().getFullYear().toString()];
  const months = payload.month ? [payload.month] : ["5"];
  const courseTypes = payload.courseType ? [payload.courseType] : ["P"];
  const inferredCourseCode =
    payload.courseCode || payload.rollNumber.match(/^\d{4}/)?.[0] || "";
  const targetSemesterCode = payload.semesterCode || "";
  const collected = [];
  const diagnostics = {
    sessionsChecked: 0,
    lawCoursesFound: 0,
    targetedCourseCode: inferredCourseCode || "Not available",
    semestersChecked: 0,
  };
  const client = new GnduClient();

  for (const year of years) {
    for (const month of months) {
      for (const courseType of courseTypes) {
        diagnostics.sessionsChecked += 1;
        let html = (await client.get(GNDU_RESULT_URL)).text;

        html = await postGnduStep(client, html, {
          __EVENTTARGET: "DrpDwnYear",
          DrpDwnYear: year,
        });
        html = await postGnduStep(client, html, {
          __EVENTTARGET: "DrpDwnMonth",
          DrpDwnYear: year,
          DrpDwnMonth: month,
        });
        html = await postGnduStep(client, html, {
          __EVENTTARGET: "DropDownCourseType",
          DrpDwnYear: year,
          DrpDwnMonth: month,
          DropDownCourseType: courseType,
        });

        const coursePage = cheerio.load(html);
        const lawCourses = getSelectOptions(coursePage, "#DrpDwnCMaster").filter(
          (item) =>
            /law|ll\.?\s*b|b\.?\s*a\.?\s*ll\.?\s*b|bba\s*ll\.?\s*b|b\.?\s*com\s*ll\.?\s*b/i.test(
              item.text
            )
        );
        const targetedCourses = inferredCourseCode
          ? lawCourses.filter(
              (item) =>
                item.value === inferredCourseCode ||
                item.text.includes(`(${inferredCourseCode})`)
            )
          : lawCourses;
        const coursesToCheck =
          targetedCourses.length > 0 ? targetedCourses : lawCourses.slice(0, 2);

        diagnostics.lawCoursesFound += lawCourses.length;

        for (const course of coursesToCheck) {
          let semesterHtml = await postGnduStep(client, html, {
            __EVENTTARGET: "DrpDwnCMaster",
            DrpDwnYear: year,
            DrpDwnMonth: month,
            DropDownCourseType: courseType,
            DrpDwnCMaster: course.value,
          });
          const semesterPage = cheerio.load(semesterHtml);
          const semesters = getSelectOptions(semesterPage, "#DrpDwnCdetail").filter(
            (item) => !targetSemesterCode || item.value === targetSemesterCode
          );

          for (const semester of semesters) {
            diagnostics.semestersChecked += 1;
            const readyHtml = await postGnduStep(client, semesterHtml, {
              __EVENTTARGET: "DrpDwnCdetail",
              DrpDwnYear: year,
              DrpDwnMonth: month,
              DropDownCourseType: courseType,
              DrpDwnCMaster: course.value,
              DrpDwnCdetail: semester.value,
            });
            const resultHtml = await postGnduStep(client, readyHtml, {
              DrpDwnYear: year,
              DrpDwnMonth: month,
              DropDownCourseType: courseType,
              DrpDwnCMaster: course.value,
              DrpDwnCdetail: semester.value,
              textboxRno: payload.rollNumber,
              buttonShowResult: "Submit",
            });
            const result = extractGnduResultFromPage(resultHtml, {
              semester: semester.text,
            });

            if (result.available) {
              collected.push({
                ...result,
                course: course.text,
                year,
                month,
                courseType,
              });
            }
          }
        }
      }
    }
  }

  if (collected.length === 0) {
    return {
      available: false,
      message: "GNDU result not found for this roll number yet",
      diagnostics,
      results: [],
    };
  }

  return {
    available: true,
    current: collected[0],
    results: collected,
    diagnostics,
  };
}

function getClassOptions($) {
  const classOptions = [];

  $("select#ClassCode option, select[name='ClassCode'] option").each(
    (index, option) => {
      const value = $(option).attr("value");
      const text = $(option).text().trim();

      if (
        value &&
        value !== "-1" &&
        text &&
        !text.toLowerCase().includes("select")
      ) {
        classOptions.push({
          value,
          semester: text || `Semester ${index}`,
          selected: $(option).is(":selected"),
        });
      }
    }
  );

  return classOptions;
}

function splitSetCookieHeader(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,=\s]+=[^;]+)/g).map((item) => item.trim());
}

class PortalClient {
  constructor() {
    this.cookies = new Map();
  }

  storeCookies(headers) {
    const getSetCookie =
      typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : splitSetCookieHeader(headers.get("set-cookie"));

    getSetCookie.forEach((cookie) => {
      const pair = cookie.split(";")[0];
      const index = pair.indexOf("=");
      if (index <= 0) return;
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    });
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  async request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        ...(this.cookieHeader() ? { Cookie: this.cookieHeader() } : {}),
        ...(options.headers || {}),
      },
    });

    this.storeCookies(response.headers);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        return this.request(makeFullUrl(location), {
          method: "GET",
        });
      }
    }

    return response;
  }

  async get(url) {
    const response = await this.request(url, {
      method: "GET",
    });

    return {
      response,
      text: await response.text(),
      url: response.url,
    };
  }

  async postForm(url, body) {
    const response = await this.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    return {
      response,
      text: await response.text(),
      url: response.url,
    };
  }
}

async function imageToBase64(client, imageUrl) {
  if (!imageUrl) return "";

  try {
    const response = await client.request(imageUrl, {
      method: "GET",
    });

    if (!response.ok) return imageUrl;

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return `data:${contentType};base64,${btoa(binary)}`;
  } catch (error) {
    console.log("Image fetch failed:", error.message);
    return imageUrl;
  }
}

async function scrapeResult(client, dashboardPage) {
  const baseResultUrl = findResultBaseUrl(dashboardPage);
  const resultResponse = await client.get(baseResultUrl);
  const $ = cheerio.load(resultResponse.text);
  const classOptions = getClassOptions($);

  if (classOptions.length === 0) {
    const singleResult = extractResultFromPage($);

    if (singleResult.sgpa === "0" && singleResult.subjects.length === 0) {
      throw new Error("Result dropdown not found and result table empty");
    }

    return {
      available: true,
      current: {
        semester: "Current Semester",
        ...singleResult,
      },
      results: [
        {
          semester: "Current Semester",
          ...singleResult,
        },
      ],
    };
  }

  const results = [];

  for (const item of classOptions) {
    try {
      const semUrl = `${BASE_URL}/DashBoardStudent/Results?ClassCode=${encodeURIComponent(
        item.value
      )}`;
      const semResponse = await client.get(semUrl);
      const semPage = cheerio.load(semResponse.text);
      const semResult = extractResultFromPage(semPage);

      if (semResult.sgpa !== "0" || semResult.subjects.length > 0) {
        results.push({
          semester: item.semester,
          selected: item.selected,
          sgpa:
            semResult.sgpa === "0" && semResult.subjects.length > 0
              ? "Not Declared"
              : semResult.sgpa,
          creditsEarned: semResult.creditsEarned,
          resultStatus:
            semResult.sgpa === "0" && semResult.subjects.length > 0
              ? "REAPPEAR / PENDING"
              : semResult.resultStatus,
          subjects: semResult.subjects,
        });
      }
    } catch (error) {
      console.log(`Semester scrape failed for ${item.semester}:`, error.message);
    }
  }

  if (results.length === 0) {
    throw new Error("Result not available");
  }

  return {
    available: true,
    current: results.find((item) => item.selected) || results[0],
    results,
  };
}

async function scrapeSubjectAttendance(client, subject) {
  try {
    const reportResponse = await client.get(subject.url);
    const reportPage = cheerio.load(reportResponse.text);

    let present = 0;
    let absent = 0;
    let leave = 0;
    let dutyLeave = 0;
    const history = [];

    reportPage("tr").each((index, row) => {
      const cells = reportPage(row).find("td");

      if (cells.length >= 2) {
        const date = reportPage(cells[0]).text().trim();
        const status = reportPage(cells[1]).text().trim().toUpperCase();

        if (!date || !status) return;

        if (status === "PRESENT") present++;
        else if (status === "ABSENT") absent++;
        else if (status === "LEAVE") leave++;
        else if (status === "DUTY LEAVE") dutyLeave++;

        history.push({ date, status });
      }
    });

    const attended = present + dutyLeave;
    const missed = absent + leave;
    const total = present + absent + leave + dutyLeave;

    return {
      name: subject.name,
      present,
      absent,
      leave,
      dutyLeave,
      attended,
      missed,
      total,
      history,
    };
  } catch (error) {
    console.log(`Attendance failed for ${subject.name}:`, error.message);

    return {
      name: subject.name,
      present: 0,
      absent: 0,
      leave: 0,
      dutyLeave: 0,
      attended: 0,
      missed: 0,
      total: 0,
      history: [],
      error: "Could not fetch this subject",
    };
  }
}

async function scrapeLogin(payload) {
  const startedAt = Date.now();
  const { rollNumber, password, forceRefresh, requestId } = payload;

  if (!rollNumber || !password) {
    return json(
      { message: "Roll number and password required" },
      400,
      {},
      requestId
    );
  }

  if (!forceRefresh) {
    const cached = getCachedData(rollNumber);
    if (cached) {
      return json({
        ...cached,
        cached: true,
        runtime: "cloudflare-native",
        responseTimeMs: Date.now() - startedAt,
      }, 200, {}, requestId);
    }
  }

  const client = new PortalClient();

  await client.postForm(
    `${BASE_URL}/Elogin/StudentLogin`,
    new URLSearchParams({
      StudentId: rollNumber,
      Password: password,
    }).toString()
  );

  const dashboardResponse = await client.get(`${BASE_URL}/DashBoardStudent`);

  if (dashboardResponse.url.includes("Elogin")) {
    logEvent("warn", "login.invalid_credentials", {
      requestId,
      rollNumber,
      route: "/login",
      runtime: "cloudflare-native",
    });

    return json(
      { message: "Invalid roll number or password" },
      401,
      {},
      requestId
    );
  }

  const $ = cheerio.load(dashboardResponse.text);

  const detailResponse = await client.get(`${BASE_URL}/DashBoardStudent/Detail`);
  const detailPage = cheerio.load(detailResponse.text);
  const studentNameFromDetail = getValueByLabel(detailPage, "Name");

  const studentName =
    studentNameFromDetail !== "Not Available"
      ? studentNameFromDetail
      : $("body")
          .text()
          .split("Role:")[0]
          .trim()
          .split("\n")
          .map((text) => text.trim())
          .filter(Boolean)
          .pop() || "Student";

  const profileData = extractProfileData(detailPage);
  const rawProfileImage = findProfileImage(detailPage);
  const finalPhotoUrl = makeFullUrl(rawProfileImage);
  const attendanceLinks = [];

  $("a").each((index, element) => {
    const text = $(element).text().trim();

    if (text === "Attendance") {
      const href = $(element).attr("href");
      const row = $(element).closest("tr");
      const subjectName = row.find("td").first().text().trim();

      if (href && subjectName) {
        attendanceLinks.push({
          name: subjectName,
          url: href.startsWith("http") ? href : makeFullUrl(href),
        });
      }
    }
  });

  const [attendance, photoBase64, resultData] = await Promise.all([
    Promise.all(
      attendanceLinks.map((subject) => scrapeSubjectAttendance(client, subject))
    ),
    imageToBase64(client, finalPhotoUrl),
    scrapeResult(client, $).catch((error) => {
      logEvent("warn", "result.scrape_failed", {
        requestId,
        rollNumber,
        route: "/login",
        runtime: "cloudflare-native",
        error: String(error?.message || error),
      });

      return {
        available: false,
        message: "Result not available in college portal",
        sgpa: "0",
        creditsEarned: "0",
        resultStatus: "Not Available",
        subjects: [],
        results: [],
      };
    }),
  ]);

  const responsePayload = {
    student: {
      name: studentName,
      rollNumber,
      course: profileData.course,
      semester: profileData.semester,
      section: profileData.section,
      labGroup: profileData.labGroup,
      batch: profileData.batch,
      universityRollNo: profileData.universityRollNo,
      fatherName: profileData.fatherName,
      motherName: profileData.motherName,
      email: profileData.email,
      photo: photoBase64 || finalPhotoUrl,
    },
    attendance,
    result: resultData.current || resultData,
    results: resultData.results || [],
    cached: false,
    runtime: "cloudflare-native",
    responseTimeMs: Date.now() - startedAt,
    requestId,
  };

  setCachedData(rollNumber, responsePayload);
  return json(responsePayload, 200, {}, requestId);
}

async function proxyToRailway(request, env, pathname, requestId) {
  const baseUrl = normalizeBaseUrl(env.RAILWAY_BACKEND_URL);

  if (!baseUrl || baseUrl.includes("replace-with-your-railway-url")) {
    return json(
      {
        message: "Cloudflare worker is missing RAILWAY_BACKEND_URL.",
      },
      500,
      {},
      requestId
    );
  }

  const upstreamUrl = `${baseUrl}${pathname}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: {
        "Content-Type": request.headers.get("Content-Type") || "application/json",
        "User-Agent": "RollCallPlus-Cloudflare-Proxy",
      },
      body: request.method === "GET" ? undefined : await request.text(),
      signal: controller.signal,
    });

    const responseHeaders = new Headers(upstreamResponse.headers);
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
    responseHeaders.set("Cache-Control", "no-store");
    responseHeaders.set("X-RollCall-Runtime", "railway-proxy");
    responseHeaders.set("X-Request-Id", requestId);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const aborted = error?.name === "AbortError";
    logEvent("error", "railway.proxy_failed", {
      requestId,
      route: pathname,
      runtime: "railway-proxy",
      status: aborted ? 504 : 502,
      error: String(error?.message || error),
    });

    return json(
      {
        message: aborted
          ? "Portal sync timed out before the backend responded."
          : "Cloudflare proxy failed to reach Railway backend.",
        error: String(error?.message || error),
      },
      aborted ? 504 : 502,
      {},
      requestId
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function handleLogin(request, env, requestId) {
  const bodyResult = await readJsonBody(request, requestId);
  if (bodyResult.response) {
    return bodyResult.response;
  }

  const { body, bodyText } = bodyResult;
  const validation = validateLoginPayload(body, requestId);
  if (validation.response) {
    return validation.response;
  }

  const payload = {
    ...validation.payload,
    requestId,
  };
  const retryAfterForIp = checkRateLimit(
    `ip:${getClientIp(request)}`,
    LOGIN_IP_LIMIT,
    LOGIN_IP_WINDOW_MS
  );

  if (retryAfterForIp) {
    return json(
      {
        message: "Too many login attempts. Please try again shortly.",
        retryAfterSeconds: retryAfterForIp,
      },
      429,
      { "Retry-After": String(retryAfterForIp) },
      requestId
    );
  }

  const retryAfterForAccount = checkRateLimit(
    `account:${payload.rollNumber.toLowerCase()}`,
    LOGIN_ACCOUNT_LIMIT,
    LOGIN_ACCOUNT_WINDOW_MS
  );

  if (retryAfterForAccount) {
    return json(
      {
        message: "Too many attempts for this account. Please wait a few minutes.",
        retryAfterSeconds: retryAfterForAccount,
      },
      429,
      { "Retry-After": String(retryAfterForAccount) },
      requestId
    );
  }

  const useNativeScraper = env.USE_NATIVE_SCRAPER === "true";

  if (!useNativeScraper) {
    return proxyToRailway(
      new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: bodyText,
      }),
      env,
      "/login",
      requestId
    );
  }

  try {
    return await scrapeLogin(payload);
  } catch (error) {
    const aborted = error?.name === "AbortError";
    logEvent("error", "native.scraper_failed", {
      requestId,
      rollNumber: payload.rollNumber,
      route: "/login",
      runtime: "cloudflare-native",
      status: aborted ? 504 : 500,
      error: String(error?.message || error),
    });

    if (env.NATIVE_FALLBACK_TO_RAILWAY !== "false") {
      return proxyToRailway(
        new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: bodyText,
        }),
        env,
        "/login",
        requestId
      );
    }

    return json(
      {
        message: aborted
          ? "AGC portal took too long to respond. Please try again."
          : "Cloudflare native scraper failed",
        error: String(error?.message || error),
      },
      aborted ? 504 : 500,
      {},
      requestId
    );
  }
}

async function handleGnduResult(request, requestId) {
  const bodyResult = await readJsonBody(request, requestId);
  if (bodyResult.response) {
    return bodyResult.response;
  }

  const validation = validateGnduPayload(bodyResult.body, requestId);
  if (validation.response) {
    return validation.response;
  }

  try {
    const data = await scrapeGnduResult(validation.payload);

    return json(
      {
        ...data,
        runtime: "cloudflare-gndu",
      },
      data.available ? 200 : 404,
      {},
      requestId
    );
  } catch (error) {
    logEvent("error", "gndu.scraper_failed", {
      requestId,
      route: "/gndu-result",
      runtime: "cloudflare-gndu",
      status: 500,
      error: String(error?.message || error),
    });

    return json(
      {
        message: "GNDU result scraper failed",
        error: String(error?.message || error),
      },
      500,
      {},
      requestId
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const requestId = createRequestId();

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...CORS_HEADERS,
          "X-Request-Id": requestId,
        },
      });
    }

    try {
      if (url.pathname === "/" || url.pathname === "/health") {
        return json(
          {
            status: "success",
            service: "RollCall+ Cloudflare API",
            version: "cloudflare-native-v1",
            nativeScraperEnabled: env.USE_NATIVE_SCRAPER === "true",
            railwayFallbackEnabled: env.NATIVE_FALLBACK_TO_RAILWAY !== "false",
            upstreamConfigured:
              !!env.RAILWAY_BACKEND_URL &&
              !env.RAILWAY_BACKEND_URL.includes("replace-with-your-railway-url"),
          },
          200,
          {},
          requestId
        );
      }

      if (url.pathname === "/login") {
        if (request.method !== "POST") {
          return json({ message: "Method not allowed" }, 405, {}, requestId);
        }

        return handleLogin(request, env, requestId);
      }

      if (url.pathname === "/gndu-result") {
        if (request.method !== "POST") {
          return json({ message: "Method not allowed" }, 405, {}, requestId);
        }

        return handleGnduResult(request, requestId);
      }

      return json({ message: "Not found" }, 404, {}, requestId);
    } catch (error) {
      logEvent("error", "worker.unhandled_error", {
        requestId,
        route: url.pathname,
        method: request.method,
        status: 500,
        error: String(error?.message || error),
      });

      return json(
        {
          message: "RollCall+ API hit an unexpected error.",
          error: String(error?.message || error),
        },
        500,
        {},
        requestId
      );
    }
  },
};

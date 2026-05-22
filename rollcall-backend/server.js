const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const BASE_URL = "https://agclms.in";
const CACHE_TTL = 3 * 60 * 1000;
const loginCache = new Map();

function getCacheKey(rollNumber) {
  return `student:${rollNumber}`;
}

function getCachedData(rollNumber) {
  const cached = loginCache.get(getCacheKey(rollNumber));
  if (!cached) return null;

  const expired = Date.now() - cached.time > CACHE_TTL;
  if (expired) {
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

async function imageToBase64(client, imageUrl) {
  if (!imageUrl) return "";

  try {
    const response = await client.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 8000,
    });

    const contentType = response.headers["content-type"] || "image/jpeg";
    const base64 = Buffer.from(response.data, "binary").toString("base64");

    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.log("Image fetch failed:", error.message);
    return imageUrl;
  }
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

async function findFinalResultUrl(client, dashboardPage) {
  const baseResultUrl = findResultBaseUrl(dashboardPage);

  console.log("BASE RESULT URL:", baseResultUrl);

  const firstResponse = await client.get(baseResultUrl);
  const firstPage = cheerio.load(firstResponse.data);

  const classCode =
    firstPage("select#ClassCode option, select[name='ClassCode'] option")
      .filter((i, el) => {
        const value = firstPage(el).attr("value");
        return value && value !== "-1";
      })
      .first()
      .attr("value") || "";

  console.log("FIRST CLASSCODE FOUND:", classCode || "NONE");

  if (classCode) {
    return `${BASE_URL}/DashBoardStudent/Results?ClassCode=${encodeURIComponent(
      classCode
    )}`;
  }

  return baseResultUrl;
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
    const earned = subjects.reduce((sum, subject) => {
      const grade = String(subject.grade || "").toLowerCase();
      const credit = Number(subject.credits || 0);

      if (grade.includes("f") || grade.includes("ab")) return sum;
      return sum + credit;
    }, 0);

    creditsEarned = String(earned);
  }

  return {
    sgpa,
    creditsEarned,
    resultStatus,
    subjects,
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

function logDropdowns($) {
  $("select").each((i, select) => {
    console.log("SELECT FOUND:", {
      index: i,
      id: $(select).attr("id") || "",
      name: $(select).attr("name") || "",
    });

    $(select)
      .find("option")
      .each((j, option) => {
        console.log("OPTION FOUND:", {
          selectIndex: i,
          optionIndex: j,
          value: $(option).attr("value") || "",
          text: $(option).text().trim(),
        });
      });
  });
}

async function scrapeResult(client, dashboardPage) {
  console.log("SCRAPE RESULT FUNCTION STARTED");
  const baseResultUrl = findResultBaseUrl(dashboardPage);

  console.log("BASE RESULT URL:", baseResultUrl);

  const resultResponse = await client.get(baseResultUrl);
  const $ = cheerio.load(resultResponse.data);

  logDropdowns($);

  const classOptions = getClassOptions($);

  console.log("CLASS OPTIONS FOUND:", JSON.stringify(classOptions, null, 2));

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

      console.log("SCRAPING SEMESTER:", item.semester, semUrl);

      const semResponse = await client.get(semUrl);
      const semPage = cheerio.load(semResponse.data);
      const semResult = extractResultFromPage(semPage);

      console.log("SEMESTER RESULT:", {
        semester: item.semester,
        sgpa: semResult.sgpa,
        subjects: semResult.subjects.length,
      });

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
    const reportResponse = await client.get(subject.url, {
      timeout: 12000,
    });

    const reportPage = cheerio.load(reportResponse.data);

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

app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "RollCall+ backend is running 🚀",
  });
});

app.post("/login", async (req, res) => {
  const startedAt = Date.now();

  try {
    const { rollNumber, password, forceRefresh } = req.body;

    if (!rollNumber || !password) {
      return res.status(400).json({
        message: "Roll number and password required",
      });
    }

    console.log("LOGIN REQUEST:", {
      rollNumber,
      forceRefresh: Boolean(forceRefresh),
    });

    if (!forceRefresh) {
      const cached = getCachedData(rollNumber);

      if (cached) {
        console.log("LOGIN CACHE HIT:", rollNumber);

        return res.json({
          ...cached,
          cached: true,
          responseTimeMs: Date.now() - startedAt,
        });
      }
    }

    const jar = new CookieJar();

    const client = wrapper(
      axios.create({
        jar,
        withCredentials: true,
        timeout: 15000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        },
      })
    );

    await client.post(
      `${BASE_URL}/Elogin/StudentLogin`,
      new URLSearchParams({
        StudentId: rollNumber,
        Password: password,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const dashboardResponse = await client.get(`${BASE_URL}/DashBoardStudent`);

    if (dashboardResponse.request.res.responseUrl.includes("Elogin")) {
      return res.status(401).json({
        message: "Invalid roll number or password",
      });
    }

    const $ = cheerio.load(dashboardResponse.data);

    const detailResponse = await client.get(
      `${BASE_URL}/DashBoardStudent/Detail`
    );
    const detailPage = cheerio.load(detailResponse.data);

    const studentNameFromDetail = getValueByLabel(detailPage, "Name");

    const studentName =
      studentNameFromDetail !== "Not Available"
        ? studentNameFromDetail
        : $("body")
            .text()
            .split("Role:")[0]
            .trim()
            .split("\n")
            .map((t) => t.trim())
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
        attendanceLinks.map((subject) =>
          scrapeSubjectAttendance(client, subject)
        )
      ),

      imageToBase64(client, finalPhotoUrl),

      scrapeResult(client, $).catch((error) => {
        console.log("Result scraping failed:", error.message);

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

    const payload = {
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
      responseTimeMs: Date.now() - startedAt,
    };

    setCachedData(rollNumber, payload);

    res.json(payload);
  } catch (error) {
    console.log("Login scrape error:", error.message);

    res.status(500).json({
      message: "Portal scraping failed",
      error: error.message,
      responseTimeMs: Date.now() - startedAt,
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 RollCall+ backend running on port ${PORT}`);
});

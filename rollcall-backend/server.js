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
  const cleaned = value.replace(/\s+/g, " ").replace(/^:/, "").trim();
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

  const firstResponse = await client.get(baseResultUrl);
  const firstPage = cheerio.load(firstResponse.data);

  const classCode =
    firstPage("select#ClassCode option")
      .filter((i, el) => firstPage(el).attr("value") !== "-1")
      .first()
      .attr("value") || "";

  if (classCode) {
    return `${BASE_URL}/DashBoardStudent/Results?ClassCode=${classCode}`;
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
      const sgpaMatch = joined.match(/sgpa\s*([0-9]+(?:\.[0-9]+)?)/i);
      if (sgpaMatch) sgpa = sgpaMatch[1];

      const creditMatch = joined.match(
        /credit[s]?\s*earned\s*([0-9]+(?:\.[0-9]+)?)/i
      );
      if (creditMatch) creditsEarned = creditMatch[1];

      if (joined.includes("pass")) resultStatus = "PASS";
      if (joined.includes("fail")) resultStatus = "FAIL";
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

async function scrapeResult(client, dashboardPage) {
  const resultUrl = await findFinalResultUrl(client, dashboardPage);
  console.log("FINAL RESULT URL:", resultUrl);

  const resultResponse = await client.get(resultUrl);
  const $ = cheerio.load(resultResponse.data);

  const resultData = extractResultFromPage($);

  if (resultData.sgpa === "0" && resultData.subjects.length > 0) {
    return {
      available: true,
      message: "Result published but SGPA not declared due to reappear/detention",
      sgpa: "Not Declared",
      creditsEarned: resultData.creditsEarned,
      resultStatus: "REAPPEAR / PENDING",
      subjects: resultData.subjects,
    };
  }

  if (resultData.sgpa === "0" && resultData.subjects.length === 0) {
    throw new Error("Result not available");
  }

  return {
    available: true,
    message: "Result fetched successfully",
    sgpa: resultData.sgpa,
    creditsEarned: resultData.creditsEarned,
    resultStatus: resultData.resultStatus,
    subjects: resultData.subjects,
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

    if (!forceRefresh) {
      const cached = getCachedData(rollNumber);

      if (cached) {
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

    const detailResponse = await client.get(`${BASE_URL}/DashBoardStudent/Detail`);
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
        attendanceLinks.map((subject) => scrapeSubjectAttendance(client, subject))
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
      result: resultData,
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
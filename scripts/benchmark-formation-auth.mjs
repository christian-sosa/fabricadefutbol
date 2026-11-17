import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const spec = "tests/e2e/formations.spec.ts";
const profiles = ["chromium", "mobile-chromium"];
const versions = {
  main: { sha: "cdec0df373aac409d95aff5f2084a603eef66083", helper: "login" },
  pr: { sha: "35fb929d2026c856f210283b5083ef76ac8cf078", helper: "ensureAdminSession" },
};

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trimEnd();
}

function prepare(variant) {
  assert.ok(Object.hasOwn(versions, variant), "Unknown benchmark variant");
  const { sha, helper } = versions[variant];
  assert.equal(git("diff", "--name-only", versions.main.sha, versions.pr.sha), spec);
  const source = git("show", sha + ":" + spec);
  const call = "await " + helper + "(page);";
  assert.equal(source.split(call).length, 3, "Expected both formation authentication call sites");
  const instrumentedCalls = source.replaceAll(call, "await measureAdminSession(page);");

  const pointReader = "async function currentPoints(page: Page) {";
  assert.equal(instrumentedCalls.split(pointReader).length, 2);
  const mode = variant === "main" ? '"form"' : 'adminSessionCookies ? "reuse" : "form"';
  const timer = [
    "async function measureAdminSession(page: Page) {",
    "  const mode = " + mode + ";",
    "  const start = performance.now();",
    "  " + call,
    '  const elapsed = (performance.now() - start).toFixed(2);',
    '  console.log("FDF_AB_AUTH " + process.env.E2E_REPORT_PROJECT + " " + mode + " " + elapsed);',
    "}",
    "",
  ].join("\n");

  const snapshotEnd = '          stylePath: path.resolve("tests/e2e/visual-pitch.css")\n        });';
  assert.equal(instrumentedCalls.split(snapshotEnd).length, 2, "Expected the existing visual assertion");
  const snapshotMarker = '        console.log("FDF_AB_SNAPSHOT " + testInfo.project.name + " " + scenario.modality);';
  const output = instrumentedCalls
    .replace(pointReader, timer + "\n" + pointReader)
    .replace(snapshotEnd, snapshotEnd + "\n" + snapshotMarker);
  writeFileSync(spec, output + "\n");
  console.log("FDF_AB_VARIANT " + variant + " " + sha);
}

function parse(variant, path) {
  const log = readFileSync(path, "utf8").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
  const snapshots = [...log.matchAll(/^FDF_AB_SNAPSHOT (\S+) (\S+)$/gm)].map((row) => row[1] + " " + row[2]).sort();
  const expectedSnapshots = profiles.flatMap((profile) => ["5v5", "11v11"].map((mode) => profile + " " + mode)).sort();
  assert.deepEqual(snapshots, expectedSnapshots, variant + " snapshot comparisons");
  const completedProfiles = [...log.matchAll(/^\s+18 passed \(/gm)];
  assert.equal(completedProfiles.length, 2, variant + " Playwright summaries");

  const cases = [...log.matchAll(/^\s*✓\s+\d+\s+\[(chromium|mobile-chromium)\]\s+›\s+(tests\/e2e\/.*?):\d+:\d+\s+›\s+(.*?)\s+\(([\d.]+[a-z]+(?: [\d.]+[a-z]+)*)\)\s*$/gmu)];
  assert.equal(cases.length, 36, variant + " passing test count");
  const testIds = cases.map((row) => [row[1], row[2], row[3]].join(" / ")).sort();
  assert.equal(new Set(testIds).size, 36, variant + " unique test count");

  const authentications = [...log.matchAll(/^FDF_AB_AUTH (chromium|mobile-chromium) (form|reuse) ([\d.]+)$/gm)];
  assert.equal(authentications.length, 14, variant + " formation authentication samples");
  const metrics = profiles.map((profile) => {
    const tests = cases.filter((row) => row[1] === profile);
    assert.equal(tests.length, 18, profile + " passing cases");
    const formations = tests.filter((row) => row[2] === spec);
    assert.equal(formations.length, 7, profile + " passing formation cases");
    const activeAuth = authentications.filter((row) => row[1] === profile);
    const form = activeAuth.filter((row) => row[2] === "form").map((row) => Number(row[3]));
    const reuse = activeAuth.filter((row) => row[2] === "reuse").map((row) => Number(row[3]));
    assert.equal(form.length, variant === "main" ? 7 : 1, profile + " real logins");
    assert.equal(reuse.length, variant === "main" ? 0 : 6, profile + " restored sessions");

    return {
      profile,
      formMs: form,
      reuseMs: reuse,
      authMs: [...form, ...reuse].reduce((total, value) => total + value, 0),
      formationSeconds: formations.reduce((total, row) => {
        return total + [...row[4].matchAll(/([\d.]+)(ms|s|m)/g)].reduce(
          (seconds, [, value, unit]) => seconds + Number(value) * { ms: 0.001, s: 1, m: 60 }[unit],
          0,
        );
      }, 0),
    };
  });
  return { testIds, metrics };
}

function compare(mainLog, prLog) {
  const main = parse("main", mainLog);
  const pr = parse("pr", prLog);
  assert.deepEqual(pr.testIds, main.testIds, "Playwright case identity differs");
  const totalAuth = ({ metrics }) => metrics.reduce((total, profile) => total + profile.authMs, 0);
  const mainAuthMs = totalAuth(main);
  const prAuthMs = totalAuth(pr);
  const result = {
    main: main.metrics,
    pr: pr.metrics,
    mainAuthMs,
    prAuthMs,
    authSavingsMs: mainAuthMs - prAuthMs,
    casesPerVariant: 36,
    snapshotsPerVariant: 4,
  };
  console.log("FDF_AB_RESULT " + JSON.stringify(result));
  const seconds = (ms) => (ms / 1_000).toFixed(2);
  const summary = [
    "## Formación E2E A/B",
    "",
    "36 casos idénticos y cuatro comparaciones visuales aprobadas por variante.",
    "",
    "| Perfil | Preparación de sesión main | Preparación de sesión PR #29 | Ahorro |",
    "| --- | ---: | ---: | ---: |",
    ...main.metrics.map((row, index) => {
      const newRow = pr.metrics[index];
      return "| " + row.profile + " | " + seconds(row.authMs) + " s | "
        + seconds(newRow.authMs) + " s | " + seconds(row.authMs - newRow.authMs) + " s |";
    }),
    "| Total | " + seconds(mainAuthMs) + " s | " + seconds(prAuthMs) + " s | "
      + seconds(result.authSavingsMs) + " s |",
    "",
  ].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

const [task, first, second] = process.argv.slice(2);
if (task === "prepare") prepare(first);
else if (task === "compare") compare(first, second);
else throw new Error("Expected prepare or compare");

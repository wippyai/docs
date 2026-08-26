import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const check = args.includes("--check");
const rootArg = args.indexOf("--theme-root");

if (rootArg < 0 || !args[rootArg + 1]) {
  throw new Error(
    "Usage: node scripts/generate-frontend-contract.mjs --theme-root <@wippy-fe/theme> [--check]",
  );
}

const docsRoot = path.resolve(import.meta.dirname, "..");
const themeRoot = path.resolve(args[rootArg + 1]);
const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(themeRoot, name), "utf8"));
const tokens = readJson("tokens.json");
const effective = readJson("effective-contract.json");
const tailwind = readJson("tailwind-contract.json");
const effectiveByVariable = new Map();
const consumersByRuntimeVariable = new Map();
for (const record of effective.records) {
  if (record.generatedCssVariable) {
    const records = effectiveByVariable.get(record.generatedCssVariable) ?? [];
    records.push(record);
    effectiveByVariable.set(record.generatedCssVariable, records);
  }
  for (const variable of record.runtimeVariables ?? []) {
    const records = consumersByRuntimeVariable.get(variable) ?? [];
    records.push(record);
    consumersByRuntimeVariable.set(variable, records);
  }
}
const tailwindByUtility = new Map(
  tailwind.utilities.map((utility) => [utility.utility, utility]),
);

const escapeCell = (value) =>
  String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
const code = (value) => (value ? `\`${escapeCell(value)}\`` : "—");

function tokenCoverage(token) {
  if (token.contract?.coverage) return token.contract.coverage;
  if (token.layer === "legacy") return "legacy";
  if ((consumersByRuntimeVariable.get(token.name) ?? []).length)
    return "inherited";
  return "declared-unconsumed";
}

function tokenPurpose(token) {
  if (token.contract?.semanticPurpose) return token.contract.semanticPurpose;
  if (token.family && token.shade != null)
    return `${token.family} palette shade ${token.shade}`;
  if (token.family && token.alias)
    return `${token.family} ${token.alias.replaceAll("-", " ")}`;
  if (token.family) return `${token.family} palette base`;
  if (token.role) return `${token.role} typography ${token.prop}`;
  return token.name.slice(4).replaceAll("-", " ");
}

function tokenStableId(token) {
  return token.contract?.id ?? `token.${token.name.slice(4).replaceAll("-", ".")}`;
}

function tokenPrimeVueConsumers(token) {
  const declared = token.contract?.consumers ?? [];
  const observed = [
    ...(effectiveByVariable.get(token.name) ?? []),
    ...(consumersByRuntimeVariable.get(token.name) ?? []),
  ]
    .map((record) => record.sourceFile)
    .filter(Boolean);
  return [...new Set([...declared, ...observed])];
}

function tokenPortableConsumers(token) {
  const consumers = [];
  for (const contract of tokens.portableSiblingContracts ?? []) {
    for (const property of contract.properties ?? []) {
      const source = property.source;
      if (!source) continue;
      const direct = source.kind === "css-variable" && source.name === token.name;
      const utilityNames =
        source.kind === "tailwind-utility"
          ? [source.name]
          : source.kind === "tailwind-utilities"
            ? source.names
            : [];
      const indirect = utilityNames.some((name) =>
        (tailwindByUtility.get(name)?.runtimeDependencies ?? []).includes(
          token.name,
        ),
      );
      if (direct || indirect) consumers.push(`${contract.id}:${property.id}`);
    }
  }
  return [...new Set(consumers)];
}

function validateGeneratedEvidence() {
  const allowedMutationEvidence = new Set([
    "pending-browser-proof",
    "verified-browser-proof",
    "not-applicable-until-runtime",
  ]);
  const failures = [];
  for (const record of effective.records) {
    if (!allowedMutationEvidence.has(record.mutationEvidence)) {
      failures.push(
        `${record.id}: unknown mutationEvidence ${JSON.stringify(record.mutationEvidence)}`,
      );
    }
  }
  for (const token of tokens.tokens.filter((item) => item.contract)) {
    const contract = token.contract;
    for (const field of [
      "id",
      "name",
      "path",
      "default",
      "layer",
      "coverage",
      "consumers",
    ]) {
      if (contract[field] == null) {
        failures.push(`${token.name}: contract.${field} is required`);
      }
    }
    if (contract.name !== token.name) {
      failures.push(`${token.name}: contract.name does not match token name`);
    }
    if (contract.coverage === "runtime") {
      const evidence = effectiveByVariable.get(token.name) ?? [];
      if (evidence.length === 0) {
        failures.push(`${token.name}: runtime contract has no effective record`);
      }
    }
  }
  if (failures.length) {
    throw new Error(`Generated frontend evidence is invalid:\n${failures.join("\n")}`);
  }
}

validateGeneratedEvidence();

function tokenCatalogue() {
  const compatibility = tokens.compatibility;
  const referenceHashes = Object.entries(
    compatibility.sourceHashes.referencePrimeuixThemesSources || {},
  )
    .map(([name, hash]) => `${name}=${hash}`)
    .join("; ");
  const lines = [
    `Generated from @wippy-fe/theme ${tokens.packageVersion}; schema ${tokens.schemaVersion}; implementation ${tokens.implementationRelease}.`,
    "",
    `Compatibility: Tailwind ${compatibility.tailwindVersion}, tailwindcss-primeui ${compatibility.tailwindcssPrimeuiVersion}, PrimeVue ${compatibility.primevueVersion}, @primeuix/styles ${compatibility.primeuixStylesVersion}, @primeuix/styled ${compatibility.primeuixStyledVersion}, reference @primeuix/themes ${compatibility.referencePrimeuixThemesVersion}.`,
    "",
    `Source hashes: theme contract \`${compatibility.sourceHashes.themeContract}\`; theme config \`${compatibility.sourceHashes.themeConfig}\`; Tailwind config \`${compatibility.sourceHashes.tailwindConfig}\`; reference theme sources \`${referenceHashes}\`.`,
    "",
    "| Stable ID | Token | Layer | Official path | Default | Light | Dark | Declared coverage | Package coverage | Purpose | PrimeVue consumers | Portable-contract consumers | Stability |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const token of tokens.tokens) {
    const contract = token.contract;
    const primeVueConsumers = tokenPrimeVueConsumers(token);
    const portableConsumers = tokenPortableConsumers(token);
    lines.push(
      `| ${code(tokenStableId(token))} | ${code(token.name)} | ${escapeCell(token.layer)} | ${code(contract?.path ?? token.path)} | ${code(contract?.default ?? token.light)} | ${code(token.light)} | ${code(token.dark)} | ${escapeCell(contract?.coverage ?? token.coverage ?? "declared")} | ${tokenCoverage(token)} | ${escapeCell(tokenPurpose(token))} | ${escapeCell(primeVueConsumers.join(", ") || "none recorded")} | ${escapeCell(portableConsumers.join(", ") || "none recorded")} | ${contract ? "public reviewed" : token.layer === "legacy" ? "legacy" : "public generated"} |`,
    );
  }
  lines.push("", "## Portable sibling contracts", "");
  for (const contract of tokens.portableSiblingContracts ?? []) {
    lines.push(
      `### ${contract.component}: ${code(contract.id)}`,
      "",
      `Contract hash: ${code(contract.contractHash)}.`,
      "",
      "| Property | Part | CSS property | Classification | Published source |",
      "|---|---|---|---|---|",
      ...contract.properties.map((property) =>
        `| ${code(property.id)} | ${code(property.part)} | ${code(property.cssProperty)} | ${code(property.classification)} | ${code(property.source ? JSON.stringify(property.source) : "not exported")} |`),
      "",
    );
  }
  lines.push(
    "",
    "## First-slice effective contract",
    "",
    "| ID | Component | Source location | Selector / PrimeVue path | Property or consumer | Current / emitted value | Runtime dependencies | Semantic review | Mutation | Disposition |",
    "|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const record of effective.records) {
    lines.push(
      `| ${code(record.id)} | ${escapeCell(record.component || record.id.split(".")[1])} | ${code(record.sourceFile || record.sourceObjectPath)} | ${code(record.selector || record.primevueDtPath)} | ${code(record.property || record.generatedCssVariable || record.wippyConsumer)} | ${code(record.current || record.currentValue || record.upstreamRawValue)} | ${escapeCell(record.runtimeVariables?.join(", ") || record.generatedCssVariable || "none")} | ${code(record.semanticMatch)} | ${code(record.mutationEvidence)} | ${code(record.disposition)} |`,
    );
  }
  return lines.join("\n");
}

function tailwindCatalogue() {
  const referenceHashes = Object.entries(
    tailwind.compatibility.sourceHashes.referencePrimeuixThemesSources || {},
  )
    .map(([name, hash]) => `${name}=${hash}`)
    .join("; ");
  const runtime = tailwind.utilities.filter(
    (item) => item.classification === "runtime-variable",
  );
  const baseline = tailwind.utilities.filter(
    (item) => item.classification === "compile-time-constant",
  );
  const internal = tailwind.utilities.filter(
    (item) => item.classification === "internal-transient",
  );
  const table = (items) => [
    "| Utility | CSS property | Resolved value | Runtime dependency | Classification | Allowed consumer | Stability | Intended use |",
    "|---|---|---|---|---|---|---|---|",
    ...items.map(
      (item) =>
        `| ${code(item.utility)} | ${escapeCell(item.property)} | ${code(item.value)} | ${escapeCell(item.runtimeDependencies?.join(", ") || "none")} | ${item.classification} | ${escapeCell(item.allowedConsumer)} | ${escapeCell(item.stability)} | ${escapeCell(item.intendedUse)} |`,
    ),
  ].join("\n");
  return [
    `Generated from @wippy-fe/theme ${tailwind.packageVersion}. Every representative mapping below is checked against CSS compiled by Tailwind ${tailwind.compatibility.tailwindVersion} with tailwindcss-primeui ${tailwind.compatibility.tailwindcssPrimeuiVersion}.`,
    "",
    `Source hashes: theme contract \`${tailwind.compatibility.sourceHashes.themeContract}\`; theme config \`${tailwind.compatibility.sourceHashes.themeConfig}\`; Tailwind config \`${tailwind.compatibility.sourceHashes.tailwindConfig}\`; reference theme sources \`${referenceHashes}\`.`,
    "",
    "### Runtime-backed semantic utilities",
    "",
    table(runtime),
    "",
    "### Compile-time baselines",
    "",
    "> Build-time baseline. This value is embedded in the module bundle and does not react to a facade theme change.",
    "",
    table(baseline),
    "",
    "### Internal or transient utilities",
    "",
    table(internal),
    "",
    "### Compiled representative probes",
    "",
    "| Utility | Emitted declarations |",
    "|---|---|",
    ...tailwind.compiledProbes.map(
      (probe) =>
        `| ${code(probe.utility)} | ${code(Object.entries(probe.declarations).map(([key, value]) => `${key}: ${value}`).join("; "))} |`,
    ),
  ].join("\n");
}

function replaceGenerated(file, marker, generated) {
  const fullPath = path.join(docsRoot, file);
  const before = fs.readFileSync(fullPath, "utf8");
  const begin = `<!-- GENERATED:${marker}:BEGIN -->`;
  const end = `<!-- GENERATED:${marker}:END -->`;
  const startIndex = before.indexOf(begin);
  const endIndex = before.indexOf(end);
  if (startIndex < 0 || endIndex < startIndex)
    throw new Error(`${file} is missing ${marker} markers`);
  const after =
    before.slice(0, startIndex + begin.length) +
    `\n${generated}\n` +
    before.slice(endIndex);
  if (check && before !== after)
    throw new Error(`${file} generated section is stale`);
  if (!check) fs.writeFileSync(fullPath, after);
}

replaceGenerated(
  "en/frontend/micro-frontends/token-catalogue.md",
  "TOKEN-CATALOGUE",
  tokenCatalogue(),
);
replaceGenerated(
  "en/frontend/micro-frontends/tailwind-contract.md",
  "TAILWIND-CONTRACT",
  tailwindCatalogue(),
);

process.stdout.write(
  `[frontend-contract] ${check ? "verified" : "generated"} token and Tailwind catalogues\n`,
);

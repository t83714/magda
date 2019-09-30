#!/usr/bin/env node
const pkg = require("../package.json");
const program = require("commander");
const chalk = require("chalk");
const rp = require("request-promise");
const moment = require("moment");

program
    .version(pkg.version)
    .usage("[options]")
    .description(
        `A tool for determing whether a certificate is required to re-generated. Version: ${
            pkg.version
        }`
    )
    .option(
        "-sfu, --status-file-url [http://sdsd/status.json]",
        "The json cert satus file. \n"
    )
    .option(
        "-d, --domain [xxx.dd.com]",
        "The domain of the cert. Optional; If not present, only timestamp will be checked\n"
    )
    .option(
        "-ed, --expiry-days [30]",
        "How many days the cert will expired. Default: 30 days\n",
        "30"
    );

program.parse(process.argv);

const programOptions = program.opts();

run(programOptions).catch(e => {
    console.error(chalk.red(`Failed to determine certificate expiry: ${e}`));
    process.exit(1);
});

async function run(programOptions) {
    validateProgramOptions(programOptions);
    const statusData = await rp(programOptions.statusFileUrl);
    let data;
    try {
        data = JSON.parse(statusData);
    } catch (e) {
        printResult(true);
    }
    if (typeof data !== "object" || !data.timestamp) {
        printResult(true);
    } else {
        const timestamp = moment(data.timestamp);
        if (!timestamp.isValid()) {
            printResult(true);
        } else {
            if (
                timestamp
                    .add(programOptions.expiryDays, "days")
                    .isSameOrBefore(moment()) ||
                (programOptions.domain && programOptions.domain !== data.domain)
            ) {
                printResult(true);
            } else {
                printResult(false);
            }
        }
    }
}

function validateProgramOptions(options) {
    if (
        typeof options.statusFileUrl !== "string" ||
        options.statusFileUrl == ""
    ) {
        throw new Error("Invalid `--status-file-url` parameter.");
    }
    if (!options.domain) options.domain = "";
    try {
        const expiryDays = parseInt(options.expiryDays);
        if (isNaN(expiryDays) || expiryDays <= 0)
            throw new Error("an positive int number is required");
        options.expiryDays = expiryDays;
    } catch (e) {
        throw new Error(`Invalid \`--expiry-days\` parameter: ${e.messsage}`);
    }
}

function printResult(result) {
    if (result) {
        console.log("true");
        process.exit();
    } else {
        console.log("false");
        process.exit();
    }
}

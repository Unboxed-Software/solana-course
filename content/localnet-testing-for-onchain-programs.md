# Local Program Development for Testing On-chain Programs

# Lesson Objectives

_By the end of this lesson, you will be able to:_

- Set up a local copy of onchain program
- Set up local validator with amman
- Invoke copy of onchain programs locally

# TL;DR

- To get started with Solana locally, you’ll first need to install **@metaplex-foundation/amman**
- Using the Amman CLI you can run a **local test validator** using the `amman start` command
- Once you have these you’ll be able to invoke on chain programs locally using your custom program

# Overview

To start lets install @metaplex-foundation/amman

# 1. Install

Use the command `npm i @metaplex-foundation/amman` to install it into your project.

# 2. Setup package.json file

Add these commands to your scripts in the package.json file:

```json
    "amman:start": "DEBUG='amman:(info|error|debug)' amman start",
    "amman:stop": "amman stop"
```

# 3. Setup .ammanrc.js file

Create a file in project root called .ammanrc.js with the following contents:

```js
const { LOCALHOST, tmpLedgerDir } = require("@metaplex-foundation/amman");
const path = require("path");

function localDeployPath(programName) {
  return path.join(__dirname, "programs", `${programName}.so`);
}

const programIds = {
  onchainProgramId: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
};

const programs = [
  {
    programId: programIds.onchainProgramId,
    deployPath: localDeployPath("mpl_token_metadata"),
  },
];

module.exports = {
  validator: {
    killRunningValidators: true,
    programs,
    jsonRpcUrl: LOCALHOST,
    websocketUrl: "",
    commitment: "confirmed",
    ledgerDir: tmpLedgerDir(),
    resetLedger: true,
    verifyFees: false,
  },
};
```

# 4. Download Shared library for onchain program

All programs have a compiled shared library(.so). You can download it from either their github repository or from apr.dev
Create a folder called programs and put the shared library in there.
Ensure that the name of file is matching that in config file of amman.

# 5. Run amman start

Make sure `solana-test-validator` is not running else amman wont work.

```bash
npm run amman:start
```

# 6. Invoke onchain program

Now you can invoke the onchain program locally by calling your contract as you do. The program is already deployed when you start amaan.

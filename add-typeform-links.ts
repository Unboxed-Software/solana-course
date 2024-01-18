// Generates preselected links for each choice in the Typeform
// https://www.typeform.com/help/a/preselect-answers-through-typeform-links-for-advanced-users-4410202791060/

const FORM_ID = `IPH0UGz7`;

import { writeFile, readFile } from "node:fs/promises";

// From Typeform JSON URI at https://form.typeform.com/forms/IPH0UGz7

const choices = [
  {
    id: "CyiMfv6oRioI",
    ref: "a107787e-ad33-42bb-96b3-0592efc1b92f",
    label: "account-data-matching",
  },
  {
    id: "rT5o8I1VBzuQ",
    ref: "21375c76-b6f1-4fb6-8cc1-9ef151bc5b0a",
    label: "anchor-cpi",
  },
  {
    id: "j9fblIcyPkTe",
    ref: "f58108e9-94a0-45b2-b0d5-44ada1909105",
    label: "anchor-pdas",
  },
  {
    id: "Q57Yz89C4XSz",
    ref: "5bcaf062-c356-4b58-80a0-12cca99c29b0",
    label: "arbitrary-cpi",
  },
  {
    id: "EMbcUEDqkeO2",
    ref: "d3f6ca7a-11c8-421f-b7a3-d6c08ef1aa8b",
    label: "bump-seed-canonicalization",
  },
  {
    id: "45vcLJrv6Sdx",
    ref: "e6b99d4b-35ed-4fb2-b9cd-73eefc875a0f",
    label: "closing-accounts",
  },
  {
    id: "Zuj223dUDkah",
    ref: "db156789-2400-4972-904f-40375582384a",
    label: "compressed-nfts",
  },
  {
    id: "dNqQ6zj5y7eS",
    ref: "ade5d386-809f-42c2-80eb-a6c04c471f53",
    label: "cpi",
  },
  {
    id: "qJpepIw2h9k5",
    ref: "9cb89e09-2c97-4185-93b0-c89f7aca7677",
    label: "deserialize-custom-data",
  },
  {
    id: "0rGxrUxXEOdC",
    ref: "74a157dc-01a7-4b08-9a5f-27aa51a4346c",
    label: "deserialize-instruction-data",
  },
  {
    id: "oEKdvq7ZSdUU",
    ref: "9b759e39-7a06-4694-ab6d-e3e7ac266ea7",
    label: "duplicate-mutable-accounts",
  },
  {
    id: "5ch2AFyYAQ9P",
    ref: "02a7dab7-d9c1-495b-928c-a4412006ec20",
    label: "env-variables",
  },
  {
    id: "P2KPau3ogNky",
    ref: "60f6b072-eaeb-469c-b32e-5fea4b72d1d1",
    label: "generalized-state-compression",
  },
  {
    id: "a449u6Gzr8UV",
    ref: "5b56c69c-1490-46e4-850f-a7e37bbd79c2",
    label: "hello-world-program",
  },
  {
    id: "s8AX15tktQyt",
    ref: "69c5aac6-8a9f-4e23-a7f5-28ae2845dfe1",
    label: "interact-with-wallets",
  },
  {
    id: "0SMxtVPdQlTu",
    ref: "774a4023-646d-4394-af6d-19724a6db3db",
    label: "intro-to-anchor-frontend",
  },
  {
    id: "YaAS4U3Lzg9X",
    ref: "334874b7-b152-4473-b5a5-5474c3f8f3f1",
    label: "intro-to-anchor",
  },
  {
    id: "LtQysBhng9AM",
    ref: "ee06a213-5d74-4954-846e-cba883bc6db1",
    label: "intro-to-cryptography",
  },
  {
    id: "xO3qr9VOKcUt",
    ref: "e969d07e-ae85-48c3-976f-261a22f02e52",
    label: "intro-to-custom-on-chain-programs",
  },
  {
    id: "NENJpDK8TLOM",
    ref: "8bbbfd93-1cdc-4ce3-9c83-637e7aa57454",
    label: "intro-to-reading-data",
  },
  {
    id: "Bp3imZUcsoEe",
    ref: "c15928ce-8302-4437-9b1b-9aa1d65af864",
    label: "intro-to-solana-mobile",
  },
  {
    id: "sqnmYHSSCNn8",
    ref: "dda6b8de-9ed8-4ed2-b1a5-29d7a8a8b415",
    label: "intro-to-writing-data",
  },
  {
    id: "PAOUs7a2qnrI",
    ref: "aa0b56d6-02a9-4b36-95c0-a817e2c5b19d",
    label: "local-setup",
  },
  {
    id: "B2blrQDyo4mw",
    ref: "5a3d0f62-c5fc-4e03-b8a3-323c2c7b8f4f",
    label: "mwa-deep-dive",
  },
  {
    id: "c09haIwl57QL",
    ref: "296745ac-503c-4b14-b3a6-b51c5004c165",
    label: "nfts-with-metaplex",
  },
  {
    id: "rpJJ79qxv0Yb",
    ref: "1a5d266c-f4c1-4c45-b986-2afd4be59991",
    label: "oracles",
  },
  {
    id: "Ji75HLdduh8p",
    ref: "e3069010-3038-4984-b9d3-2dc6585147b1",
    label: "owner-checks",
  },
  {
    id: "FEUXGW98hvBy",
    ref: "9342ad0a-1741-41a5-9f68-662642c8ec93",
    label: "paging-ordering-filtering-data",
  },
  {
    id: "LHSSLV36vH97",
    ref: "5744079f-9473-4485-9a14-9be4d31b40d1",
    label: "pda-sharing",
  },
  {
    id: "r3hBHTCagbdT",
    ref: "89d367b4-5102-4237-a7f4-4f96050fe57e",
    label: "pda",
  },
  {
    id: "7ZXYvqeFJz8a",
    ref: "4a628916-91f5-46a9-8eb0-6ba453aa6ca6",
    label: "program-architecture",
  },
  {
    id: "BbNfE4biK8Im",
    ref: "3dfb98cc-7ba9-463d-8065-7bdb1c841d43",
    label: "program-security",
  },
  {
    id: "zesRWO1uG2mJ",
    ref: "8320fc87-2b6d-4b3a-8b1a-54b55afed781",
    label: "program-state-management",
  },
  {
    id: "A2QeBKJY9yhQ",
    ref: "652c68aa-18d9-464c-9522-e531fd8738d5",
    label: "reinitialization-attacks",
  },
  {
    id: "31Kmrh7xfIWs",
    ref: "eb892157-3014-4635-beac-f562af600bf8",
    label: "rust-macros",
  },
  {
    id: "UzW0ICAZ6hZk",
    ref: "6cb40094-3def-4b66-8a72-dd5f00298f61",
    label: "serialize-instruction-data",
  },
  {
    id: "b3bbvX75lz0F",
    ref: "26b3f41e-8241-416b-9cfa-05c5ab519d80",
    label: "signer-auth",
  },
  {
    id: "e8TMzz5b5oVO",
    ref: "19cf8d3a-89a0-465e-95da-908cf8f45409",
    label: "solana-mobile-dApps-with-expo",
  },
  {
    id: "zOctO0GysHQb",
    ref: "3c7e5796-c433-4575-93e1-1429f718aa10",
    label: "solana-pay",
  },
  {
    id: "h1R5XEFNfJS9",
    ref: "72cab3b8-984b-4b09-a341-86800167cfc7",
    label: "token-program",
  },
  {
    id: "hI49fvoFnO4C",
    ref: "ac5e6fba-029c-4484-8aaf-12d37cbff939",
    label: "token-swap",
  },
  {
    id: "PtLeASzZ9ngf",
    ref: "37ebccab-b19a-43c6-a96a-29fa7e80fdec",
    label: "type-cosplay",
  },
  {
    id: "2bUXhc4yYkFk",
    ref: "b58fdd00-2b23-4e0d-be55-e62677d351ef",
    label: "versioned-transaction",
  },
  {
    id: "WncpuWyr8Oce",
    ref: "5af49eda-f3e7-407d-8cd7-78d0653ee17c",
    label: "vrf",
  },
];

const log = console.log;

// choices.forEach((choice) => {
//   log(`content/${choice.label}.md`);
//   log(`https://form.typeform.com/to/${FORM_ID}#answers-lesson=${choice.ref}`);
// });

export async function asyncForEach<T>(
  array: Array<T>,
  callback: (item: T, index: number) => Promise<void>,
) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index);
  }
}

await asyncForEach(choices, async (choice) => {
  const filename = `content/${choice.label}.md`;
  const oldContent = await readFile(filename, "utf8");

  const CUSTOM_TYPEFORM_LINK = `https://form.typeform.com/to/${FORM_ID}#answers-lesson=${choice.ref}`;

  const PROMPT = `## Completed the lab?\n\nPush your code to GitHub and [tell us what you thought of this lesson](${CUSTOM_TYPEFORM_LINK})!`;

  // Append to the end of the file
  await writeFile(filename, `${oldContent}\n\n${PROMPT}`);
});

log(`Completed successfully!`);

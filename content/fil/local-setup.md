---
title: Local Program Development
objectives:
- Mag-set up ng lokal na kapaligiran para sa pagbuo ng programa ng Solana
- Gumamit ng mga pangunahing command ng Solana CLI
- Magpatakbo ng lokal na test validator
- Gamitin ang Rust at ang Solana CLI upang mag-deploy ng isang programang Solana mula sa iyong lokal na kapaligiran sa pag-unlad
- Gamitin ang Solana CLI upang tingnan ang mga log ng programa
---

# TL;DR

- Upang makapagsimula sa Solana nang lokal, kakailanganin mo munang i-install ang **Rust** at ang **Solana CLI**
- Gamit ang Solana CLI maaari kang magpatakbo ng **local test validator** gamit ang utos na `solana-test-validator`
- Kapag na-install mo na ang Rust at Solana CLI, magagawa mong buuin at i-deploy ang iyong mga programa nang lokal gamit ang mga command na `cargo build-bpf` at `solana program deploy`
- Maaari mong tingnan ang mga log ng programa gamit ang command na `solana logs`

# Lesson

Sa ngayon sa kursong ito, ginamit namin ang Solana Playground upang bumuo at mag-deploy ng mga programang Solana. At habang ito ay isang mahusay na tool, para sa ilang mga kumplikadong proyekto ay maaaring mas gusto mong magkaroon ng isang lokal na kapaligiran sa pag-unlad na naka-set up. Maaaring ito ay upang magamit ang mga crates na hindi sinusuportahan ng Solana Playground, upang samantalahin ang mga custom na script o tooling na iyong ginawa, o dahil lang sa personal na kagustuhan.

Sa sinabi nito, ang araling ito ay bahagyang naiiba sa iba. Sa halip na saklawin ang maraming lugar kung paano magsulat ng isang programa o makipag-ugnayan sa network ng Solana, ang araling ito ay pangunahing tututuon sa hindi gaanong kaakit-akit na gawain ng pag-set up ng iyong lokal na kapaligiran sa pag-unlad.

Upang bumuo, subukan, at mag-deploy ng mga programang Solana mula sa iyong makina, kakailanganin mong i-install ang Rust compiler at ang Solana Command Line Interface (CLI). Magsisimula kami sa pamamagitan ng paggabay sa iyo sa mga proseso ng pag-install na ito, pagkatapos ay saklawin kung paano gamitin ang kaka-install mo pa lang.

Ang mga tagubilin sa pag-install sa ibaba ay naglalaman ng mga hakbang para sa pag-install ng Rust at ang Solana CLI sa oras ng pagsulat. Maaaring nagbago ang mga ito sa oras na binabasa mo ito, kaya kung magkakaroon ka ng mga isyu mangyaring kumonsulta sa opisyal na pahina ng pag-install para sa bawat isa:

- [I-install ang Rust](https://www.rust-lang.org/tools/install)
- [I-install ang Solana Tool Suite](https://docs.solana.com/cli/install-solana-cli-tools)

## Setup on Windows (with Linux)

### Download Windows Subsystem for Linux (WSL)

Kung ikaw ay nasa isang Windows computer, inirerekumenda na gamitin ang Windows Subsystem para sa Linux (WSL) upang buuin ang iyong Solana Programs.

Magbukas ng **administrator** PowerShell o Windows Command Prompt at tingnan ang bersyon ng Windows

```bash
winver
```

Kung ikaw ay nasa Windows 10 na bersyon 2004 at mas mataas (Build 19041 at mas mataas) o Windows 11, patakbuhin ang sumusunod na command.

```bash
wsl --install
```

Kung nagpapatakbo ka ng mas lumang bersyon ng Windows, sundin ang [mga tagubilin para sa mas lumang bersyon ng Windows](https://docs.microsoft.com/en-us/windows/wsl/install-manual).

Maaari kang [magbasa nang higit pa tungkol sa pag-install ng WSL mula sa Microsoft](https://docs.microsoft.com/en-us/windows/wsl/install).

### Download Ubuntu

Susunod, [i-download ang Ubuntu](https://apps.microsoft.com/store/detail/ubuntu-2004/9N6SVWS3RX71?hl=en-us&gl=US). Nagbibigay ang Ubuntu ng terminal na nagbibigay-daan sa iyong patakbuhin ang Linux sa isang Windows computer. Dito ka magpapatakbo ng mga command ng Solana CLI.

### Download Rust (for WSL)

Susunod, buksan ang terminal ng Ubuntu at i-download ang Rust para sa WSL gamit ang sumusunod na command. Maaari kang magbasa nang higit pa tungkol sa [pag-download ng Rust mula sa mga doc](https://www.rust-lang.org/learn/get-started).

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Download Solana CLI

Ngayon ay handa na kaming mag-download ng Solana CLI para sa Linux. Sige at patakbuhin ang sumusunod na command sa isang Ubuntu terminal. Maaari kang magbasa nang higit pa tungkol sa [pag-download ng Solana CLI mula sa mga doc](https://docs.solana.com/cli/install-solana-cli-tools).

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.10.31/install)"
```

## Setup on macOS

### Download Rust

Una, i-download ang Rust sa pamamagitan ng [pagsunod sa mga tagubilin](https://www.rust-lang.org/tools/install)

### Download the Solana CLI

Susunod, i-download ang Solana CLI sa pamamagitan ng pagpapatakbo ng sumusunod na command sa iyong terminal.

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.10.31/install)"
```

Maaari kang magbasa nang higit pa tungkol sa [pag-download ng Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools).

## Solana CLI basics

Ang Solana CLI ay isang command-line interface tool na nagbibigay ng koleksyon ng mga command para sa pakikipag-ugnayan sa isang Solana cluster.

Sasaklawin namin ang ilan sa mga pinakakaraniwang command sa araling ito, ngunit maaari mong palaging tingnan ang listahan ng lahat ng posibleng Solana CLI command sa pamamagitan ng pagpapatakbo ng `solana --help`.

### Solana CLI configuration

Ang Solana CLI ay nag-iimbak ng ilang setting ng configuration na nakakaapekto sa gawi ng ilang partikular na command. Maaari mong gamitin ang sumusunod na command upang tingnan ang kasalukuyang configuration:

```bash
solana config get
```

Ang utos na `solana config get` ay magbabalik ng sumusunod:

- `Config File` - ang file na Solana CLI ay matatagpuan sa iyong computer
- `RPC URL` - endpoint na iyong ginagamit, ikinokonekta ka sa localhost, Devnet, o Mainnet
- `WebSocket URL` - ang websocket upang makinig sa mga kaganapan mula sa cluster na iyong tina-target (nakalkula kapag itinakda mo ang `RPC URL`)
- `Path ng Keypair` - ang path ng keypair na ginagamit kapag nagpapatakbo ng mga subcommand ng Solana CLI
- `Commitment` - nagbibigay ng sukatan ng kumpirmasyon ng network at naglalarawan kung paano na-finalize ang isang block sa oras na iyon

Maaari mong baguhin ang iyong configuration ng Solana CLI anumang oras sa pamamagitan ng paggamit ng command na `solana config set` na sinusundan ng setting na gusto mong i-update.

Ang pinakakaraniwang pagbabago ay ang cluster na iyong tina-target. Gamitin ang command na `solana config set --url` para baguhin ang `RPC URL`.

```bash
solana config set --url localhost
```

```bash
solana config set --url devnet
```

```bash
solana config set --url mainnet-beta
```

Katulad nito, maaari mong gamitin ang command na `solana config set --keypair` upang baguhin ang `Path ng Keypair`. Gagamitin ng Solana CLI ang keypair mula sa tinukoy na landas kapag nagpapatakbo ng mga command.

```bash
solana config set --keypair ~/<FILE_PATH>
```

### Test validators

Madalas mong makitang kapaki-pakinabang na magpatakbo ng lokal na validator para sa pagsubok at pag-debug kaysa sa pag-deploy sa Devnet.

Maaari kang magpatakbo ng lokal na test validator gamit ang command na `solana-test-validator`. Lumilikha ang command na ito ng isang patuloy na proseso na mangangailangan ng sarili nitong command line window.

### Stream program logs

Madalas na nakakatulong na magbukas ng bagong console at patakbuhin ang command na `solana logs` kasama ng test validator. Lumilikha ito ng isa pang patuloy na proseso na mag-stream ng mga log na nauugnay sa cluster ng iyong configuration.

Kung ang iyong CLI configuration ay nakaturo sa `localhost`, ang mga log ay palaging iuugnay sa test validator na iyong ginawa, ngunit maaari ka ring mag-stream ng mga log mula sa iba pang mga cluster tulad ng Devnet at Mainnet Beta. Kapag nag-stream ng mga log mula sa iba pang mga cluster, gugustuhin mong magsama ng program ID na may command na limitahan ang mga log na nakikita mo sa iyong partikular na program.

### Keypairs

Maaari kang bumuo ng bagong keypair gamit ang command na `solana-keygen new --outfile` na sinusundan ng path ng file upang iimbak ang keypair.

```bash
solana-keygen new --outfile ~/<FILE_PATH>
```

Minsan maaaring kailanganin mong suriin kung aling keypair ang itinuturo ng iyong configuration. Upang tingnan ang `publickey` ng kasalukuyang keypair na nakatakda sa `solana config`, gamitin ang command na `solana address`.

```bash
solana address
```

Upang tingnan ang balanse ng SOL ng kasalukuyang keypair na nakatakda sa `solana config`, gamitin ang command na `solana balance`.

```bash
solana balance
```

Upang i-airdrop ang SOL sa Devnet o localhost, gamitin ang command na `solana airdrop`. Tandaan na habang nasa Devnet, limitado ka sa 2 SOL bawat airdrop.

```bash
solana airdrop 2
```

Habang gumagawa ka at sumusubok ng mga programa sa iyong lokal na kapaligiran, malamang na makatagpo ka ng mga error na sanhi ng:

- Paggamit ng maling keypair
- Walang sapat na SOL para i-deploy ang iyong program o magsagawa ng transaksyon
- Tumuturo sa maling kumpol

Ang mga utos ng CLI na saklaw namin sa ngayon ay dapat makatulong sa iyo na mabilis na malutas ang mga isyung iyon.

## Develop Solana programs in your local environment

Bagama't napakalaking tulong ng Solana Playground, mahirap talunin ang flexibility ng sarili mong lokal na kapaligiran sa pag-unlad. Habang bumubuo ka ng mas kumplikadong mga programa, maaari mong isama ang mga ito sa isa o higit pang mga kliyente na nasa ilalim din ng pag-unlad sa iyong lokal na kapaligiran. Ang pagsubok sa pagitan ng mga program na ito at mga kliyente ay kadalasang mas simple kapag nagsusulat, bumuo, at nag-deploy ng iyong mga programa nang lokal.

### Create a new project

Para gumawa ng bagong Rust package para magsulat ng Solana program, maaari mong gamitin ang command na `cargo new --lib` na may pangalan ng bagong direktoryo na gusto mong gawin.

```bash
cargo new --lib <PROJECT_DIRECTORY_NAME>
```

Ang utos na ito ay lilikha ng bagong direktoryo na may pangalang tinukoy mo sa dulo ng utos. Ang bagong direktoryo na ito ay maglalaman ng `Cargo.toml` na manifest file na naglalarawan sa package.

Ang manifest file ay naglalaman ng metadata gaya ng pangalan, bersyon, at dependencies (crates). Para magsulat ng Solana program, kakailanganin mong i-update ang `Cargo.toml` file para maisama ang `solana-program` bilang dependency. Maaaring kailanganin mo ring idagdag ang mga linyang `[lib]` at `crate-type` na ipinapakita sa ibaba.

```rust
[package]
name = "<PROJECT_DIRECTORY_NAME>"
version = "0.1.0"
edition = "2021"

[features]
no-entrypoint = []

[dependencies]
solana-program = "~1.8.14"

[lib]
crate-type = ["cdylib", "lib"]
```

Sa puntong iyon, maaari mong simulan ang pagsusulat ng iyong programa sa folder na `src`.

### Build and deploy

Pagdating ng oras para buuin ang iyong Solana program, maaari mong gamitin ang command na `cargo build-bpf`.

```bash
cargo build-bpf
```

Ang output ng utos na ito ay magsasama ng mga tagubilin para sa pag-deploy ng iyong program na ganito ang hitsura:

```text
To deploy this program:
  $ solana program deploy /Users/James/Dev/Work/solana-hello-world-local/target/deploy/solana_hello_world_local.so
The program address will default to this keypair (override with --program-id):
  /Users/James/Dev/Work/solana-hello-world-local/target/deploy/solana_hello_world_local-keypair.json
```

Kapag handa ka nang i-deploy ang program, gamitin ang `solana program deploy` na command output mula sa `cargo build-bpf`. Ide-deploy nito ang iyong program sa cluster na tinukoy sa iyong configuration ng CLI.

```rust
solana program deploy <PATH>
```

# Demo

Magsanay tayo sa pamamagitan ng pagbuo at pag-deploy ng "Hello World!" program na ginawa namin sa [aralin sa Hello World](https://github.com/Unboxed-Software/solana-course/pull/content/hello-world-program.md).

Gagawin namin lahat ito nang lokal, kabilang ang pag-deploy sa isang lokal na validator ng pagsubok. Bago tayo magsimula, tiyaking na-install mo ang Rust at ang Solana CLI. Maaari kang sumangguni sa mga tagubilin sa pangkalahatang-ideya upang makapag-set up kung hindi mo pa nagagawa.

### 1. Create a new Rust project

Magsimula tayo sa paggawa ng bagong proyekto ng Rust. Patakbuhin ang command na `cargo new --lib` sa ibaba. Huwag mag-atubiling palitan ang pangalan ng direktoryo ng iyong sarili.

```bash
cargo new --lib solana-hello-world-local
```

Tandaang i-update ang `cargo.toml` file upang isama ang `solana-program` bilang dependency at ang `crate-type` kung wala pa.

```bash
[package]
name = "solana-hello-world-local"
version = "0.1.0"
edition = "2021"

[dependencies]
solana-program = "~1.8.14"

[lib]
crate-type = ["cdylib", "lib"]
```

### 2. Write your program

Susunod, i-update ang `lib.rs` gamit ang “Hello World!” programa sa ibaba. Ang program na ito ay nagpi-print lamang ng "Hello, world!" sa log ng program kapag na-invoke ang program.

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult{
    msg!("Hello, world!");

    Ok(())
}
```

### 3. Run a local test validator

Sa pagsulat ng iyong programa, siguraduhin nating ang aming Solana CLI configuration ay tumuturo sa localhost sa pamamagitan ng paggamit ng `solana config set --url` na utos.

```bash
solana config set --url localhost
```

Susunod, tingnan kung na-update ang configuration ng Solana CLI gamit ang command na `solana config get`.

```bash
solana config get
```

Panghuli, magpatakbo ng lokal na test validator. Sa isang hiwalay na terminal window, patakbuhin ang command na `solana-test-validator`. Ito ay kinakailangan lamang kapag ang aming `RPC URL` ay nakatakda sa localhost.

```bash
solana-test-validator
```

### 4. Build and deploy

Handa na kaming buuin at i-deploy ang aming programa. Buuin ang programa sa pamamagitan ng pagpapatakbo ng utos na `cargo build-bpf`.

```bash
cargo build-bpf
```

Ngayon, i-deploy natin ang ating programa. Patakbuhin ang command output ng `solana program deploy` mula sa `cargo build-bpf`.
```bash
solana program deploy <PATH>
```

Ang `solana program deploy` ay maglalabas ng `Program ID` para sa iyong program. Maaari ka na ngayong maghanap ng naka-deploy na programa sa [Solana Explorer](https://explorer.solana.com/?cluster=custom) (para sa localhost, piliin ang “Custom RPC URL” bilang cluster).

### 5. View program logs

Bago namin i-invoke ang aming program, magbukas ng hiwalay na terminal at patakbuhin ang command na `solana logs`. Ito ay magbibigay-daan sa paggamit upang tingnan ang mga log ng programa sa terminal.

```bash
solana logs <PROGRAM_ID>
```

Habang tumatakbo pa rin ang test validator, subukang i-invoke ang iyong program gamit ang [client-side script na ito](https://github.com/Unboxed-Software/solana-hello-world-client).

Palitan ang program ID sa `index.ts` ng isa mula sa program na kaka-deploy mo lang, pagkatapos ay patakbuhin ang `npm install` na sinusundan ng `npm start`. Magbabalik ito ng Solana Explorer URL. Kopyahin ang URL sa browser upang hanapin ang transaksyon sa Solana Explorer at tingnan na “Hello, world!” ay na-print sa log ng programa. Bilang kahalili, maaari mong tingnan ang mga log ng programa sa terminal kung saan mo pinatakbo ang command na `solana logs`.

At ayun na nga! Kakagawa mo lang at na-deploy ang iyong unang programa mula sa isang lokal na kapaligiran sa pag-unlad.

# Challenge

Ngayon ay iyong pagkakataon na bumuo ng isang bagay nang nakapag-iisa. Subukang lumikha ng isang bagong programa upang i-print ang iyong sariling mensahe sa mga log ng programa. Sa pagkakataong ito, i-deploy ang iyong program sa Devnet sa halip na localhost.

Tandaang i-update ang iyong `RPC URL` sa Devnet gamit ang command na `solana config set --url`.

Maaari mong i-invoke ang program gamit ang parehong client-side script mula sa demo hangga't ina-update mo ang `koneksyon` at Solana Explorer URL sa parehong tumuturo sa Devnet sa halip na localhost.

```tsx
let connection = new web3.Connection(web3.clusterApiUrl("devnet"));
```

```tsx
console.log(
    `Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
);
```

Maaari ka ring magbukas ng hiwalay na command line window at gamitin ang `solana logs | grep "<PROGRAM_ID> invoke" -Isang <NUMBER_OF_LINES_TO_RETURN>`. Kapag gumagamit ng `solana logs` sa Devnet dapat mong tukuyin ang program ID. Kung hindi, ang command na `solana logs` ay magbabalik ng tuluy-tuloy na stream ng mga log mula sa Devnet. Halimbawa, gagawin mo ang sumusunod upang subaybayan ang mga invocation sa Token Program at ipakita ang unang 5 linya ng mga log para sa bawat invocation:

```bash
solana logs | grep "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke" -A 5
```

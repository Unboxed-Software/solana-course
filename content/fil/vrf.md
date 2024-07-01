---
title: Verifiable Randomness Functions
objectives:
- Ipaliwanag ang mga limitasyon ng pagbuo ng mga random na numero na onchain
- Ipaliwanag kung paano gumagana ang Verifiable Randomness
- Gamitin ang VRF oracle queue ng Switchboard upang bumuo at gumamit ng randomness mula sa isang onchain na programa
---

# TL;DR

- Ang mga pagtatangka sa pagbuo ng randomness sa iyong program ay malamang na mahulaan ng mga user dahil walang tunay na randomness onchain.
- Binibigyan ng Verifiable Random Functions (VRFs) ang mga developer ng pagkakataong isama ang mga secure na nabuong random na numero sa kanilang mga onchain na programa.
- Ang VRF ay isang public-key pseudorandom function na nagbibigay ng mga patunay na ang mga output nito ay nakalkula nang tama.
- Nag-aalok ang Switchboard ng developer-friendly na VRF para sa Solana ecosystem.

# Lesson

## Randomness On-Chain

Ang mga random na numero ay ***hindi*** natively pinapayagan onchain. Ito ay dahil deterministiko ang Solana, pinapatakbo ng bawat validator ang iyong code at kailangang magkaroon ng parehong resulta. Kaya kung gusto mong gumawa ng raffle program, kailangan mong tumingin sa labas ng blockchain para sa iyong randomness. Dito pumapasok ang Verifiable Random Functions (VRFs). Nag-aalok ang mga VRF sa mga developer ng secure na paraan ng pagsasama ng randomness onchain sa desentralisadong paraan.

## Types of Randomness

Bago tayo sumisid sa kung paano mabubuo ang mga random na numero para sa isang blockchain, kailangan muna nating maunawaan kung paano nabuo ang mga ito sa tradisyonal na mga computer system. Mayroon talagang dalawang uri ng random na numero: *true random* at *pseudorandom*. Ang pagkakaiba sa pagitan ng dalawa ay nakasalalay sa kung paano nabuo ang mga numero.

Ang mga computer ay maaaring makakuha ng *true random* na mga numero sa pamamagitan ng pagkuha ng ilang uri ng pisikal na pagsukat sa labas ng mundo bilang entropy. Sinasamantala ng mga sukat na ito ang mga natural na phenomena, tulad ng electronic noise, radioactive decay, o atmospheric noise, upang makabuo ng random na data. Dahil ang mga prosesong ito ay likas na hindi mahuhulaan, ang mga bilang na ginagawa nito ay tunay na random at hindi maaaring kopyahin.

Ang *pseudorandom* na mga numero, sa kabilang banda, ay nabuo ng mga algorithm na gumagamit ng isang deterministikong proseso upang makagawa ng mga pagkakasunud-sunod ng mga numero na mukhang random. Ang mga pseudorandom number generators (PRNGs) ay nagsisimula sa isang inisyal na halaga na tinatawag na seed at pagkatapos ay gumamit ng mga mathematical formula upang bumuo ng mga kasunod na numero sa sequence. Dahil sa parehong binhi, ang isang PRNG ay palaging gagawa ng parehong pagkakasunud-sunod ng mga numero. Mahalagang magtanim ng isang bagay na malapit sa totoong entropy: isang "random" na input na ibinigay ng admin, ang huling log ng system, ilang kumbinasyon ng oras ng orasan ng iyong system at iba pang mga salik, atbp.. Nakakatuwang katotohanan: nasira ang mga lumang video game dahil sa mga speedrunner nalaman kung paano kinakalkula ang kanilang randomness. Isang laro ang partikular na gumamit ng bilang ng mga hakbang na iyong ginawa sa laro bilang isang binhi.

Sa kasamaang palad, walang uri ng randomness ang native na available sa mga programang Solana, dahil ang mga program na ito ay kailangang maging deterministiko. Ang lahat ng mga validator ay kailangang magkaroon ng parehong konklusyon. Walang paraan na lahat sila ay gumuhit ng parehong random na numero, at kung gumamit sila ng isang binhi, ito ay madaling kapitan ng pag-atake. Tingnan ang [Mga FAQ ng Solana](https://docs.solana.com/developing/onchain-programs/developing-rust#depending-on-rand) para sa higit pa. Kaya kailangan nating tumingin sa labas ng blockchain para sa randomness sa mga VRF.

## What is Verifiable Randomness?

Ang Verifiable Random Function (VRF) ay isang public-key pseudorandom function na nagbibigay ng mga patunay na ang mga output nito ay nakalkula nang tama. Nangangahulugan ito na maaari kaming gumamit ng isang cryptographic na keypair upang bumuo ng isang random na numero na may isang patunay, na pagkatapos ay ma-validate ng sinuman upang matiyak na ang halaga ay nakalkula nang tama nang walang posibilidad na ma-leak ang sikretong key ng producer. Kapag napatunayan na, ang random na halaga ay iniimbak onchain sa isang account.

Ang mga VRF ay isang mahalagang bahagi para sa pagkamit ng nabe-verify at hindi nahuhulaang randomness sa isang blockchain, na tinutugunan ang ilan sa mga pagkukulang ng mga tradisyonal na PRNG at ang mga hamon sa pagkamit ng tunay na randomness sa isang desentralisadong sistema.

Mayroong tatlong pangunahing katangian ng isang VRF:

1. **Deterministic** - Ang isang VRF ay kumukuha ng isang lihim na susi at isang nonce bilang mga input at deterministikong gumagawa ng isang output ( seeding ). Ang resulta ay isang tila random na halaga. Dahil sa parehong lihim na susi at wala, ang VRF ay palaging gagawa ng parehong output. Tinitiyak ng property na ito na ang random na halaga ay maaaring kopyahin at ma-verify ng sinuman.
2. **Unpredicability** - Ang output ng isang VRF ay lumilitaw na hindi makilala mula sa tunay na randomness sa sinumang walang access sa secret key. Tinitiyak ng property na ito na kahit na deterministic ang VRF, hindi mo mahuhulaan ang resulta nang maaga nang walang kaalaman sa mga input.
3. **Verifiability** - Maaaring i-verify ng kahit sino ang validity ng random na value na nabuo ng isang VRF gamit ang kaukulang secret key at nonce.

Ang mga VRF ay hindi partikular sa Solana at ginamit sa iba pang mga blockchain upang makabuo ng mga pseudorandom na numero. Sa kabutihang palad, nag-aalok ang switchboard ng kanilang pagpapatupad ng VRF sa Solana.

## Switchboard VRF Implementation

Ang Switchboard ay isang desentralisadong Oracle network na nag-aalok ng mga VRF sa Solana. Ang Oracles ay mga serbisyong nagbibigay ng panlabas na data sa isang blockchain, na nagpapahintulot sa kanila na makipag-ugnayan at tumugon sa mga kaganapan sa totoong mundo. Ang Switchboard network ay binubuo ng maraming iba't ibang indibidwal na orakulo na pinapatakbo ng mga ikatlong partido upang magbigay ng panlabas na data at mga kahilingan sa serbisyo na onchain. Upang matuto nang higit pa tungkol sa Oracle network ng Switchboard, mangyaring sumangguni sa aming [Aral sa Oracle](../oracles.md).

Ang VRF ng Switchboard ay nagpapahintulot sa mga user na humiling ng isang orakulo upang makabuo ng isang randomness na output na onchain. Kapag naitalaga sa isang orakulo ang kahilingan, ang patunay ng resulta ng VRF ay dapat na ma-verify onchain bago ito magamit. Ang patunay ng VRF ay tumatagal ng 276 na tagubilin (~48 na transaksyon) upang ganap na ma-verify ang onchain. Kapag na-verify na ang patunay, magsasagawa ang Switchboard program ng onchain callback na tinukoy ng VRF Account sa paggawa ng account. Mula doon ang programa ay maaaring ubusin ang random na data.

Maaaring nagtataka ka kung paano sila binabayaran. Sa pagpapatupad ng VRF ng switchboard, talagang nagbabayad ka bawat kahilingan. // KAILANGAN ng higit pang data

## Requesting and Consuming VRF

Ngayong alam na natin kung ano ang VRF at kung paano ito nababagay sa Switchboard Oracle network, tingnan natin kung paano aktwal na humiling at gumamit ng randomness mula sa isang Solana program. Sa isang mataas na antas, ang proseso para sa paghiling at paggamit ng randomness mula sa Switchboard ay ganito ang hitsura:

1. Gumawa ng `programAuthority` PDA na gagamitin bilang awtoridad ng programa at lagdaan sa ngalan ng programa.
2. Gumawa ng Switchboard VRF Account na may `programAuthority` bilang `authority` at tukuyin ang `callback` function kung saan ibabalik ng VRF ang data.
3. I-invoke ang `request_randomness` na pagtuturo sa Switchboard program. Ang programa ay magtatalaga ng isang orakulo sa aming kahilingan sa VRF.
4. Ang Oracle ay naghahatid ng kahilingan at tumutugon sa Switchboard program na may patunay na kinakalkula gamit ang sikretong key nito.
5. Isinasagawa ng Oracle ang 276 na mga tagubilin upang i-verify ang patunay ng VRF.
6. Kapag na-verify na ang VRF proof, ang Switchboard program ay magpapagana ng `callback` na ipinasa bilang callback sa unang kahilingan na may pseudorandom number na ibinalik mula sa Oracle.
7. Ang programa ay gumagamit ng random na numero at maaaring magsagawa ng lohika ng negosyo dito!


Maraming hakbang dito, ngunit huwag mag-alala, dadaan namin ang bawat hakbang ng proseso nang detalyado.

Una, may ilang account na kailangan nating gawin para makahiling ng randomness, partikular ang `authority` at `vrf` account. Ang `authority` account ay isang PDA na nagmula sa aming programa na humihiling ng randomness. Kaya ang gagawin nating PDA ay magkakaroon ng sarili nating mga binhi para sa ating sariling mga pangangailangan. Sa ngayon, itatakda lang namin ang mga ito sa `VRAUTH`.

```tsx
// derive PDA
[vrfAuthorityKey, vrfAuthoritySecret] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("VRFAUTH")],
    program.programId
  )
```

Pagkatapos, kailangan nating mag-initialize ng `vrf` na account na pagmamay-ari ng Switchboard program at markahan ang PDA na nakuha natin bilang awtoridad nito. Ang `vrf` account ay may sumusunod na istraktura ng data.

```rust
pub struct VrfAccountData {
    /// The current status of the VRF account.
    pub status: VrfStatus,
    /// Incremental counter for tracking VRF rounds.
    pub counter: u128,
    /// Onchain account delegated for making account changes. <-- This is our PDA
    pub authority: Pubkey,
    /// The OracleQueueAccountData that is assigned to fulfill VRF update request.
    pub oracle_queue: Pubkey,
    /// The token account used to hold funds for VRF update request.
    pub escrow: Pubkey,
    /// The callback that is invoked when an update request is successfully verified.
    pub callback: CallbackZC,
    /// The number of oracles assigned to a VRF update request.
    pub batch_size: u32,
    /// Struct containing the intermediate state between VRF crank actions.
    pub builders: [VrfBuilder; 8],
    /// The number of builders.
    pub builders_len: u32,
    pub test_mode: bool,
    /// Oracle results from the current round of update request that has not been accepted as valid yet
    pub current_round: VrfRound,
    /// Reserved for future info.
    pub _ebuf: [u8; 1024],
}
```

Ang ilang mahahalagang field sa account na ito ay `authority`, `oracle_queue`, at `callback`. Ang `awtoridad` ay dapat na isang PDA ng program na may kakayahang humiling ng randomness sa `vrf` account na ito. Sa ganoong paraan, ang program na iyon lang ang makakapagbigay ng lagda na kailangan para sa kahilingan sa vrf. Binibigyang-daan ka ng field na `oracle_queue` na tukuyin kung aling partikular na pila ng oracle ang gusto mong pagsilbihan ang mga kahilingan sa vrf na ginawa gamit ang account na ito. Kung hindi ka pamilyar sa mga oracle queues sa Switchboard, tingnan ang [aralin sa Oracles sa modyul na ito](./oracles.md)! Panghuli, ang field ng `callback` ay kung saan mo tutukuyin ang pagtuturo ng callback na dapat gamitin ng Switchboard program kapag na-verify na ang resulta ng randomness.

Ang field ng `callback` ay may uri na `[CallbackZC](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/rust/switchboard-solana/2program/srcac/oracle. )`.

```rust
#[zero_copy(unsafe)]
#[repr(packed)]
pub struct CallbackZC {
    /// The program ID of the callback program being invoked.
    pub program_id: Pubkey,
    /// The accounts being used in the callback instruction.
    pub accounts: [AccountMetaZC; 32],
    /// The number of accounts used in the callback
    pub accounts_len: u32,
    /// The serialized instruction data.
    pub ix_data: [u8; 1024],
    /// The number of serialized bytes in the instruction data.
    pub ix_data_len: u32,
}
```

Ito ay kung paano mo tukuyin ang Callback struct client side.

```tsx
// example
import Callback from '@switchboard-xyz/solana.js'
...
...

const vrfCallback: Callback = {
      programId: program.programId,
      accounts: [
        // ensure all accounts in consumeRandomness are populated
        { pubkey: clientState, isSigner: false, isWritable: true },
        { pubkey: vrfClientKey, isSigner: false, isWritable: true },
        { pubkey: vrfSecret.publicKey, isSigner: false, isWritable: true },
      ],
			// use name of instruction
      ixData: vrfIxCoder.encode("consumeRandomness", ""), // pass any params for instruction here
    }
```

Ngayon, maaari mong gawin ang `vrf` account.

```tsx
// Create Switchboard VRF
  [vrfAccount] = await switchboard.queue.createVrf({
    callback: vrfCallback,
    authority: vrfAuthorityKey, // vrf authority
    vrfKeypair: vrfSecret,
    enable: !queue.unpermissionedVrfEnabled, // only set permissions if required
  })
```

Ngayong mayroon na kaming lahat ng aming kinakailangang account, matatawag na namin ang `request_randomness` na pagtuturo sa Switchboard program. Mahalagang tandaan na maaari mong gamitin ang `request_randomness` sa isang kliyente o sa loob ng isang programa na may cross program invocation (CPI). Tingnan natin kung anong mga account ang kinakailangan para sa kahilingang ito sa pamamagitan ng pagtingin sa kahulugan ng struct ng Account sa aktwal na [Switchboard program](https://github.com/switchboard-xyz/solana-sdk/blob/fbef37e4a78cbd8b8b6346fcb96af1e20204/switchboard61/rust -solana/src/oracle_program/instructions/vrf_request_randomness.rs#L8).

```rust
// from the Switchboard program
// https://github.com/switchboard-xyz/solana-sdk/blob/fbef37e4a78cbd8b8b6346fcb96af1e20204b861/rust/switchboard-solana/src/oracle_program/instructions/vrf_request_randomness.rs#L8

pub struct VrfRequestRandomness<'info> {
    #[account(signer)]
    pub authority: AccountInfo<'info>,
    #[account(mut)]
    pub vrf: AccountInfo<'info>,
    #[account(mut)]
    pub oracle_queue: AccountInfo<'info>,
    pub queue_authority: AccountInfo<'info>,
    pub data_buffer: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [
            b"PermissionAccountData",
            queue_authority.key().as_ref(),
            oracle_queue.key().as_ref(),
            vrf.key().as_ref()
        ],
        bump = params.permission_bump
    )]
    pub permission: AccountInfo<'info>,
    #[account(mut, constraint = escrow.owner == program_state.key())]
    pub escrow: Account<'info, TokenAccount>,
    #[account(mut, constraint = payer_wallet.owner == payer_authority.key())]
    pub payer_wallet: Account<'info, TokenAccount>,
    #[account(signer)]
    pub payer_authority: AccountInfo<'info>,
    pub recent_blockhashes: AccountInfo<'info>,
    #[account(seeds = [b"STATE"], bump = params.state_bump)]
    pub program_state: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
}
```

Napakaraming account iyan, talakayin natin ang bawat isa at bigyan sila ng konteksto.

- `awtoridad` - PDA na nagmula sa aming programa
- `vrf` - [Account na pagmamay-ari ng Switchboard program](https://docs.rs/switchboard-solana/latest/switchboard_solana/oracle_program/accounts/vrf/struct.VrfAccountData.html)
- Oracle Queue - [Account na pagmamay-ari ng Switchboard program na naglalaman ng metadata tungkol sa oracle queue na gagamitin para sa kahilingang ito](https://docs.rs/switchboard-solana/latest/switchboard_solana/oracle_program/accounts/queue/struct.OracleQueueAccountData.html)
- Queue Authority - Awtoridad ng Oracle Queue ang napili
- [Data Buffer](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/rust/switchboard-solana/src/oracle_program/accounts/queue.rs61) `OracleQueueBuffer` account na may hawak na koleksyon ng mga Oracle pubkey na matagumpay na nag-hearbeat bago lumipas ang mga queues na configuration ng `oracleTimeout`. Naka-imbak sa Oracle Queue account.
- [Data ng Account ng Pahintulot](https://docs.rs/switchboard-solana/latest/switchboard_solana/oracle_program/accounts/permission/struct.PermissionAccountData.html)
- Escrow (Switchboard escrow account) - Token Account
- Switchboard program state account - [Of type `SbState`](https://docs.rs/switchboard-solana/latest/switchboard_solana/oracle_program/accounts/sb_state/struct.SbState.html)
- Switchboard Program - Switchboard Program
- Payer Token Account - Gagamitin para magbayad ng mga bayarin
- Payer Authority - Awtoridad ng Payer Token Account
- Kamakailang Blockhashes Program - [Kamakailang Blockhashes Solana program](https://docs.rs/solana-program/latest/solana_program/sysvar/recent_blockhashes/index.html)
- Token Program - Solana Token Program

Iyon lang ang mga account na kailangan para lang sa randomness request, ngayon tingnan natin kung ano ang hitsura nito sa isang programa ng Solana sa pamamagitan ng CPI. Upang gawin ito, ginagamit namin ang `VrfRequestRandomness` data struct mula sa [SwitchboardV2 rust crate.](https://github.com/switchboard-xyz/solana-sdk/blob/main/rust/switchboard-solana/src/oracle_program/instructions/vrf_request_randomness.rs) Ang struct na ito ay may ilang built-in na kakayahan upang gawing mas madali ang ating buhay dito, lalo na ang istraktura ng account ay tinukoy para sa atin at madali nating matatawag ang `invoke` o `invoke_signed` sa object.

```rust
// our client program
use switchboard_v2::VrfRequestRandomness;
use state::*;

pub fn request_randomness(ctx: Context<RequestRandomness>, request_params: RequestRandomnessParams) -> Result <()> {
	let switchboard_program = ctx.accounts.switchboard_program.to_account_info();
	
	let vrf_request_randomness = VrfRequestRandomness {
	    authority: ctx.accounts.vrf_state.to_account_info(),
	    vrf: ctx.accounts.vrf.to_account_info(),
	    oracle_queue: ctx.accounts.oracle_queue.to_account_info(),
	    queue_authority: ctx.accounts.queue_authority.to_account_info(),
	    data_buffer: ctx.accounts.data_buffer.to_account_info(),
	    permission: ctx.accounts.permission.to_account_info(),
	    escrow: ctx.accounts.switchboard_escrow.clone(),
	    payer_wallet: ctx.accounts.payer_wallet.clone(),
	    payer_authority: ctx.accounts.user.to_account_info(),
	    recent_blockhashes: ctx.accounts.recent_blockhashes.to_account_info(),
	    program_state: ctx.accounts.program_state.to_account_info(),
	    token_program: ctx.accounts.token_program.to_account_info(),
	};
	
	msg!("requesting randomness");
	vrf_request_randomness.invoke_signed(
	    switchboard_program,
	    request_params.switchboard_state_bump,
	    request_params.permission_bump,
	    state_seeds,
	)?;

...

Ok(())

}
```

Kapag na-invoke na ang Switchboard program, gagawa ito ng ilang logic sa dulo nito at magtatalaga ng oracle sa tinukoy na oracle queue ng `vrf` account para ihatid ang randomness request. Ang nakatalagang orakulo pagkatapos ay kinakalkula ang isang random na halaga at ipapadala ito pabalik sa programa ng Switchboard.

Kapag na-verify na ang resulta, i-invoke ng Switchboard program ang tagubiling `callback` na tinukoy sa `vrf` account. Ang pagtuturo ng callback ay kung saan mo isusulat ang iyong lohika ng negosyo gamit ang mga random na numero. Sa sumusunod na code, iniimbak namin ang resultang randomness sa aming `vrf_auth` PDA mula sa aming unang hakbang.

```rust
// our client program

#[derive(Accounts)]
pub struct ConsumeRandomness<'info> {
    // vrf client state
    #[account]
    pub vrf_auth: AccountLoader<'info, VrfClientState>,
    // switchboard vrf account
    #[account(
        mut,
        constraint = vrf.load()?.authority == vrf_auth.key() @ EscrowErrorCode::InvalidVrfAuthorityError
    )]
    pub vrf: AccountLoader<'info, VrfAccountData>
}

pub fn handler(ctx: Context<ConsumeRandomness>) -> Result <()> {
    msg!("Consuming randomness!");

		// load the vrf account data
    let vrf = ctx.accounts.vrf.load()?;
		// use the get_result method to fetch the randomness results
    let result_buffer = vrf.get_result()?;

		// check if result buff is all 0's
    if result_buffer == [0u8; 32] {
        msg!("vrf buffer empty");
        return Ok(());
    }

    msg!("Result buffer is {:?}", result_buffer);
		// use the random value how you see fit

    Ok(())
}
```

Ngayon mayroon kang randomness! Hooray! Ngunit may isang huling bagay na hindi pa natin napag-uusapan at iyon ang ibinalik sa pagiging random. Switchboard, nagbibigay sa iyo ng iyong random na pagtawag `[get_result()](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/rust/switchboard-solana/src/oracle_program/accounts/vrf.rs#L122)`. Ibinabalik ng paraang ito ang field na `current_round.result` ng `vrf` account na SwitchboardDecimal na format, na talagang buffer lang ng 32 random `[u8](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/rust/switchboard-solana/src/oracle_program/accounts/ecvrf.rs#L65C26-L65C26)` unsigned-integers. Maaari mong gamitin ang mga unsigned-integer na ito gayunpaman nakikita mong akma sa iyong programa, ngunit ang isang napaka-karaniwang paraan ay upang ituring ang bawat integer sa buffer bilang sarili nitong random na numero. Halimbawa, kung kailangan mo ng dice roll (1-6) kunin lang ang unang byte ng array, module ito ng 6 at magdagdag ng isa.

```rust
// slice byte buffer to store the first value
let dice_roll = (result_buffer[0] % 6) + 1;
```

Ang gagawin mo sa mga random na halaga mula doon ay ganap na nasa iyo!

Iyon ang esensya ng paghiling ng randomness sa isang Switchboard VRF. Upang i-recap ang mga hakbang na kasangkot sa isang kahilingan sa VRF, suriin ang diagram na ito.

![VRF Diagram](../../assets/vrf-diagram.png)

# Demo

Para sa demo ng araling ito, babalikan natin kung saan tayo tumigil sa [Aralin sa Oracle](../oracle.md). Kung hindi mo pa nakumpleto ang Oracle lesson at demo, lubos naming inirerekomenda na gawin mo dahil maraming magkakapatong na konsepto at magsisimula kami sa codebase ng Oracle lesson.

Kung ayaw mong kumpletuhin ang Oracle lesson, ang starter code para sa demo na ito ay ibinigay para sa iyo sa [pangunahing sangay ng demo Github repository](https://github.com/Unboxed-Software/michael-burry- escrow).

Ang repo ay naglalaman ng isang "Michael Burry" escrow program. Ito ay isang program na nagbibigay-daan sa isang user na i-lock ang ilang mga pondo ng solana sa escrow na hindi maaaring bawiin hanggang sa maabot ng SOL ang isang paunang natukoy na presyo sa USD na pinili ng user. Magdaragdag kami ng VRF functionality sa program na ito upang payagan ang user na "Lumabas sa kulungan" sa pamamagitan ng rolling doubles. Ang aming demo ngayon ay magbibigay-daan sa user na gumulong ng dalawang virtual na dice, kung gumulong sila ng doble (ang dalawang dice na tugma), maaaring bawiin ng user ang kanilang mga pondo mula sa escrow anuman ang presyo ng SOL.

### 1. Program Setup

Kung kino-clone mo ang repo mula sa nakaraang aralin tiyaking gawin ang sumusunod:

1. `git clone [https://github.com/Unboxed-Software/michael-burry-escrow](https://github.com/Unboxed-Software/michael-burry-escrow)`
2. `cd michael-burry-escrow`
3. `anchor build`
4. `listahan ng mga anchor key`
     1. Kunin ang resultang key at ilagay ito sa `Anchor.toml` at `programs/burry-escrow/src/lib.rs`
5. `solana config get`
     1. Kunin ang iyong **Path ng Keypair** at palitan ang field ng `wallet` sa iyong `Anchor.toml`
6. `pag-install ng sinulid`
7. `anchor test`

Kapag nalampasan na ang lahat ng pagsubok handa na kaming magsimula. Magsisimula kami sa pamamagitan ng pagpuno ng ilang bagay sa boilerplate, pagkatapos ay ipapatupad namin ang mga function.

### 2. Cargo.toml

Una, dahil gumagamit ang VRF ng mga token ng SPL para sa kanilang mga bayarin kailangan naming mag-import ng `anchor-spl` sa aming `Cargo.toml` file.

```tsx
[dependencies]
anchor-lang = "0.28.0"
anchor-spl = "0.28.0"
switchboard-v2 = "0.4.0"
```

### 3. Lib.rs

Susunod, i-edit natin ang `lib.rs` at idagdag ang mga karagdagang function na gagawin natin ngayon. Ang mga function ay ang mga sumusunod:
- `init_vrf_client` - Lumilikha ng VRF authority PDA, na magpi-sign para sa at ubusin ang randomness.
- `get_out_of_jail` - Humihiling ng randomness mula sa VRF, na epektibong gumulong ng dice.
- `consume_randomess` - Ang callback function para sa VRF kung saan titingnan natin ang mga dice roll.

```rust
use anchor_lang::prelude::*;
use instructions::deposit::*;
use instructions::withdraw::*;
use instructions::init_vrf_client::*;
use instructions::get_out_of_jail::*;
use instructions::consume_randomness::*;

pub mod instructions;
pub mod state;
pub mod errors;

declare_id!("YOUR_KEY_HERE");

#[program]
mod burry_escrow {

    use crate::instructions::init_vrf_client::init_vrf_client_handler;

    use super::*;

    pub fn deposit(ctx: Context<Deposit>, escrow_amt: u64, unlock_price: f64) -> Result<()> {
        deposit_handler(ctx, escrow_amt, unlock_price)
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        withdraw_handler(ctx)
    }

    pub fn init_vrf_client(ctx: Context<InitVrfClient>) -> Result<()>{
        init_vrf_client_handler(ctx)
    }

		pub fn get_out_of_jail(ctx: Context<RequestRandomness>, params: RequestRandomnessParams) -> Result<()>{
        get_out_of_jail_handler(ctx, params)
    }

    pub fn consume_randomness(ctx: Context<ConsumeRandomness>) -> Result<()>{
        consume_randomness_handler(ctx)
    }
}
```

Tiyaking papalitan mo ang `YOUR_KEY_HERE` ng sarili mong program key.

### 4. State.rs

Susunod, sa `state.rs`, magdagdag ng `out_of_jail` na flag sa `EscrowState`. Kapag sa wakas ay na-roll namin ang dalawang magkatugmang die, i-flip namin ang flag na ito. Kapag tinawag ang function na `withdraw` maaari naming ilipat ang mga pondo nang hindi sinusuri ang presyo.

```rust
// state.rs
#[account]
pub struct EscrowState {
    pub unlock_price: f64,
    pub escrow_amount: u64,
    pub out_of_jail: bool
}
```

Pagkatapos, lumikha ng aming pangalawang data account para sa program na ito: `VrfClientState`. Hahawakan nito ang estado ng aming mga dice roll. Magkakaroon ito ng mga sumusunod na field:

- `bump` - Iniimbak ang bump ng account para sa madaling pag-sign sa ibang pagkakataon.
- `result_buffer` - Dito itatapon ng VRF function ang raw randomness data.
- `dice_type` - Itatakda namin ito sa 6 tulad ng sa isang 6-sided na die.
- `die_result_1` at `die_result_2` - Ang mga resulta ng aming dice roll.
- `timestamp` - Sinusubaybayan kung kailan ang aming huling roll.
- `vrf` - Pampublikong key ng VRF account; pagmamay-ari ng programa ng Switchboard. Gagawin namin ito bago namin tawagan ang pagpapaandar ng pagsisimula ng `VrfClientState`.
- `escrow` - Public key ng aming burry escrow account.

Gagawin din namin ang `VrfClientState` na konteksto bilang isang `zero_copy` na struct. Nangangahulugan ito na pasisimulan namin ito gamit ang `load_init()` at ipapasa ito sa mga account na may `AccountLoader`. Ginagawa namin ito dahil ang mga function ng VRF ay napaka-account intensive at kailangan naming maging maingat sa stack. Kung gusto mong matuto nang higit pa tungkol sa `zero_copy`, tingnan ang aming [aralin sa Arkitektura ng Programa](../program-architecture.md).

```rust
// state.rs

#[repr(packed)]
#[account(zero_copy(unsafe))]
#[derive(Default)]
pub struct VrfClientState {
    pub bump: u8,
    pub result_buffer: [u8; 32],
		pub dice_type: u8, // 6 sided
    pub die_result_1: u8,
    pub die_result_2: u8,
    pub timestamp: i64,
    pub vrf: Pubkey,
    pub escrow: Pubkey
}
```



Panghuli, idaragdag namin ang `VRF_STATE_SEED` sa PDA aming VRF Client account.

```rust
pub const VRF_STATE_SEED: &[u8] = b"VRFCLIENT";
```

Dapat ganito ang hitsura ng iyong `state.rs` file:

```rust
use anchor_lang::prelude::*;

pub const ESCROW_SEED: &[u8] = b"MICHAEL BURRY";
pub const VRF_STATE_SEED: &[u8] = b"VRFCLIENT";
pub const SOL_USDC_FEED: &str = "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR";

#[account]
pub struct EscrowState {
    pub unlock_price: f64,
    pub escrow_amount: u64,
    pub out_of_jail: bool
}

#[repr(packed)]
#[account(zero_copy(unsafe))]
#[derive(Default)]
pub struct VrfClientState {
    pub bump: u8,
    pub result_buffer: [u8; 32],
		pub dice_type: u8, // 6 sided
    pub die_result_1: u8,
    pub die_result_2: u8,
    pub timestamp: i64,
    pub vrf: Pubkey,
    pub escrow: Pubkey
}
```

### 5. Errors.rs

Susunod, mag-pit stop tayo at magdagdag ng isang huling error na `InvalidVrfAuthorityError` sa `errors.rs`. Gagamitin namin ito kapag mali ang awtoridad ng VRF.

```rust
use anchor_lang::prelude::*;

#[error_code]
#[derive(Eq, PartialEq)]
pub enum EscrowErrorCode {
    #[msg("Not a valid Switchboard account")]
    InvalidSwitchboardAccount,
    #[msg("Switchboard feed has not been updated in 5 minutes")]
    StaleFeed,
    #[msg("Switchboard feed exceeded provided confidence interval")]
    ConfidenceIntervalExceeded,
    #[msg("Current SOL price is not above Escrow unlock price.")]
    SolPriceAboveUnlockPrice,
    #[msg("Switchboard VRF Account's authority should be set to the client's state pubkey")]
    InvalidVrfAuthorityError,
}
```

### 6. Mod.rs

Ngayon, baguhin natin ang aming `mod.rs` file upang isama ang aming mga bagong function na aming isusulat.

```rust
pub mod deposit;
pub mod withdraw;
pub mod init_vrf_client;
pub mod get_out_of_jail;
pub mod consume_randomness;
```

### 7. Deposit.rs and Withdraw.rs

Panghuli, i-update natin ang aming mga file na `deposit.rs` at `withdraw.rs` upang ipakita ang aming malapit nang maging bagong kapangyarihan.

Una, simulan natin ang ating `out_of_jail` na flag sa `false` sa `deposit.rs`.

```rust
// in deposit.rs
...
let escrow_state = &mut ctx.accounts.escrow_account;
    escrow_state.unlock_price = unlock_price;
    escrow_state.escrow_amount = escrow_amount;
    escrow_state.out_of_jail = false; 
...
```

Susunod, isulat natin ang ating simpleng lohika sa pag-alis sa bilangguan. I-wrap ang aming mga pagsusuri sa presyo ng oracle ng isang `if` na pahayag. Kung mali ang flag na `out_of_jail` sa `escrow_state` account, pagkatapos ay titingnan namin ang presyo kung saan maa-unlock ang SOL:

```rust
if !escrow_state.out_of_jail {
      // get result
      let val: f64 = feed.get_result()?.try_into()?;

      // check whether the feed has been updated in the last 300 seconds
      feed.check_staleness(Clock::get().unwrap().unix_timestamp, 300)
      .map_err(|_| error!(EscrowErrorCode::StaleFeed))?;

      msg!("Current feed result is {}!", val);
      msg!("Unlock price is {}", escrow_state.unlock_price);

      if val < escrow_state.unlock_price as f64 {
          return Err(EscrowErrorCode::SolPriceAboveUnlockPrice.into())
      }
  }
```

Kung totoo ang `out_of_jail`, makakalabas tayo ng kulungan nang libre at maaaring laktawan ang pagsusuri sa presyo, dumiretso sa ating pag-withdraw.

### 8. Using VRF

Ngayong wala na tayong boilerplate, magpatuloy tayo sa ating unang karagdagan: pagsisimula ng ating VRF Client. Gumawa tayo ng bagong file na tinatawag na `init_vrf_client.rs` sa folder na `/instructions`.

Idaragdag namin ang mga kinakailangang crates, pagkatapos ay gagawin ang kontekstong `InitVrfClient`. Kakailanganin namin ang mga sumusunod na account:

- `user` - ang lumagda na may mga pondo sa escrow.
- `escrow_account` - ang burry escrow account na ginawa noong ni-lock ng user ang kanilang mga pondo.
- `vrf_client_state` - account na gagawin namin sa tagubiling ito upang hawakan ang estado tungkol sa mga dice roll ng user.
- `vrf` - Ang aming VRF na pagmamay-ari ng Switchboard program, gagawin namin itong account client-side bago namin tawagan ang `init_vrf_client`.
- `system_program` - Ang system program dahil ginagamit namin ang init macro para sa `vrf_state`, na tinatawag na `create_account` sa ilalim ng hood.

```rust
use crate::state::*;
use crate::errors::*;
use anchor_lang::prelude::*;
use switchboard_v2::VrfAccountData;

#[derive(Accounts)]
pub struct InitVrfClient<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    // burry escrow account
    #[account(
        mut,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
    )]
    pub escrow_account: Account<'info, EscrowState>,
    // vrf client state
    #[account(
        init,
        seeds = [
						VRF_STATE_SEED,
            user.key.as_ref(),
            escrow_account.key().as_ref(),
            vrf.key().as_ref(),
        ],
        payer = user,
        space = 8 + std::mem::size_of::<VrfClientState>(),
        bump
    )]
    pub vrf_state: AccountLoader<'info, VrfClientState>,

    // switchboard vrf account
    #[account(
        mut,
        constraint = vrf.load()?.authority == vrf_state.key() @ EscrowErrorCode::InvalidVrfAuthorityError
    )]
    pub vrf: AccountLoader<'info, VrfAccountData>,
    pub system_program: Program<'info, System>
}
```

Pansinin ang `vrf_state` account ay isang PDA na hinango sa `VRF_STATE_SEED` string at ang `user`, `escrow_account`, at `vrf` na pampublikong key bilang mga buto. Nangangahulugan ito na ang isang user ay maaari lamang magpasimula ng isang `vrf_state` account, tulad ng maaari lang silang magkaroon ng isang `escrow_account`. Dahil isa lang, Kung gusto mong maging masinsinan, maaaring gusto mong magpatupad ng function na `close_vrf_state` upang maibalik ang iyong upa.

Ngayon, magsulat tayo ng ilang pangunahing lohika ng pagsisimula para sa function na ito. Una naming nilo-load at sinisimulan ang aming `vrf_state` account sa pamamagitan ng pagtawag sa `load_init()`. Pagkatapos ay pinunan namin ang mga halaga para sa bawat field.

```rust
pub fn init_vrf_client_handler(ctx: Context<InitVrfClient>) -> Result<()> {
    msg!("init_client validate");

    let mut vrf_state = ctx.accounts.vrf_state.load_init()?;
    *vrf_state = VrfClientState::default();
    vrf_state.bump = ctx.bumps.get("vrf_state").unwrap().clone();
    vrf_state.escrow = ctx.accounts.escrow_account.key();
    vrf_state.die_result_1 = 0;
    vrf_state.die_result_2 = 0;
    vrf_state.timestamp = 0;
    vrf_state.dice_type = 6; // sided

    Ok(())
}
```

### 9. Get Out of Jail

Ngayong nasimulan na namin ang `VrfClientState` account, magagamit namin ito sa tagubiling `get_out_jail`. Gumawa ng bagong file na tinatawag na `get_out_of_jail.rs` sa folder na `/instructions`.

Ang tagubiling `get_out_jail` ay gagawin ang aming kahilingan sa VRF sa Switchboard. Kakailanganin naming ipasa ang lahat ng mga account na kailangan para sa parehong kahilingan sa VRF at sa aming business logic callback function.

Mga VRF Account:
- `payer_wallet` - ang token wallet na magbabayad para sa kahilingan sa VRF; ang `user` ay dapat ang may-ari ng account na ito.
- `vrf` - Ang VRF account na ginawa ng kliyente.
- `oracle_queue` - Ang oracle queue na maglalagay ng randomness na resulta.
- `queue_authority` - Ang awtoridad sa pila.
- `data_buffer` - Ang data buffer account ng queue - ginagamit ng queue upang kalkulahin/i-verify ang randomness.
- `permission` - Nilikha noong ginagawa ang `vrf` account. Ito ay nagmula sa ilan sa iba pang mga account.
- `switchboard_escrow` - Kung saan ipinapadala ng nagbabayad ang mga token para sa mga kahilingan.
- `program_state` - Estado ng Switchboard program.

Mga Programa:
- `switchboard_program`
- `recent_blockhashes`
- `token_program`
- `system_program`

Mga Account sa Logic ng Negosyo:
- `user` - Ang user account na nag-escrow ng mga pondo.
- `escrow_account` - Ang burry escrow state account para sa user.
- `vrf_state` - Ang VRF client state account ay sinimulan sa `init_vrf_client` na pagtuturo.

```rust
use crate::state::*;
use crate::errors::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::*;
use switchboard_v2::{VrfAccountData, OracleQueueAccountData, PermissionAccountData, SbState, VrfRequestRandomness};
use anchor_spl::token::{TokenAccount, Token};

#[derive(Accounts)]
pub struct RequestRandomness<'info> {
    // PAYER ACCOUNTS
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut,
        constraint =
            payer_wallet.owner == user.key()
            && switchboard_escrow.mint == program_state.load()?.token_mint
    )]
    pub payer_wallet: Account<'info, TokenAccount>,
    // burry escrow account
    #[account(
        mut,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
    )]
    pub escrow_account: Account<'info, EscrowState>,
    // vrf client state
    #[account(
        mut,
        seeds = [
            VRF_STATE_SEED,
            user.key.as_ref(),
            escrow_account.key().as_ref(),
            vrf.key().as_ref(),
        ],
        bump
    )]
    pub vrf_state: AccountLoader<'info, VrfClientState>,
    // switchboard vrf account
    #[account(
        mut,
        constraint = vrf.load()?.authority == vrf_state.key() @ EscrowErrorCode::InvalidVrfAuthorityError
    )]
    pub vrf: AccountLoader<'info, VrfAccountData>,
    // switchboard accounts
    #[account(mut,
        has_one = data_buffer
    )]
    pub oracle_queue: AccountLoader<'info, OracleQueueAccountData>,
    /// CHECK:
    #[account(
        mut,
        constraint = oracle_queue.load()?.authority == queue_authority.key()
    )]
    pub queue_authority: UncheckedAccount<'info>,
    /// CHECK
    #[account(mut)]
    pub data_buffer: AccountInfo<'info>,
    #[account(mut)]
    pub permission: AccountLoader<'info, PermissionAccountData>,
    #[account(mut,
        constraint = switchboard_escrow.owner == program_state.key() && switchboard_escrow.mint == program_state.load()?.token_mint
    )]
    pub switchboard_escrow: Account<'info, TokenAccount>,
    #[account(mut)]
    pub program_state: AccountLoader<'info, SbState>,
    /// CHECK:
    #[account(
        address = *vrf.to_account_info().owner,
        constraint = switchboard_program.executable == true
    )]
    pub switchboard_program: AccountInfo<'info>,
    // SYSTEM ACCOUNTS
    /// CHECK:
    #[account(address = recent_blockhashes::ID)]
    pub recent_blockhashes: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>
}
```

Panghuli, gagawa kami ng bagong struct `RequestRandomnessParams`. Papasa kami sa side ng kliyente ng ilang account.

```rust
#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct RequestRandomnessParams {
    pub permission_bump: u8,
    pub switchboard_state_bump: u8,
}
```

Ngayon, maaari tayong magtrabaho sa lohika ng pagtuturo na ito. Dapat tipunin ng logic ang lahat ng mga account na kailangan at ipasa ang mga ito sa `[VrfRequestRandomness](https://github.com/switchboard-xyz/solana-sdk/blob/fbef37e4a78cbd8b8b6346fcb96af1e20204b861/rust/switchboard-solana/src/oracle_program/instructions/vrf_request_randomness.rs#L8)`, na talagang magandang struct mula sa Switchboard. Pagkatapos ay pipirmahan namin ang kahilingan at ipapadala ito sa paraang ito.

```rust
pub fn get_out_of_jail_handler(ctx: Context<RequestRandomness>, params: RequestRandomnessParams) -> Result <()> {
    let switchboard_program = ctx.accounts.switchboard_program.to_account_info();
    let vrf_state = ctx.accounts.vrf_state.load()?;
    
    let bump = vrf_state.bump.clone();
    drop(vrf_state);

		// build vrf request struct from the Switchboard Rust crate
    let vrf_request_randomness = VrfRequestRandomness {
        authority: ctx.accounts.vrf_state.to_account_info(),
        vrf: ctx.accounts.vrf.to_account_info(),
        oracle_queue: ctx.accounts.oracle_queue.to_account_info(),
        queue_authority: ctx.accounts.queue_authority.to_account_info(),
        data_buffer: ctx.accounts.data_buffer.to_account_info(),
        permission: ctx.accounts.permission.to_account_info(),
        escrow: ctx.accounts.switchboard_escrow.clone(),
        payer_wallet: ctx.accounts.payer_wallet.clone(),
        payer_authority: ctx.accounts.user.to_account_info(),
        recent_blockhashes: ctx.accounts.recent_blockhashes.to_account_info(),
        program_state: ctx.accounts.program_state.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
    };

    let vrf_key = ctx.accounts.vrf.key();
    let escrow_key = ctx.accounts.escrow_account.key();
    let user_key = ctx.accounts.user.key();
    let state_seeds: &[&[&[u8]]] = &[&[
				&VRF_STATE_SEED,
        user_key.as_ref(),
        escrow_key.as_ref(),
        vrf_key.as_ref(),
        &[bump],
    ]];

    // submit vrf request with PDA signature
    msg!("requesting randomness");
    vrf_request_randomness.invoke_signed(
        switchboard_program,
        params.switchboard_state_bump,
        params.permission_bump,
        state_seeds,
    )?;

    msg!("randomness requested successfully");

    Ok(())
}
```

### 10. Consume Randomness
Ngayong nakagawa na kami ng lohika para humiling ng VRF mula sa Switchboard, kailangan naming buuin ang callback na pagtuturo na tatawagan ng Switchboard program kapag na-verify na ang VRF. Gumawa ng bagong file na tinatawag na `consume_randomness.rs` sa `/instructions` na direktoryo.

Gagamitin ng function na ito ang randomness upang matukoy kung aling mga dice ang na-roll. Kung ang mga doble ay pinagsama, itakda ang field na `out_of_jail` sa `vrf_state` sa true.

Una, gawin natin ang kontekstong `ConsumeRandomness`. Buti na lang, tatlong account lang ang kailangan.

- `escrow_account` - account ng estado para sa mga naka-escrow na pondo ng user.
- `vrf_state` - account ng estado na may hawak na impormasyon tungkol sa dice roll.
- `vrf` - account na may random na numero na kakakalkula lang ng Switchboard network.

```rust
// insde consume_randomness.rs
use crate::state::*;
use crate::errors::*;
use anchor_lang::prelude::*;
use switchboard_v2::VrfAccountData;

#[derive(Accounts)]
pub struct ConsumeRandomness<'info> {
    // burry escrow account
    #[account(mut)]
    pub escrow_account: Account<'info, EscrowState>,
    // vrf client state
    #[account(mut)]
    pub vrf_state: AccountLoader<'info, VrfClientState>,
    // switchboard vrf account
    #[account(
        mut,
        constraint = vrf.load()?.authority == vrf_state.key() @ EscrowErrorCode::InvalidVrfAuthorityError
    )]
    pub vrf: AccountLoader<'info, VrfAccountData>
}
```

Ngayon, isulat natin ang lohika para sa ating `consume_randomness_handler`. Kukunin muna namin ang mga resulta mula sa `vrf` account.

Kailangan nating tawagan ang `load()` dahil ang `vrf` ay ipinasa bilang isang `AccountLoader`. Tandaan, iniiwasan ng `AccountLoader` ang parehong stack at heap overflow para sa malalaking account. Pagkatapos, tinatawagan namin ang `get_result()` para kunin ang randomness mula sa loob ng `VrfAccountData` struct. Sa wakas, susuriin namin kung ang resultang buffer ay na-zero out. Kung ang lahat ng ito ay mga zero, nangangahulugan ito na ang Oracles ay hindi pa nave-verify at idineposito ang randomness sa account.

```rust
// inside consume_randomness.rs

pub fn consume_randomness_handler(ctx: Context<ConsumeRandomness>) -> Result <()> {
    msg!("Consuming randomness...");

    let vrf = ctx.accounts.vrf.load()?;
    let result_buffer = vrf.get_result()?;

    if result_buffer == [0u8; 32] {
        msg!("vrf buffer empty");
        return Ok(());
    }

		Ok(())
}
```

Pagkatapos, nilo-load namin ang aming `vrf_state` gamit ang `load_mut` dahil iimbak namin ang randomness at dice roll sa loob nito. Gusto rin naming suriin na ang `result_buffer` na ibinalik mula sa `vrf` ay hindi tumutugma sa byte para sa byte ang `result_buffer` mula sa `vrf_state`. Kung magkatugma sila, alam namin na ang ibinalik na randomness ay lipas na.

```rust
pub fn consume_randomness_handler(ctx: Context<ConsumeRandomness>) -> Result <()> {
    msg!("Successfully consumed randomness.");

    let vrf = ctx.accounts.vrf.load()?;
    let result_buffer = vrf.get_result()?;

    if result_buffer == [0u8; 32] {
        msg!("vrf buffer empty");
        return Ok(());
    }
		// new code
    let vrf_state = &mut ctx.accounts.vrf_state.load_mut()?;
    if result_buffer == vrf_state.result_buffer {
        msg!("result_buffer unchanged");
        return Ok(());
    }

		...
		...
}
```

Ngayon ay oras na upang aktwal na gamitin ang random na resulta. Dahil dalawang dice lang ang ginagamit namin, kailangan lang namin ang unang dalawang byte ng buffer. Upang i-convert ang mga random na halaga na ito sa "mga dice roll", gumagamit kami ng modular arithmetic. Para sa sinumang hindi pamilyar sa modular arithmetic, [makakatulong ang Wikipedia](https://en.wikipedia.org/wiki/Modular_arithmetic). Sa modular arithmetic, ang mga numero ay "balot sa paligid" kapag naabot ang isang nakapirming dami. Ang ibinigay na dami na ito ay kilala bilang modulus na umalis bilang natitira. Dito, ang modulus ay ang `dice_type` na nakaimbak sa `vrf_state` account. Na-hard-code namin ito sa 6 noong nasimulan ang account upang kumatawan sa isang 6-sided na die. Kapag ginamit namin ang `dice_type`, o 6, bilang modulus, ang aming resulta ay magiging numero 0-5. Pagkatapos ay magdagdag kami ng isa, upang gawin ang mga nagresultang posibilidad na 1-6.

```rust
pub fn consume_randomness_handler(ctx: Context<ConsumeRandomness>) -> Result <()> {
    msg!("Successfully consumed randomness.");

    let vrf = ctx.accounts.vrf.load()?;
    let result_buffer = vrf.get_result()?;

    if result_buffer == [0u8; 32] {
        msg!("vrf buffer empty");
        return Ok(());
    }

    let vrf_state = &mut ctx.accounts.vrf_state.load_mut()?;
    let dice_type = vrf_state.dice_type;
    if result_buffer == vrf_state.result_buffer {
        msg!("result_buffer unchanged");
        return Ok(());
    }

    msg!("Result buffer is {:?}", result_buffer);

    let dice_1 = result_buffer[0] % dice_type + 1;
    let dice_2 = result_buffer[1] % dice_type + 1;

    msg!("Current Die 1 Value [1 - {}) = {}!", dice_type, dice_1);
    msg!("Current Die 2 Value [1 - {}) = {}!", dice_type, dice_2);

		...
		...
}
```

> Fun fact from Christian (one of the editors): one byte per roll is actually a slightly bad option for a dice roll. (Good enough to demo) You have 256 options in a u8. When modulo'd by 6, the number zero has a slight advantage in the distribution (256 is not divisible by 6).
> Number of 0s: (255-0)/6 + 1 = 43
> Number of 1s: (256-1)/6 = 42.6, so 42 occurrences of 1
> Number of 2s: (257-2)/6 = 42.5, so 42 occurrences of 2
> Number of 3s: (258-3)/6 = 42.5, so 42 occurrences of 3
> Number of 4s: (259-4)/6 = 42.5, so 42 occurrences of 4
> Number of 5s: (260-5)/6 = 42.5, so 42 occurrences of 5

Ang pinakahuling bagay na kailangan nating gawin ay i-update ang mga patlang sa `vrf_state` at matukoy ay ang user rolled doubles. Kung gayon, i-flip ang flag na `out_of_jail` sa true.

Kung ang `out_of_jail` ay naging totoo, ang user ay maaaring tumawag sa `withdraw` na pagtuturo at ito ay lalaktawan sa pagsuri ng presyo.

```rust
pub fn consume_randomness_handler(ctx: Context<ConsumeRandomness>) -> Result <()> {
    msg!("Successfully consumed randomness.");

    let vrf = ctx.accounts.vrf.load()?;
    let result_buffer = vrf.get_result()?;

    if result_buffer == [0u8; 32] {
        msg!("vrf buffer empty");
        return Ok(());
    }

    let vrf_state = &mut ctx.accounts.vrf_state.load_mut()?;
    let dice_type = vrf_state.dice_type;
    if result_buffer == vrf_state.result_buffer {
        msg!("result_buffer unchanged");
        return Ok(());
    }

    msg!("Result buffer is {:?}", result_buffer);

    let dice_1 = result_buffer[0] % dice_type + 1;
    let dice_2 = result_buffer[1] % dice_type + 1;

    msg!("Current Die 1 Value [1 - {}) = {}!", dice_type, dice_1);
    msg!("Current Die 2 Value [1 - {}) = {}!", dice_type, dice_2);

    msg!("Updating VRF State with random value...");
    vrf_state.result_buffer = result_buffer;
    vrf_state.die_result_1 = dice_1;
    vrf_state.die_result_2 = dice_2;
    vrf_state.timestamp = Clock::get().unwrap().unix_timestamp;

    if dice_1 == dice_2 {
        msg!("Rolled doubles, get out of jail free!");
        let escrow_state = &mut ctx.accounts.escrow_account;
        escrow_state.out_of_jail = true;
    }

    Ok(())
}
```

At iyon lang para sa pag-andar na makalabas sa kulungan! Binabati kita, nakagawa ka lang ng isang programa na maaaring kumonsumo ng mga feed ng data ng Switchboard at magsumite ng mga kahilingan sa VRF. Pakitiyak na matagumpay na nabubuo ang iyong programa sa pamamagitan ng pagpapatakbo ng `anchor build`.

### 11. Testing

Sige, subukan natin ang aming programa. Sa kasaysayan, kailangan nating subukan ang VRF sa Devnet. Sa kabutihang palad, ang mga tao sa Switchboard ay lumikha ng ilang talagang magagandang function upang hayaan kaming magpatakbo ng sarili naming VRF oracle nang lokal. Para dito, kakailanganin naming i-set up ang aming lokal na server, kunin ang lahat ng tamang account, at pagkatapos ay tawagan ang aming programa.

Ang unang bagay na gagawin namin ay kumuha ng ilan pang account sa aming `Anchor.toml` file:

```rust
# VRF ACCOUNTS
[[test.validator.clone]] # sbv2 attestation programID
address = "sbattyXrzedoNATfc4L31wC9Mhxsi1BmFhTiN8gDshx"

[[test.validator.clone]] # sbv2 attestation IDL
address = "5ExuoQR69trmKQfB95fDsUGsUrrChbGq9PFgt8qouncz"

[[test.validator.clone]] # sbv2 SbState
address = "CyZuD7RPDcrqCGbNvLCyqk6Py9cEZTKmNKujfPi3ynDd"
```

Pagkatapos ay gumawa kami ng bagong test file na tinatawag na `vrf-test.ts` at kopyahin at i-paste ang code sa ibaba. Kumokopya ito sa huling dalawang pagsubok mula sa aralin sa oracle, nagdaragdag ng ilang import, at nagdaragdag ng bagong function na tinatawag na `delay`.

```tsx
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BurryEscrow } from "../target/types/burry_escrow";
import { Big } from "@switchboard-xyz/common";
import { AggregatorAccount, AnchorWallet, SwitchboardProgram, SwitchboardTestContext, Callback, PermissionAccount } from "@switchboard-xyz/solana.js"
import { NodeOracle } from "@switchboard-xyz/oracle"
import { assert } from "chai";

export const solUsedSwitchboardFeed = new anchor.web3.PublicKey("GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR")

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

describe("burry-escrow-vrf", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.AnchorProvider.env()
  const program = anchor.workspace.BurryEscrow as Program<BurryEscrow>;
  const payer = (provider.wallet as AnchorWallet).payer

  it("Create Burry Escrow Above Price", async () => {
    // fetch switchboard devnet program object
    const switchboardProgram = await SwitchboardProgram.load(
      "devnet",
      new anchor.web3.Connection("https://api.devnet.solana.com"),
      payer
    )
    const aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed)

    // derive escrow state account
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    console.log("Escrow Account: ", escrowState.toBase58())

    // fetch latest SOL price
    const solPrice: Big | null = await aggregatorAccount.fetchLatestValue()
    if (solPrice === null) {
      throw new Error('Aggregator holds no value')
    }
    const failUnlockPrice = solPrice.plus(10).toNumber()
    const amountToLockUp = new anchor.BN(100)

    // Send transaction
    try {
      const tx = await program.methods.deposit(
        amountToLockUp, 
        failUnlockPrice
      )
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")
      console.log("Your transaction signature", tx)

      // Fetch the created account
      const newAccount = await program.account.escrowState.fetch(
        escrowState
      )

      const escrowBalance = await provider.connection.getBalance(escrowState, "confirmed")
      console.log("Onchain unlock price:", newAccount.unlockPrice)
      console.log("Amount in escrow:", escrowBalance)

      // Check whether the data onchain is equal to local 'data'
      assert(failUnlockPrice == newAccount.unlockPrice)
      assert(escrowBalance > 0)
    } catch (e) {
      console.log(e)
      assert.fail(e)
    }
  })

  it("Attempt to withdraw while price is below UnlockPrice", async () => {
    let didFail = false;

    // derive escrow address
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    
    // send tx
    try {
      const tx = await program.methods.withdraw()
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        feedAggregator: solUsedSwitchboardFeed,
        systemProgram: anchor.web3.SystemProgram.programId
    })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")
      console.log("Your transaction signature", tx)

    } catch (e) {
      // verify tx returns expected error
      didFail = true;
      console.log(e.error.errorMessage)
      assert(e.error.errorMessage == 'Current SOL price is not above Escrow unlock price.')
    }

    assert(didFail)
  })
});
```

> Quick note: if you only want to run the vrf tests, change
> 
> 
> `describe("burry-escrow-vrf", () => {`
> 
> — to —
> 
> `describe.only("burry-escrow-vrf", () => {`
> 

Ngayon, ise-set up namin ang aming lokal na VRF Oracle server gamit ang `SwitchboardTestContext`. Bibigyan tayo nito ng kontekstong `switchboard` at isang `oracle` node. Tinatawag namin ang pagpapasimula ng mga function sa `before()` function. Ito ay tatakbo at makukumpleto bago magsimula ang anumang pagsubok. Panghuli, idagdag natin ang `oracle?.stop()` sa `after()` function para linisin ang lahat.

```tsx
describe.only("burry-escrow-vrf", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.AnchorProvider.env()
  const program = anchor.workspace.BurryEscrow as Program<BurryEscrow>;
  const payer = (provider.wallet as AnchorWallet).payer

  // ADDED CODE
  let switchboard: SwitchboardTestContext
  let oracle: NodeOracle

  before(async () => {
    switchboard = await SwitchboardTestContext.loadFromProvider(provider, {
      name: "Test Queue",
      // You can provide a keypair to so the PDA schemes dont change between test runs
      // keypair: SwitchboardTestContext.loadKeypair(SWITCHBOARD_KEYPAIR_PATH),
      queueSize: 10,
      reward: 0,
      minStake: 0,
      oracleTimeout: 900,
      // aggregators will not require PERMIT_ORACLE_QUEUE_USAGE before joining a queue
      unpermissionedFeeds: true,
      unpermissionedVrf: true,
      enableBufferRelayers: true,
      oracle: {
        name: "Test Oracle",
        enable: true,
        // stakingWalletKeypair: SwitchboardTestContext.loadKeypair(STAKING_KEYPAIR_PATH),
      },
    })

    oracle = await NodeOracle.fromReleaseChannel({
      chain: "solana",
      // use the latest testnet (devnet) version of the oracle
      releaseChannel: "testnet",
      // disables production capabilities like monitoring and alerts
      network: "localnet",
      rpcUrl: provider.connection.rpcEndpoint,
      oracleKey: switchboard.oracle.publicKey.toBase58(),
      // path to the payer keypair so the oracle can pay for txns
      secretPath: switchboard.walletPath,
      // set to true to suppress oracle logs in the console
      silent: false,
      // optional env variables to speed up the workflow
      envVariables: {
        VERBOSE: "1",
        DEBUG: "1",
        DISABLE_NONCE_QUEUE: "1",
        DISABLE_METRICS: "1",
      },
    })

    switchboard.oracle.publicKey

    // start the oracle and wait for it to start heartbeating onchain
    await oracle.startAndAwait()
  })

  after(() => {
    oracle?.stop()
  })

// ... rest of code
}
```

Ngayon, patakbuhin natin ang aktwal na pagsubok. Bubuuin namin ang pagsubok upang patuloy na gumulong hanggang makakuha kami ng doble, pagkatapos ay titingnan namin kung maaari naming bawiin ang mga pondo.

Una, kukunin namin ang lahat ng mga account na kailangan namin. Ang konteksto ng pagsubok na `switchboard` ay nagbibigay sa amin ng karamihan sa mga ito. Pagkatapos ay kakailanganin naming tawagan ang aming `initVrfClient` function. Sa wakas, i-roll namin ang aming mga dice sa isang loop at suriin para sa doubles.

```tsx
it("Roll till you can withdraw", async () => {
  // derive escrow address
  const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
    program.programId
  )

  const vrfSecret = anchor.web3.Keypair.generate()
  const [vrfClientKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("VRFCLIENT"),
      payer.publicKey.toBytes(),
      escrowState.toBytes(),
      vrfSecret.publicKey.toBytes(),
    ],
    program.programId
  )
  console.log(`VRF Client: ${vrfClientKey}`)

  const vrfIxCoder = new anchor.BorshInstructionCoder(program.idl)
  const vrfClientCallback: Callback = {
    programId: program.programId,
    accounts: [
      // ensure all accounts in consumeRandomness are populated
      // { pubkey: payer.publicKey, isSigner: false, isWritable: true },
      { pubkey: escrowState, isSigner: false, isWritable: true },
      { pubkey: vrfClientKey, isSigner: false, isWritable: true },
      { pubkey: vrfSecret.publicKey, isSigner: false, isWritable: true },
    ],
    ixData: vrfIxCoder.encode("consumeRandomness", ""), // pass any params for instruction here
  }

  const queue = await switchboard.queue.loadData();

  // Create Switchboard VRF and Permission account
  const [vrfAccount] = await switchboard.queue.createVrf({
    callback: vrfClientCallback,
    authority: vrfClientKey, // vrf authority
    vrfKeypair: vrfSecret,
    enable: !queue.unpermissionedVrfEnabled, // only set permissions if required
  })

  // vrf data
  const vrf = await vrfAccount.loadData();

  console.log(`Created VRF Account: ${vrfAccount.publicKey}`)

  // derive the existing VRF permission account using the seeds
  const [permissionAccount, permissionBump] = PermissionAccount.fromSeed(
    switchboard.program,
    queue.authority,
    switchboard.queue.publicKey,
    vrfAccount.publicKey
  )

  const [payerTokenWallet] = await switchboard.program.mint.getOrCreateWrappedUser(
    switchboard.program.walletPubkey,
    { fundUpTo: 1.0 }
  );

  // initialize vrf client
  try {
    const tx = await program.methods.initVrfClient()
    .accounts({
      user: payer.publicKey,
      escrowAccount: escrowState,
      vrfState: vrfClientKey,
      vrf: vrfAccount.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers([payer])
    .rpc()
    
  } catch (e) {
    console.log(e)
    assert.fail()
  }

  let rolledDoubles = false
  while(!rolledDoubles){
    try {
      // Request randomness and roll dice
      const tx = await program.methods.getOutOfJail({
        switchboardStateBump: switchboard.program.programState.bump, 
        permissionBump})
      .accounts({
        vrfState: vrfClientKey,
        vrf: vrfAccount.publicKey,
        user: payer.publicKey,
        payerWallet: payerTokenWallet,
        escrowAccount: escrowState,
        oracleQueue: switchboard.queue.publicKey,
        queueAuthority: queue.authority,
        dataBuffer: queue.dataBuffer,
        permission: permissionAccount.publicKey,
        switchboardEscrow: vrf.escrow,
        programState: switchboard.program.programState.publicKey,

        switchboardProgram: switchboard.program.programId,
        recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")
      console.log(`Created VrfClient Account: ${vrfClientKey}`)

      // wait a few sec for switchboard to generate the random number and invoke callback ix
      console.log("Rolling Die...")

      let didUpdate = false;
      let vrfState = await program.account.vrfClientState.fetch(vrfClientKey)

      while(!didUpdate){
        console.log("Checking die...")
        vrfState = await program.account.vrfClientState.fetch(vrfClientKey);
        didUpdate = vrfState.timestamp.toNumber() > 0;
        await delay(1000)
      }

      console.log("Roll results - Die 1:", vrfState.dieResult1, "Die 2:", vrfState.dieResult2)
      if(vrfState.dieResult1 == vrfState.dieResult2){
        rolledDoubles = true
      } else {
        console.log("Resetting die...")
        await delay(5000)
      }

    } catch (e) {
      console.log(e)
      assert.fail()
    }
  }

  const tx = await program.methods.withdraw()
  .accounts({
    user: payer.publicKey,
    escrowAccount: escrowState,
    feedAggregator: solUsedSwitchboardFeed,
    systemProgram: anchor.web3.SystemProgram.programId
  })
  .signers([payer])
  .rpc()
  
  await provider.connection.confirmTransaction(tx, "confirmed")
})
```

Tandaan ang function kung saan namin nakukuha ang aming `payerTokenWallet`. Ang VRF ay talagang nangangailangan ng humihiling na magbayad ng ilang nakabalot na SOL. Ito ay bahagi ng mekanismo ng insentibo ng network ng oracle. Sa kabutihang palad, sa pagsubok, binibigyan kami ng Switchboard ng napakagandang function na ito upang lumikha at pondohan ang isang pansubok na pitaka.

```typescript
  const [payerTokenWallet] = await switchboard.program.mint.getOrCreateWrappedUser(
    switchboard.program.walletPubkey,
    { fundUpTo: 1.0 }
  );
```

At nariyan ka na! Dapat mong patakbuhin at ipasa ang lahat ng mga pagsubok gamit ang `anchor test`.

Kung may hindi gumagana, bumalik at hanapin kung saan ka nagkamali. Bilang kahalili, huwag mag-atubiling subukan ang [code ng solusyon sa `vrf` branch](https://github.com/Unboxed-Software/michael-burry-escrow/tree/vrf). Tandaang i-update ang iyong mga program key at wallet path tulad ng ginawa namin sa [the Setup step](#1-program-setup).

# Challenge

Ngayon ay oras na upang gumawa ng isang bagay nang nakapag-iisa. Magdagdag tayo ng ilang [Monopoly rules](https://en.wikipedia.org/wiki/Monopoly_(game)#Rules) sa aming programa. Magdagdag ng ilang lohika sa programa upang masubaybayan kung gaano karaming beses gumulong ang isang user. Kung gumulong sila ng 3 beses nang walang rolling doubles, dapat ma-withdraw nila ang kanilang mga pondo, tulad ng paglabas sa kulungan sa Monopoly.

Kung natigil ka, mayroon kaming solusyon sa [`vrf-challenge-solution` branch](https://github.com/Unboxed-Software/michael-burry-escrow/tree/vrf-challenge-solution).

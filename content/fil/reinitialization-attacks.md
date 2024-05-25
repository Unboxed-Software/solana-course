---
title: Reinitialization Attacks
objectives:
- Ipaliwanag ang mga panganib sa seguridad na nauugnay sa isang kahinaan sa muling pagsisimula
- Gumamit ng long-form na Rust check kung nasimulan na ang isang account
- Paggamit ng hadlang sa `init` ng Anchor upang simulan ang mga account, na awtomatikong nagtatakda ng discriminator ng account na sinusuri upang maiwasan ang muling pagsisimula ng isang account
---

# TL;DR

- Gumamit ng discriminator ng account o flag ng initialization upang tingnan kung nasimulan na ang isang account upang maiwasang ma-reinitialize ang isang account at ma-override ang kasalukuyang data ng account.
- Para maiwasan ang muling pagsisimula ng account sa plain Rust, simulan ang mga account gamit ang `is_initialized` na flag at tingnan kung naitakda na ito sa true kapag nagpasimula ng account
  ```rust
  if account.is_initialized {
      return Err(ProgramError::AccountAlreadyInitialized.into());
  }
  ```
- Upang gawing simple ito, gamitin ang hadlang na `init` ng Anchor upang lumikha ng isang account sa pamamagitan ng CPI sa program ng system at itakda ang discriminator nito

# Lesson

Ang pagsisimula ay tumutukoy sa pagtatakda ng data ng isang bagong account sa unang pagkakataon. Kapag nagpasimula ng isang bagong account, dapat kang magpatupad ng isang paraan upang suriin kung ang account ay nasimulan na. Kung walang naaangkop na pagsusuri, maaaring muling simulan ang isang umiiral na account at ma-overwrite ang umiiral nang data.

Tandaan na ang pagsisimula ng account at paggawa ng account ay dalawang magkahiwalay na tagubilin. Ang paggawa ng account ay nangangailangan ng paggamit ng `create_account` na pagtuturo sa System Program na tumutukoy sa espasyong kinakailangan para sa account, ang renta sa mga laport na nakalaan sa account, at ang may-ari ng program ng account. Ang pagsisimula ay isang tagubilin na nagtatakda ng data ng isang bagong likhang account. Ang paglikha at pagsisimula ng isang account ay maaaring pagsamahin sa isang transaksyon.

### Missing Initialization Check

Sa halimbawa sa ibaba, walang mga pagsusuri sa `user` account. Ang `initialize` na pagtuturo ay nagde-deserialize sa data ng `user` account bilang isang `User` na uri ng account, nagtatakda ng `authority` field, at nagse-serialize ng na-update na data ng account sa `user` account.

Nang walang mga pagsusuri sa `user` account, ang parehong account ay maaaring maipasa sa `initialize` na pagtuturo sa pangalawang pagkakataon ng isa pang partido upang i-overwrite ang umiiral na `authority` na nakaimbak sa data ng account.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_insecure  {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        user.authority = ctx.accounts.authority.key();
        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
		#[account(mut)]
    user: AccountInfo<'info>,
    #[account(mut)]
		authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    authority: Pubkey,
}
```

### Add `is_initialized` check

Ang isang diskarte para ayusin ito ay ang magdagdag ng karagdagang field na `is_initialized` sa uri ng account ng `User` at gamitin ito bilang flag para tingnan kung nasimulan na ang isang account.

```jsx
if user.is_initialized {
    return Err(ProgramError::AccountAlreadyInitialized.into());
}
```

Sa pamamagitan ng pagsasama ng tseke sa loob ng tagubiling `pagsisimula`, ang account ng `user` ay masisimulan lamang kung hindi pa naitakda sa true ang field na `is_initialize`. Kung naitakda na ang field na `is_initialized`, mabibigo ang transaksyon, at sa gayon ay maiiwasan ang sitwasyon kung saan maaaring palitan ng isang attacker ang awtoridad ng account ng sarili nilang pampublikong key.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_secure {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        if user.is_initialized {
            return Err(ProgramError::AccountAlreadyInitialized.into());
        }

        user.authority = ctx.accounts.authority.key();
        user.is_initialized = true;

        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
		#[account(mut)]
    user: AccountInfo<'info>,
    #[account(mut)]
		authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    is_initialized: bool,
    authority: Pubkey,
}
```

### Use Anchor’s `init` constraint

Ang Anchor ay nagbibigay ng `init` na hadlang na maaaring gamitin kasama ng `#[account(...)]` attribute para makapagsimula ng account. Ang `init` constraint ay lumilikha ng account sa pamamagitan ng isang CPI sa system program at nagtatakda ng account discriminator.

Dapat gamitin ang `init` constraint kasama ng `payer` at `space` constraints. Tinutukoy ng `nagbabayad` ang account na nagbabayad para sa pagsisimula ng bagong account. Tinutukoy ng `space` ang halaga ng espasyo na kailangan ng bagong account, na tumutukoy sa halaga ng mga laport na dapat ilaan sa account. Ang unang 8 byte ng data ay itinakda bilang isang discriminator na awtomatikong idinaragdag ng Anchor upang matukoy ang uri ng account.

Pinakamahalaga para sa araling ito, tinitiyak ng hadlang na `init` na ang pagtuturo na ito ay maaari lamang tawagan ng isang beses sa bawat account, upang maitakda mo ang paunang katayuan ng account sa lohika ng pagtuturo at hindi na kailangang mag-alala tungkol sa isang umaatake na sumusubok na muling simulan ang account. .

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_recommended {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("GM");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8+32)]
    user: Account<'info, User>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}

#[account]
pub struct User {
    authority: Pubkey,
}
```

### Anchor’s `init_if_needed` constraint

Kapansin-pansin na ang Anchor ay may hadlang na `init_if_needed`. Ang paghihigpit na ito ay dapat gamitin nang maingat. Sa katunayan, ito ay naka-block sa likod ng isang tampok na bandila upang ikaw ay mapipilitang maging sinasadya tungkol sa paggamit nito.

Ang `init_if_needed` constraint ay gumagawa ng parehong bagay gaya ng `init` constraint, kung ang account ay nasimulan na ang pagtuturo ay tatakbo pa rin.

Dahil dito, *********sobrang********* mahalaga na kapag ginamit mo ang hadlang na ito, isasama mo ang mga pagsusuri upang maiwasang i-reset ang account sa paunang katayuan nito.

Halimbawa, kung ang account ay nag-iimbak ng field na `authority` na naitakda sa pagtuturo gamit ang `init_if_needed` constraint, kailangan mo ng mga pagsusuri na matiyak na walang attacker ang makakatawag sa pagtuturo pagkatapos na ito ay masimulan at magkaroon ng `authority` field. itakda muli.

Sa karamihan ng mga kaso, mas ligtas na magkaroon ng hiwalay na tagubilin para sa pagsisimula ng data ng account.

# Demo

Para sa demo na ito, gagawa kami ng isang simpleng program na walang ginagawa kundi magpasimula ng mga account. Magsasama kami ng dalawang tagubilin:

- `insecure_initialization` - nagpapasimula ng account na maaaring muling simulan
- `recommended_initialization` - magpasimula ng account gamit ang `init` constraint ng Anchor

### 1. Starter

Para makapagsimula, i-download ang starter code mula sa `starter` branch ng [repository na ito](https://github.com/Unboxed-Software/solana-reinitialization-attacks/tree/starter). Kasama sa starter code ang isang program na may isang pagtuturo at ang setup ng boilerplate para sa test file.

Ang tagubiling `insecure_initialization` ay nagpapasimula ng bagong account ng `user` na nag-iimbak ng pampublikong susi ng isang `awtoridad`. Sa tagubiling ito, ang account ay inaasahang ilalaan sa panig ng kliyente, pagkatapos ay ipapasa sa pagtuturo ng programa. Kapag naipasa na sa programa, walang mga pagsusuri upang makita kung naitakda na ang paunang katayuan ng `user` account. Nangangahulugan ito na ang parehong account ay maaaring maipasa sa pangalawang pagkakataon upang i-override ang `awtoridad` na nakaimbak sa isang umiiral na account ng `user`.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization {
    use super::*;

    pub fn insecure_initialization(ctx: Context<Unchecked>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        user.authority = ctx.accounts.authority.key();
        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    #[account(mut)]
    /// CHECK:
    user: UncheckedAccount<'info>,
    authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    authority: Pubkey,
}
```

### 2. Test `insecure_initialization` instruction

Kasama sa test file ang setup para gumawa ng account sa pamamagitan ng paggamit ng system program at pagkatapos ay i-invoke ang `insecure_initialization` na pagtuturo nang dalawang beses gamit ang parehong account.

Dahil walang mga pagsusuri sa pag-verify na ang data ng account ay hindi pa nasisimulan, ang pagtuturo ng `insecure_initialization` ay matagumpay na makukumpleto sa parehong pagkakataon, sa kabila ng pangalawang invocation na nagbibigay ng *ibang* awtoridad na account.

```tsx
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { Initialization } from "../target/types/initialization"

describe("initialization", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Initialization as Program<Initialization>

  const wallet = anchor.workspace.Initialization.provider.wallet
  const walletTwo = anchor.web3.Keypair.generate()

  const userInsecure = anchor.web3.Keypair.generate()
  const userRecommended = anchor.web3.Keypair.generate()

  before(async () => {
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: userInsecure.publicKey,
        space: 32,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(
          32
        ),
        programId: program.programId,
      })
    )

    await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
      wallet.payer,
      userInsecure,
    ])

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        walletTwo.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    )
  })

  it("Insecure init", async () => {
    await program.methods
      .insecureInitialization()
      .accounts({
        user: userInsecure.publicKey,
      })
      .rpc()
  })

  it("Re-invoke insecure init with different auth", async () => {
    const tx = await program.methods
      .insecureInitialization()
      .accounts({
        user: userInsecure.publicKey,
        authority: walletTwo.publicKey,
      })
      .transaction()
    await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
      walletTwo,
    ])
  })
})
```

Patakbuhin ang `anchor test` upang makita na ang parehong mga transaksyon ay matagumpay na makukumpleto.

```bash
initialization
  ✔ Insecure init (478ms)
  ✔ Re-invoke insecure init with different auth (464ms)
```

### 3. Add `recommended_initialization` instruction

Gumawa tayo ng bagong tagubilin na tinatawag na `recommended_initialization` na nag-aayos sa problemang ito. Hindi tulad ng nakaraang hindi secure na pagtuturo, dapat pangasiwaan ng tagubiling ito ang paggawa at pagsisimula ng account ng user gamit ang hadlang na `init` ng Anchor.

Ang paghihigpit na ito ay nagtuturo sa programa na lumikha ng account sa pamamagitan ng isang CPI sa program ng system, kaya hindi na kailangang gawin ang account sa panig ng kliyente. Itinatakda din ng paghihigpit ang discriminator ng account. Ang iyong lohika ng pagtuturo ay maaaring magtakda ng paunang katayuan ng account.

Sa paggawa nito, tinitiyak mo na ang anumang kasunod na invocation ng parehong pagtuturo na may parehong user account ay mabibigo sa halip na i-reset ang paunang katayuan ng account.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization {
    use super::*;
		...
    pub fn recommended_initialization(ctx: Context<Checked>) -> Result<()> {
        ctx.accounts.user.authority = ctx.accounts.authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(init, payer = authority, space = 8+32)]
    user: Account<'info, User>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}
```

### 4. Test `recommended_initialization` instruction

Upang subukan ang tagubiling `recommended_initialization`, gagamit kami ng tagubilin nang dalawang beses tulad ng dati. Sa pagkakataong ito, inaasahan naming mabibigo ang transaksyon kapag sinubukan naming simulan ang parehong account sa pangalawang pagkakataon.

```tsx
describe("initialization", () => {
  ...
  it("Recommended init", async () => {
    await program.methods
      .recommendedInitialization()
      .accounts({
        user: userRecommended.publicKey,
      })
      .signers([userRecommended])
      .rpc()
  })

  it("Re-invoke recommended init with different auth, expect error", async () => {
    try {
      // Add your test here.
      const tx = await program.methods
        .recommendedInitialization()
        .accounts({
          user: userRecommended.publicKey,
          authority: walletTwo.publicKey,
        })
        .transaction()
      await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
        walletTwo,
        userRecommended,
      ])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })
})
```

Patakbuhin ang `anchor test` at upang makita na ang pangalawang transaksyon na sumusubok na simulan ang parehong account nang dalawang beses ay magbabalik na ngayon ng error na nagsasaad na ang address ng account ay ginagamit na.

```bash
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t invoke [1]',
'Program log: Instruction: RecommendedInitialization',
'Program 11111111111111111111111111111111 invoke [2]',
'Allocate: account Address { address: EMvbwzrs4VTR7G1sNUJuQtvRX1EuvLhqs4PFqrtDcCGV, base: None } already in use',
'Program 11111111111111111111111111111111 failed: custom program error: 0x0',
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t consumed 4018 of 200000 compute units',
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t failed: custom program error: 0x0'
```

Kung gagamit ka ng `init` constraint ng Anchor, kadalasan iyon lang ang kailangan mong protektahan laban sa mga pag-atake sa muling pagsisimula! Tandaan, dahil ang pag-aayos para sa mga pagsasamantalang ito sa seguridad ay simple ay hindi nangangahulugan na hindi ito mahalaga. Sa tuwing magpapasimula ka ng isang account, tiyaking ginagamit mo ang hadlang na `init` o may iba pang pag-check sa lugar upang maiwasan ang pag-reset sa paunang katayuan ng kasalukuyang account.

Kung gusto mong tingnan ang panghuling code ng solusyon, mahahanap mo ito sa `solusyon` na sangay ng [imbakang ito](https://github.com/Unboxed-Software/solana-reinitialization-attacks/tree/solution) .

# Challenge

Tulad ng iba pang mga aralin sa modyul na ito, ang iyong pagkakataon na magsanay sa pag-iwas sa pagsasamantala sa seguridad na ito ay nakasalalay sa pag-audit ng iyong sarili o iba pang mga programa.

Maglaan ng ilang oras upang suriin ang hindi bababa sa isang programa at tiyaking maayos na pinoprotektahan ang mga tagubilin laban sa mga pag-atake sa muling pagsisimula.

Tandaan, kung makakita ka ng bug o pagsasamantala sa programa ng ibang tao, mangyaring alertuhan sila! Kung makakita ka ng isa sa iyong sariling programa, siguraduhing i-patch ito kaagad.
---
title: Type Cosplay
objectives:
- Ipaliwanag ang mga panganib sa seguridad na nauugnay sa hindi pagsuri sa mga uri ng account
- Magpatupad ng discriminator ng uri ng account gamit ang long-form na Rust
- Gamitin ang `init` constraint ng Anchor upang simulan ang mga account
- Gamitin ang uri ng `Account` ng Anchor para sa pagpapatunay ng account
---

# TL;DR

- Gumamit ng mga discriminator upang makilala ang iba't ibang uri ng account
- Upang magpatupad ng discriminator sa Rust, magsama ng field sa struct ng account upang kumatawan sa uri ng account

    ```rust
    #[derive(BorshSerialize, BorshDeserialize)]
    pub struct User {
        discriminant: AccountDiscriminant,
        user: Pubkey,
    }

    #[derive(BorshSerialize, BorshDeserialize, PartialEq)]
    pub enum AccountDiscriminant {
        User,
        Admin,
    }
    ```

- Para magpatupad ng discriminator check sa Rust, i-verify na ang discriminator ng deserialized na data ng account ay tumutugma sa inaasahang halaga

    ```rust
    if user.discriminant != AccountDiscriminant::User {
        return Err(ProgramError::InvalidAccountData.into());
    }
    ```

- Sa Anchor, awtomatikong ipinapatupad ng mga uri ng program account ang katangiang `Discriminator` na lumilikha ng 8 byte na natatanging identifier para sa isang uri
- Gamitin ang uri ng `Account<'info, T>` ng Anchor upang awtomatikong suriin ang discriminator ng account kapag deserialize ang data ng account

# Lesson

Ang "Type cosplay" ay tumutukoy sa isang hindi inaasahang uri ng account na ginagamit sa halip na isang inaasahang uri ng account. Sa ilalim ng hood, ang data ng account ay iniimbak lamang bilang isang hanay ng mga byte na na-deserialize ng isang programa sa isang custom na uri ng account. Nang hindi nagpapatupad ng paraan upang tahasang makilala ang mga uri ng account, ang data ng account mula sa hindi inaasahang account ay maaaring magresulta sa paggamit ng pagtuturo sa mga hindi sinasadyang paraan.

### Unchecked account

Sa halimbawa sa ibaba, ang mga uri ng account na `AdminConfig` at `UserConfig` ay nag-iimbak ng isang pampublikong key. Ang tagubiling `admin_instruction` ay nagde-deserialize sa `admin_config` na account bilang isang uri ng `AdminConfig` at pagkatapos ay nagsasagawa ng pagsusuri ng may-ari at pagsusuri ng data validation.

Gayunpaman, ang mga uri ng account na `AdminConfig` at `UserConfig` ay may parehong istraktura ng data. Nangangahulugan ito na maaaring maipasa ang uri ng account ng `UserConfig` bilang `admin_config` na account. Hangga't ang pampublikong key na naka-imbak sa data ng account ay tumutugma sa pag-sign ng `admin` sa transaksyon, patuloy na mapoproseso ang tagubiling `admin_instruction`, kahit na ang pumirma ay hindi talaga isang admin.

Tandaan na ang mga pangalan ng mga field na nakaimbak sa mga uri ng account (`admin` at `user`) ay walang pagkakaiba kapag nagde-deserialize ng data ng account. Ang data ay serialized at deserialized batay sa pagkakasunud-sunod ng mga field kaysa sa kanilang mga pangalan.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_insecure {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        let account_data =
            AdminConfig::try_from_slice(&ctx.accounts.admin_config.data.borrow()).unwrap();
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IllegalOwner.into());
        }
        if account_data.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidAccountData.into());
        }
        msg!("Admin {}", account_data.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    admin_config: UncheckedAccount<'info>,
    admin: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct UserConfig {
    user: Pubkey,
}
```

### Add account discriminator

Upang malutas ito, maaari kang magdagdag ng field ng discriminant para sa bawat uri ng account at itakda ang discriminant kapag nagpasimula ng account.

Ina-update ng halimbawa sa ibaba ang mga uri ng account na `AdminConfig` at `UserConfig` na may field na `discriminant`. Kasama sa tagubiling `admin_instruction` ang karagdagang pagsusuri sa validation ng data para sa field na `discriminant`.

```rust
if account_data.discriminant != AccountDiscriminant::Admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

Kung ang field na `discriminant` ng account ay naipasa sa pagtuturo bilang ang `admin_config` na account ay hindi tumutugma sa inaasahang `AccountDiscriminant`, kung gayon ang transaksyon ay mabibigo. Siguraduhin lang na itakda ang naaangkop na halaga para sa `discriminant` kapag sinimulan mo ang bawat account (hindi ipinapakita sa halimbawa), at pagkatapos ay maaari mong isama ang mga discriminant check na ito sa bawat kasunod na pagtuturo.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_secure {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        let account_data =
            AdminConfig::try_from_slice(&ctx.accounts.admin_config.data.borrow()).unwrap();
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IllegalOwner.into());
        }
        if account_data.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidAccountData.into());
        }
        if account_data.discriminant != AccountDiscriminant::Admin {
            return Err(ProgramError::InvalidAccountData.into());
        }
        msg!("Admin {}", account_data.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    admin_config: UncheckedAccount<'info>,
    admin: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    discriminant: AccountDiscriminant,
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct UserConfig {
    discriminant: AccountDiscriminant,
    user: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize, PartialEq)]
pub enum AccountDiscriminant {
    Admin,
    User,
}
```

### Use Anchor’s `Account` wrapper

Ang pagpapatupad ng mga pagsusuring ito para sa bawat account na kailangan para sa bawat pagtuturo ay maaaring nakakapagod. Sa kabutihang palad, ang Anchor ay nagbibigay ng `#[account]` attribute macro para sa awtomatikong pagpapatupad ng mga katangiang dapat taglayin ng bawat account.

Ang mga istrukturang minarkahan ng `#[account]` ay maaaring gamitin sa `Account` upang patunayan na ang naipasa sa account ay talagang ang uri na inaasahan mo. Kapag sinisimulan ang isang account na ang representasyon ng istruktura ay may katangiang `#[account]`, ang unang 8 byte ay awtomatikong nakalaan para sa isang discriminator na natatangi sa uri ng account. Kapag deserialize ang data ng account, awtomatikong susuriin ng Anchor kung ang discriminator sa account ay tumutugma sa inaasahang uri ng account at throw and error kung hindi ito tumugma.

Sa halimbawa sa ibaba, ang `Account<'info, AdminConfig>` ay tumutukoy na ang `admin_config` na account ay dapat na nasa uri ng `AdminConfig`. Awtomatikong tinitingnan ng Anchor na ang unang 8 byte ng data ng account ay tumutugma sa discriminator ng uri ng `AdminConfig`.

Ang pagsusuri sa pagpapatunay ng data para sa field na `admin` ay inilipat din mula sa lohika ng pagtuturo patungo sa struct ng pagpapatunay ng account gamit ang hadlang na `may_isa`. Tinutukoy ng `#[account(has_one = admin)]` na dapat tumugma ang field ng `admin` ng `admin_config` account sa `admin` account na ipinasa sa pagtuturo. Tandaan na para gumana ang `has_one` na hadlang, ang pagpapangalan ng account sa struct ay dapat tumugma sa pagpapangalan ng field sa account na iyong pinapatunayan.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_recommended {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        msg!("Admin {}", ctx.accounts.admin_config.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    #[account(has_one = admin)]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}

#[account]
pub struct UserConfig {
    user: Pubkey,
}
```

Mahalagang tandaan na ito ay isang kahinaan na hindi mo kailangang mag-alala kapag gumagamit ng Anchor - iyon ang buong punto nito sa unang lugar! Matapos suriin kung paano ito mapagsasamantalahan kung hindi mahawakan nang maayos sa isang katutubong programa ng kalawang, sana ay mas naunawaan mo kung ano ang layunin ng discriminator ng account sa isang Anchor account. Ang katotohanang awtomatikong itinatakda at sinusuri ng Anchor ang discriminator na ito ay nangangahulugan na ang mga developer ay maaaring gumugol ng mas maraming oras sa pagtutuon sa kanilang produkto, ngunit napakahalaga pa rin na maunawaan kung ano ang ginagawa ng Anchor sa likod ng mga eksena upang bumuo ng mga mahuhusay na programa ng Solana.

# Demo

Para sa demo na ito, gagawa kami ng dalawang programa upang ipakita ang isang uri ng kahinaan sa cosplay.

- Ang unang programa ay magsisimula ng mga account ng programa nang walang discriminator
- Ang pangalawang programa ay magsisimula ng mga account ng program gamit ang hadlang na `init` ng Anchor na awtomatikong nagtatakda ng discriminator ng account

### 1. Starter

Upang makapagsimula, i-download ang starter code mula sa `starter` branch ng [repository na ito](https://github.com/Unboxed-Software/solana-type-cosplay/tree/starter). Kasama sa starter code ang isang program na may tatlong tagubilin at ilang pagsubok.

Ang tatlong tagubilin ay:

1. `initialize_admin` - nagpapasimula ng admin account at nagtatakda ng awtoridad ng admin ng program
2. `initialize_user` - nagpapakilala ng karaniwang user account
3. `update_admin` - nagbibigay-daan sa kasalukuyang admin na i-update ang awtoridad ng admin ng programa

Tingnan ang tatlong tagubiling ito sa `lib.rs` file. Ang huling tagubilin ay dapat na matatawag lamang ng account na tumutugma sa field ng `admin` sa admin account na sinimulan gamit ang tagubiling `initialize_admin`.

### 2. Test insecure `update_admin` instruction

Gayunpaman, ang parehong mga account ay may parehong mga field at uri ng field:

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    user: Pubkey,
}
```

Dahil dito, posibleng ipasa ang isang `User` na account sa halip na ang `admin` na account sa tagubiling `update_admin`, sa gayon ay nilalampasan ang pangangailangan na ang isa ay maging isang admin upang tawagan ang tagubiling ito.

Tingnan ang `solana-type-cosplay.ts` file sa direktoryo ng `tests`. Naglalaman ito ng ilang pangunahing pag-setup at dalawang pagsubok. Ang isang pagsubok ay nagpapasimula ng isang user account, at ang isa ay humihiling ng `update_admin` at pumasa sa user account sa halip ng isang admin account.

Patakbuhin ang `anchor test` upang makita na ang pag-invoke ng `update_admin` ay matagumpay na makukumpleto.

```bash
  type-cosplay
    ✔ Initialize User Account (233ms)
    ✔ Invoke update admin instruction with user account (487ms)
```

### 3. Create `type-checked` program

Ngayon ay gagawa kami ng bagong program na tinatawag na `type-checked` sa pamamagitan ng pagpapatakbo ng `anchor new type-checked` mula sa root ng kasalukuyang anchor program.

Ngayon sa iyong `programs` folder magkakaroon ka ng dalawang program. Patakbuhin ang `listahan ng mga anchor key` at dapat mong makita ang program ID para sa bagong program. Idagdag ito sa `lib.rs` file ng `type-checked` program at sa `type_checked` program sa `Anchor.toml` file.

Susunod, i-update ang setup ng test file para isama ang bagong program at dalawang bagong keypair para sa mga account na sisimulan namin para sa bagong program.

```tsx
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { TypeCosplay } from "../target/types/type_cosplay"
import { TypeChecked } from "../target/types/type_checked"
import { expect } from "chai"

describe("type-cosplay", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.TypeCosplay as Program<TypeCosplay>
  const programChecked = anchor.workspace.TypeChecked as Program<TypeChecked>

  const userAccount = anchor.web3.Keypair.generate()
  const newAdmin = anchor.web3.Keypair.generate()

  const userAccountChecked = anchor.web3.Keypair.generate()
  const adminAccountChecked = anchor.web3.Keypair.generate()
})
```

### 4. Implement the `type-checked` program

Sa programang `type_checked`, magdagdag ng dalawang tagubilin gamit ang `init` constraint upang simulan ang isang `AdminConfig` account at isang `User` account. Kapag ginagamit ang hadlang na `init` upang simulan ang mga bagong account ng program, awtomatikong itatakda ng Anchor ang unang 8 byte ng data ng account bilang isang natatanging discriminator para sa uri ng account.

Magdaragdag din kami ng tagubiling `update_admin` na nagpapatunay sa `admin_config` account bilang isang uri ng account na `AdminConfig` gamit ang `Account` wrapper ng Anchor. Para sa anumang account na ipinasa bilang `admin_config` account, awtomatikong susuriin ng Anchor na tumutugma ang discriminator ng account sa inaasahang uri ng account.

```rust
use anchor_lang::prelude::*;

declare_id!("FZLRa6vX64QL6Vj2JkqY1Uzyzjgi2PYjCABcDabMo8U7");

#[program]
pub mod type_checked {
    use super::*;

    pub fn initialize_admin(ctx: Context<InitializeAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.admin.key();
        Ok(())
    }

    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        ctx.accounts.user_account.user = ctx.accounts.user.key();
        Ok(())
    }

    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeAdmin<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32
    )]
    pub user_account: Account<'info, User>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        has_one = admin
    )]
    pub admin_config: Account<'info, AdminConfig>,
    pub new_admin: SystemAccount<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}

#[account]
pub struct User {
    user: Pubkey,
}
```

### 5. Test secure `update_admin` instruction

Sa test file, magsisimula kami ng `AdminConfig` account at isang `User` account mula sa `type_checked` program. Pagkatapos ay gagamitin namin ang tagubiling `updateAdmin` nang dalawang beses na ipinapasa sa mga bagong likhang account.

```rust
describe("type-cosplay", () => {
	...

  it("Initialize type checked AdminConfig Account", async () => {
    await programChecked.methods
      .initializeAdmin()
      .accounts({
        adminConfig: adminAccountType.publicKey,
      })
      .signers([adminAccountType])
      .rpc()
  })

  it("Initialize type checked User Account", async () => {
    await programChecked.methods
      .initializeUser()
      .accounts({
        userAccount: userAccountType.publicKey,
        user: provider.wallet.publicKey,
      })
      .signers([userAccountType])
      .rpc()
  })

  it("Invoke update instruction using User Account", async () => {
    try {
      await programChecked.methods
        .updateAdmin()
        .accounts({
          adminConfig: userAccountType.publicKey,
          newAdmin: newAdmin.publicKey,
          admin: provider.wallet.publicKey,
        })
        .rpc()
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })

  it("Invoke update instruction using AdminConfig Account", async () => {
    await programChecked.methods
      .updateAdmin()
      .accounts({
        adminConfig: adminAccountType.publicKey,
        newAdmin: newAdmin.publicKey,
        admin: provider.wallet.publicKey,
      })
      .rpc()
  })
})
```

Patakbuhin ang `anchor test`. Para sa transaksyon kung saan pumasa kami sa uri ng account na `User`, inaasahan namin ang pagtuturo at magbabalik ng Anchor Error para sa account na hindi uri ng `AdminConfig`.

```bash
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 invoke [1]',
'Program log: Instruction: UpdateAdmin',
'Program log: AnchorError caused by account: admin_config. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.',
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 consumed 4765 of 200000 compute units',
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 failed: custom program error: 0xbba'
```

Ang pagsunod sa pinakamahuhusay na kagawian ng Anchor at paggamit ng mga uri ng Anchor ay titiyakin na maiiwasan ng iyong mga programa ang kahinaang ito. Palaging gamitin ang attribute na `#[account]` kapag gumagawa ng mga struct ng account, gamitin ang constraint na `init` kapag nagpapasimula ng mga account, at gamitin ang uri ng `Account` sa mga struct ng pagpapatunay ng iyong account.

Kung gusto mong tingnan ang panghuling code ng solusyon, mahahanap mo ito sa `solution` branch ng [repository](https://github.com/Unboxed-Software/solana-type-cosplay/tree/solution) .

# Challenge

Tulad ng iba pang mga aralin sa modyul na ito, ang iyong pagkakataon na magsanay sa pag-iwas sa pagsasamantala sa seguridad na ito ay nakasalalay sa pag-audit ng iyong sarili o iba pang mga programa.

Maglaan ng ilang oras upang suriin ang hindi bababa sa isang programa at tiyaking may discriminator ang mga uri ng account at ang mga iyon ay sinusuri para sa bawat account at pagtuturo. Dahil awtomatikong pinangangasiwaan ng mga karaniwang uri ng Anchor ang pagsusuring ito, mas malamang na makakita ka ng kahinaan sa isang native na programa.

Tandaan, kung makakita ka ng bug o pagsasamantala sa programa ng ibang tao, mangyaring alertuhan sila! Kung makakita ka ng isa sa iyong sariling programa, siguraduhing i-patch ito kaagad.
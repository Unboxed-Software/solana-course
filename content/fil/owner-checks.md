---
title: Owner Checks
objectives:
- Ipaliwanag ang mga panganib sa seguridad na nauugnay sa hindi pagsasagawa ng mga naaangkop na pagsusuri ng may-ari
- Ipatupad ang mga pagsusuri ng may-ari gamit ang long-form na Rust
- Gamitin ang `Account<'info, T>` wrapper ng Anchor at isang uri ng account upang i-automate ang mga pagsusuri ng may-ari
- Gamitin ang hadlang sa `#[account(owner = <expr>)]` ng Anchor upang tahasang tukuyin ang isang panlabas na programa na dapat nagmamay-ari ng isang account
---

# TL;DR

- Gamitin ang **Mga Pagsusuri ng May-ari** upang i-verify na ang mga account ay pagmamay-ari ng inaasahang programa. Kung walang naaangkop na mga pagsusuri ng may-ari, ang mga account na pagmamay-ari ng mga hindi inaasahang programa ay maaaring gamitin sa isang pagtuturo.
- Upang ipatupad ang pagsusuri ng may-ari sa Rust, tingnan lang kung tumutugma ang may-ari ng account sa inaasahang program ID

```rust
if ctx.accounts.account.owner != ctx.program_id {
    return Err(ProgramError::IncorrectProgramId.into());
}
```

- Ang mga uri ng account ng anchor program ay nagpapatupad ng katangiang `May-ari` na nagbibigay-daan sa wrapper ng `Account<'info, T>` na awtomatikong i-verify ang pagmamay-ari ng programa
- Binibigyan ka ng Anchor ng opsyon na tahasang tukuyin ang may-ari ng isang account kung ito ay dapat na anuman maliban sa kasalukuyang nagsasagawa ng programa

# Lesson

Ang mga tseke ng may-ari ay ginagamit upang i-verify na ang isang account na ipinasa sa isang pagtuturo ay pagmamay-ari ng isang inaasahang programa. Pinipigilan nito ang mga account na pagmamay-ari ng isang hindi inaasahang programa na magamit sa isang pagtuturo.

Bilang isang refresher, ang `AccountInfo` struct ay naglalaman ng mga sumusunod na field. Ang pagsusuri ng may-ari ay tumutukoy sa pagsuri na ang field ng `may-ari` sa `AccountInfo` ay tumutugma sa inaasahang program ID.

```jsx
/// Account information
#[derive(Clone)]
pub struct AccountInfo<'a> {
    /// Public key of the account
    pub key: &'a Pubkey,
    /// Was the transaction signed by this account's public key?
    pub is_signer: bool,
    /// Is the account writable?
    pub is_writable: bool,
    /// The lamports in the account.  Modifiable by programs.
    pub lamports: Rc<RefCell<&'a mut u64>>,
    /// The data held in this account.  Modifiable by programs.
    pub data: Rc<RefCell<&'a mut [u8]>>,
    /// Program that owns this account
    pub owner: &'a Pubkey,
    /// This account's data contains a loaded program (and is now read-only)
    pub executable: bool,
    /// The epoch at which this account will next owe rent
    pub rent_epoch: Epoch,
}
```

### Missing owner check

Ang halimbawa sa ibaba ay nagpapakita ng `admin_instruction` na nilalayong ma-access lamang ng isang `admin` account na naka-store sa isang `admin_config` account.

Bagama't sinusuri ng tagubilin ang `admin` account na nilagdaan ang transaksyon at tumutugma sa field ng `admin` na nakaimbak sa `admin_config` account, walang pagsusuri ng may-ari upang i-verify na ang `admin_config` na account na ipinasa sa pagtuturo ay pagmamay-ari ng nagpapatupad na programa.

Dahil ang `admin_config` ay hindi naka-check tulad ng ipinahiwatig ng uri ng `AccountInfo`, maaaring gumamit ng pekeng `admin_config` na account na pag-aari ng ibang program sa `admin_instruction`. Nangangahulugan ito na ang isang attacker ay maaaring lumikha ng isang program na may `admin_config` na ang data structure ay tumutugma sa `admin_config` ng iyong program, itakda ang kanilang public key bilang `admin` at ipasa ang kanilang `admin_config` account sa iyong program. Ito ay hahayaan silang madaya ang iyong programa sa pag-iisip na sila ang awtorisadong admin para sa iyong programa.

Ang pinasimpleng halimbawang ito ay nagpi-print lamang ng `admin` sa mga log ng programa. Gayunpaman, maaari mong isipin kung paano pinapayagan ng isang nawawalang pagsusuri ng may-ari ang mga pekeng account na pagsamantalahan ang isang tagubilin.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
	...

    pub fn admin_instruction(ctx: Context<Unchecked>) -> Result<()> {
        let account_data = ctx.accounts.admin_config.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = AdminConfig::try_deserialize(&mut account_data_slice)?;

        if account_state.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidArgument.into());
        }
        msg!("Admin: {}", account_state.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    admin_config: AccountInfo<'info>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Add owner check

Sa vanilla Rust, maaari mong lutasin ang problemang ito sa pamamagitan ng paghahambing ng field ng `may-ari` sa account sa ID ng programa. Kung hindi sila tumugma, magbabalik ka ng error na `IncorrectProgramId`.

```rust
if ctx.accounts.admin_config.owner != ctx.program_id {
    return Err(ProgramError::IncorrectProgramId.into());
}
```

Ang pagdaragdag ng pagsusuri ng may-ari ay pumipigil sa mga account na pagmamay-ari ng isang hindi inaasahang programa na maipasa bilang `admin_config` na account. Kung ginamit ang pekeng `admin_config` account sa `admin_instruction`, mabibigo ang transaksyon.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
    ...
    pub fn admin_instruction(ctx: Context<Unchecked>) -> Result<()> {
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IncorrectProgramId.into());
        }

        let account_data = ctx.accounts.admin_config.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = AdminConfig::try_deserialize(&mut account_data_slice)?;

        if account_state.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidArgument.into());
        }
        msg!("Admin: {}", account_state.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    admin_config: AccountInfo<'info>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Use Anchor’s `Account<'info, T>`

Magagawa ito ng Anchor na mas simple gamit ang uri ng `Account`.

Ang `Account<'info, T>` ay isang wrapper sa paligid ng `AccountInfo` na nagbe-verify ng pagmamay-ari ng program at nagde-deserialize ng pinagbabatayan na data sa tinukoy na uri ng account na `T`. Ito naman ay nagbibigay-daan sa iyong gamitin ang `Account<'info, T>` upang madaling mapatunayan ang pagmamay-ari.

Para sa konteksto, ang attribute na `#[account]` ay nagpapatupad ng iba't ibang katangian para sa isang istraktura ng data na kumakatawan sa isang account. Ang isa sa mga ito ay ang katangian ng `May-ari` na tumutukoy sa isang address na inaasahang pagmamay-ari ng isang account. Ang may-ari ay nakatakda bilang program ID na tinukoy sa `declare_id!` na macro.

Sa halimbawa sa ibaba, ang `Account<'info, AdminConfig>` ay ginagamit upang patunayan ang `admin_config`. Awtomatiko nitong gagawin ang pagsusuri ng may-ari at i-deserialize ang data ng account. Bukod pa rito, ginagamit ang hadlang na `may_isa` upang tingnan kung tumutugma ang `admin` na account sa field ng `admin` na nakaimbak sa account na `admin_config`.

Sa ganitong paraan, hindi mo kailangang kalat ang iyong lohika ng pagtuturo sa mga pagsusuri ng may-ari.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
	...
    pub fn admin_instruction(ctx: Context<Checked>) -> Result<()> {
        msg!("Admin: {}", ctx.accounts.admin_config.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(
        has_one = admin,
    )]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Use Anchor’s `#[account(owner = <expr>)]` constraint

Bilang karagdagan sa uri ng `Account`, maaari kang gumamit ng hadlang na `may-ari`. Binibigyang-daan ka ng hadlang na `may-ari` na tukuyin ang program na dapat nagmamay-ari ng isang account kung iba ito sa kasalukuyang pinapatupad. Magagamit ito kung, halimbawa, sumusulat ka ng isang tagubilin na umaasa na ang isang account ay isang PDA na nagmula sa ibang programa. Maaari mong gamitin ang mga hadlang sa `seeds` at `bump` at tukuyin ang `may-ari` para makuha at ma-verify nang maayos ang address ng account na ipinasa.

Para magamit ang hadlang sa `may-ari`, kailangan mong magkaroon ng access sa pampublikong key ng program na inaasahan mong pagmamay-ari ng isang account. Maaari mong ipasa ang programa bilang karagdagang account o i-hard-code ang pampublikong key sa isang lugar sa iyong programa.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
    ...
    pub fn admin_instruction(ctx: Context<Checked>) -> Result<()> {
        msg!("Admin: {}", ctx.accounts.admin_config.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(
        has_one = admin,
    )]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
    #[account(
            seeds = b"test-seed",
            bump,
            owner = token_program.key()
    )]
    pda_derived_from_another_program: AccountInfo<'info>,
    token_program: Program<'info, Token>
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

# Demo

Sa demo na ito, gagamit kami ng dalawang programa upang ipakita kung paano maaaring payagan ng isang nawawalang pagsusuri ng may-ari ang isang pekeng account na maubos ang mga token mula sa isang pinasimpleng token na "vault" na account (tandaan na ito ay halos kapareho sa demo mula sa aralin sa Pagpapahintulot ng Tagapagpirma).

Upang makatulong na mailarawan ito, ang isang programa ay mawawalan ng pagsusuri ng may-ari ng account sa vault account kung saan ito nag-withdraw ng mga token.

Ang pangalawang program ay magiging direktang clone ng unang program na ginawa ng isang malisyosong user para gumawa ng account na kapareho ng vault account ng unang program.

Kung walang pagsusuri ng may-ari, makakapasa ang malisyosong user na ito sa vault account na pagmamay-ari ng kanilang "pekeng" na programa at mapapatupad pa rin ang orihinal na programa.

### 1. Starter

Para makapagsimula, i-download ang starter code mula sa `starter` branch ng [repository na ito](https://github.com/Unboxed-Software/solana-owner-checks/tree/starter). Kasama sa starter code ang dalawang program na `clone` at `owner_check` at ang boilerplate setup para sa test file.

Kasama sa programang `owner_check` ang dalawang tagubilin:

- Ang `initialize_vault` ay nagpapasimula ng isang pinasimpleng vault account na nag-iimbak ng mga address ng isang token account at isang account ng awtoridad
- Ang `insecure_withdraw` ay nag-withdraw ng mga token mula sa token account, ngunit nawawala ang may-ari ng check para sa vault account

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB");

#[program]
pub mod owner_check {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        Ok(())
    }

    pub fn insecure_withdraw(ctx: Context<InsecureWithdraw>) -> Result<()> {
        let account_data = ctx.accounts.vault.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = Vault::try_deserialize(&mut account_data_slice)?;

        if account_state.authority != ctx.accounts.authority.key() {
            return Err(ProgramError::InvalidArgument.into());
        }

        let amount = ctx.accounts.token_account.amount;

        let seeds = &[
            b"token".as_ref(),
            &[*ctx.bumps.get("token_account").unwrap()],
        ];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.token_account.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = token_account,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InsecureWithdraw<'info> {
    /// CHECK:
    pub vault: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

Ang programang `clone` ay may kasamang isang pagtuturo:

- Nagsisimula ang `initialize_vault` ng isang “vault” account na ginagaya ang vault account ng programang `owner_check`. Iniimbak nito ang address ng token account ng totoong vault, ngunit pinapayagan ang malisyosong user na maglagay ng sarili nilang account ng awtoridad.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

declare_id!("DUN7nniuatsMC7ReCh5eJRQExnutppN1tAfjfXFmGDq3");

#[program]
pub mod clone {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32,
    )]
    pub vault: Account<'info, Vault>,
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### 2. Test `insecure_withdraw` instruction

Ang test file ay may kasamang pagsubok para gamitin ang `initialize_vault` na pagtuturo sa `owner_check` program gamit ang provider wallet bilang `authority` at pagkatapos ay mag-mint ng 100 token sa token account.

Kasama rin sa test file ang isang pagsubok para gamitin ang `initialize_vault` na pagtuturo sa `clone` na program para magsimula ng pekeng `vault` account na nag-iimbak ng parehong `tokenPDA` account, ngunit ibang `authority`. Tandaan na walang mga bagong token ang nai-mint dito.

Magdagdag tayo ng pagsubok para gamitin ang tagubiling `insecure_withdraw`. Ang pagsusulit na ito ay dapat pumasa sa cloned vault at sa pekeng awtoridad. Dahil walang pagsusuri ng may-ari upang i-verify na ang `vaultClone` na account ay pagmamay-ari ng programang `owner_check`, ang pagsusuri sa validation ng data ng tagubilin ay papasa at ipapakita ang `walletFake` bilang isang wastong awtoridad. Ang mga token mula sa `tokenPDA` account ay ibabalik sa `withdrawDestinationFake` account.

```tsx
describe("owner-check", () => {
	...
    it("Insecure withdraw", async () => {
    const tx = await program.methods
        .insecureWithdraw()
        .accounts({
            vault: vaultClone.publicKey,
            tokenAccount: tokenPDA,
            withdrawDestination: withdrawDestinationFake,
            authority: walletFake.publicKey,
        })
        .transaction()

        await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])

        const balance = await connection.getTokenAccountBalance(tokenPDA)
        expect(balance.value.uiAmount).to.eq(0)
    })

})
```

Run `anchor test` to see that the `insecure_withdraw` completes successfully.

```bash
owner-check
  ✔ Initialize Vault (808ms)
  ✔ Initialize Fake Vault (404ms)
  ✔ Insecure withdraw (409ms)
```

Tandaan na matagumpay na nagde-deserialize ang `vaultClone` kahit na awtomatikong sinisimulan ng Anchor ang mga bagong account na may natatanging 8 byte na discriminator at sinusuri ang discriminator kapag nagde-deserialize ng account. Ito ay dahil ang discriminator ay isang hash ng pangalan ng uri ng account.

```rust
#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

Dahil ang parehong mga programa ay nagpapasimula ng magkaparehong mga account at ang parehong mga istruktura ay pinangalanang `Vault`, ang mga account ay may parehong discriminator kahit na sila ay pag-aari ng magkaibang mga programa.

### 3. Add `secure_withdraw` instruction

Isara natin ang butas ng seguridad na ito.

Sa `lib.rs` file ng `owner_check` program magdagdag ng `secure_withdraw` na pagtuturo at isang `SecureWithdraw` account struct.

Sa `SecureWithdraw` struct, gamitin natin ang `Account<'info, Vault>` para matiyak na may ginagawang pagsusuri ng may-ari sa `vault` account. Gagamitin din namin ang hadlang na `may_isa` upang tingnan kung ang `token_account` at `awtoridad` ay naipasa sa pagtuturo ay tumutugma sa mga halagang nakaimbak sa `vault` account.

```rust
#[program]
pub mod owner_check {
    use super::*;
	...

	pub fn secure_withdraw(ctx: Context<SecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[
            b"token".as_ref(),
            &[*ctx.bumps.get("token_account").unwrap()],
        ];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.token_account.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}
...

#[derive(Accounts)]
pub struct SecureWithdraw<'info> {
    #[account(
       has_one = token_account,
       has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}
```

### 4. Test `secure_withdraw` instruction

Upang subukan ang tagubiling `secure_withdraw`, gagamitin namin ang tagubilin nang dalawang beses. Una, gagamitin namin ang pagtuturo gamit ang `vaultClone` account, na inaasahan naming mabibigo. Pagkatapos, gagamitin namin ang tagubilin gamit ang tamang `vault` na account upang matiyak na gumagana ang pagtuturo ayon sa nilalayon.

```tsx
describe("owner-check", () => {
	...
	it("Secure withdraw, expect error", async () => {
        try {
            const tx = await program.methods
                .secureWithdraw()
                .accounts({
                    vault: vaultClone.publicKey,
                    tokenAccount: tokenPDA,
                    withdrawDestination: withdrawDestinationFake,
                    authority: walletFake.publicKey,
                })
                .transaction()

            await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])
        } catch (err) {
            expect(err)
            console.log(err)
        }
    })

    it("Secure withdraw", async () => {
        await spl.mintTo(
            connection,
            wallet.payer,
            mint,
            tokenPDA,
            wallet.payer,
            100
        )

        await program.methods
        .secureWithdraw()
        .accounts({
            vault: vault.publicKey,
            tokenAccount: tokenPDA,
            withdrawDestination: withdrawDestination,
            authority: wallet.publicKey,
        })
        .rpc()

        const balance = await connection.getTokenAccountBalance(tokenPDA)
        expect(balance.value.uiAmount).to.eq(0)
    })
})
```

Patakbuhin ang `anchor test` upang makita na ang transaksyon gamit ang `vaultClone` account ay magbabalik na ngayon ng Anchor Error habang matagumpay na nakumpleto ang transaksyon gamit ang `vault` account.

```bash
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB invoke [1]',
'Program log: Instruction: SecureWithdraw',
'Program log: AnchorError caused by account: vault. Error Code: AccountOwnedByWrongProgram. Error Number: 3007. Error Message: The given account is owned by a different program than expected.',
'Program log: Left:',
'Program log: DUN7nniuatsMC7ReCh5eJRQExnutppN1tAfjfXFmGDq3',
'Program log: Right:',
'Program log: HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB',
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB consumed 5554 of 200000 compute units',
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB failed: custom program error: 0xbbf'
```

Dito makikita natin kung paano mapasimple ng paggamit ng uri ng `Account<'info, T>` ng Anchor ang proseso ng pagpapatunay ng account upang i-automate ang pagsusuri sa pagmamay-ari. Bukod pa rito, tandaan na maaaring tukuyin ng Anchor Errors ang account na nagdudulot ng error (hal. ang ikatlong linya ng mga log sa itaas ay nagsasabing `AnchorError na dulot ng account: vault`). Maaari itong maging kapaki-pakinabang kapag nagde-debug.

```bash
✔ Secure withdraw, expect error (78ms)
✔ Secure withdraw (10063ms)
```

Iyon lang ang kailangan mo para matiyak na suriin mo ang may-ari sa isang account! Tulad ng ilang iba pang pagsasamantala, medyo simple itong iwasan ngunit napakahalaga. Tiyaking palaging pag-isipan kung aling mga account ang dapat pagmamay-ari ng kung aling mga programa at tiyaking magdaragdag ka ng naaangkop na pagpapatunay.

Kung gusto mong tingnan ang panghuling code ng solusyon, mahahanap mo ito sa `solution` branch ng [repository](https://github.com/Unboxed-Software/solana-owner-checks/tree/solution) .

# Challenge

Tulad ng iba pang mga aralin sa modyul na ito, ang iyong pagkakataon na magsanay sa pag-iwas sa pagsasamantala sa seguridad na ito ay nakasalalay sa pag-audit ng iyong sarili o iba pang mga programa.

Maglaan ng ilang oras upang suriin ang hindi bababa sa isang programa at tiyaking isinasagawa ang wastong pagsusuri ng may-ari sa mga account na ipinasa sa bawat tagubilin.

Tandaan, kung makakita ka ng bug o pagsasamantala sa programa ng ibang tao, mangyaring alertuhan sila! Kung makakita ka ng isa sa iyong sariling programa, siguraduhing i-patch ito kaagad.

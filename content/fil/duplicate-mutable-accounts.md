---
title: Duplicate Mutable Accounts
objectives:
- Ipaliwanag ang mga panganib sa seguridad na nauugnay sa mga tagubilin na nangangailangan ng dalawang nababagong account ng parehong uri at kung paano maiiwasan ang mga ito
- Magpatupad ng tseke para sa mga duplicate na nababagong account gamit ang long-form na Rust
- Magpatupad ng tseke para sa mga duplicate na nababagong account gamit ang Anchor constraints
---

# TL;DR

- Kapag ang isang pagtuturo ay nangangailangan ng dalawang nababagong account ng parehong uri, ang isang attacker ay maaaring pumasa sa parehong account nang dalawang beses, na nagiging sanhi ng account na ma-mutate sa hindi sinasadyang mga paraan.
- Upang tingnan ang mga duplicate na mutable na account sa Rust, ihambing lang ang mga pampublikong key ng dalawang account at maglagay ng error kung pareho ang mga ito.

  ```rust
  if ctx.accounts.account_one.key() == ctx.accounts.account_two.key() {
      return Err(ProgramError::InvalidArgument)
  }
  ```

- Sa Anchor, maaari mong gamitin ang `constraint` upang magdagdag ng isang tahasang pagpilit sa isang account upang suriin na hindi ito katulad ng isa pang account.

# Lesson

Ang mga Duplicate na Mutable na Account ay tumutukoy sa isang tagubilin na nangangailangan ng dalawang nababagong account ng parehong uri. Kapag nangyari ito, dapat mong patunayan na ang dalawang account ay magkaiba upang maiwasan ang parehong account na maipasa sa pagtuturo nang dalawang beses.

Dahil itinuring ng programa ang bawat account bilang hiwalay, ang pagpasa sa parehong account nang dalawang beses ay maaaring magresulta sa pag-mutate sa pangalawang account sa mga hindi sinasadyang paraan. Ito ay maaaring magresulta sa napakaliit na isyu, o mga sakuna - ito ay talagang depende sa kung anong data ang binago ng code at kung paano ginagamit ang mga account na ito. Anuman, ito ay isang kahinaan na dapat malaman ng lahat ng mga developer.

### No check

Halimbawa, isipin ang isang program na nag-a-update ng field ng `data` para sa `user_a` at `user_b` sa isang pagtuturo. Ang value na itinakda ng tagubilin para sa `user_a` ay iba sa `user_b`. Nang hindi nabe-verify na magkaiba ang `user_a` at `user_b`, ia-update ng program ang field ng `data` sa `user_a` account, pagkatapos ay ia-update ang field ng `data` sa pangalawang pagkakataon na may ibang value sa ilalim ng pagpapalagay na `user_b` ay isang hiwalay na account.

Makikita mo ang halimbawang ito sa code sa ibaba. Walang tseke upang i-verify na ang `user_a` at `user_b` ay hindi magkaparehong account. Ang pagpasa sa parehong account para sa `user_a` at `user_b` ay magreresulta sa field ng `data` para sa account na itatakda sa `b` kahit na ang layunin ay itakda ang parehong mga value na `a` at `b` sa magkahiwalay na account. Depende sa kung ano ang kinakatawan ng `data`, ito ay maaaring isang maliit na hindi sinasadyang side-effect, o maaari itong mangahulugan ng isang matinding panganib sa seguridad. ang pagpapahintulot sa `user_a` at `user_b` na maging iisang account ay maaaring magresulta sa

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_insecure {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

### Add check in instruction

Para ayusin ang problemang ito sa plan Rust, magdagdag lang ng check sa instruction logic para ma-verify na ang public key ng `user_a` ay hindi pareho sa public key ng `user_b`, na nagbabalik ng error kung pareho sila.

```rust
if ctx.accounts.user_a.key() == ctx.accounts.user_b.key() {
    return Err(ProgramError::InvalidArgument)
}
```

Tinitiyak ng pagsusuring ito na ang `user_a` at `user_b` ay hindi magkaparehong account.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_secure {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        if ctx.accounts.user_a.key() == ctx.accounts.user_b.key() {
            return Err(ProgramError::InvalidArgument.into())
        }
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

### Use Anchor `constraint`

Ang isang mas mahusay na solusyon kung gumagamit ka ng Anchor ay idagdag ang tseke sa struct ng pagpapatunay ng account sa halip na ang lohika ng pagtuturo.

Maaari mong gamitin ang `#[account(..)]` attribute macro at ang `constraint` na keyword upang magdagdag ng manual na pagpilit sa isang account. Susuriin ng keyword na `constraint` kung ang expression na kasunod ay nagsusuri sa true o false, na nagbabalik ng error kung ang expression ay nage-evaluate sa false.

Ang halimbawa sa ibaba ay naglilipat ng tseke mula sa lohika ng pagtuturo patungo sa struct ng pagpapatunay ng account sa pamamagitan ng pagdaragdag ng `constraint` sa `#[account(..)]` attribute.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_recommended {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(constraint = user_a.key() != user_b.key())]
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

# Demo

Magsanay tayo sa pamamagitan ng paglikha ng isang simpleng programang Rock Paper Scissors upang ipakita kung paano maaaring magdulot ng hindi natukoy na gawi sa loob ng iyong programa ang hindi pagsuri para sa mga duplicate na nababagong account.

Ang program na ito ay magsisimula ng mga account ng "manlalaro" at magkakaroon ng hiwalay na pagtuturo na nangangailangan ng dalawang account ng manlalaro upang kumatawan sa pagsisimula ng isang laro ng gunting na batong papel.

- Isang `initialize` na tagubilin upang simulan ang isang `PlayerState` account
- Isang `rock_paper_scissors_shoot_insecure` na pagtuturo na nangangailangan ng dalawang `PlayerState` na account, ngunit hindi sinisigurado kung magkaiba ang mga account na ipinasa sa pagtuturo
- Isang `rock_paper_scissors_shoot_secure` na pagtuturo na kapareho ng `rock_paper_scissors_shoot_insecure` na pagtuturo ngunit nagdaragdag ng hadlang na tumitiyak na magkaiba ang dalawang account ng manlalaro

### 1. Starter

Para makapagsimula, i-download ang starter code sa `starter` branch ng [repository na ito](https://github.com/unboxed-software/solana-duplicate-mutable-accounts/tree/starter). Kasama sa starter code ang isang program na may dalawang tagubilin at ang setup ng boilerplate para sa test file.

Ang `initialize` na tagubilin ay nagpapasimula ng bagong `PlayerState` account na nag-iimbak ng pampublikong key ng isang player at isang `choice` na field na nakatakda sa `Wala`.

Ang pagtuturo ng `rock_paper_scissors_shoot_insecure` ay nangangailangan ng dalawang `PlayerState` na account at nangangailangan ng pagpipilian mula sa `RockPaperScissors` enum para sa bawat manlalaro, ngunit hindi sinisigurado na ang mga account na ipinasa sa pagtuturo ay iba. Nangangahulugan ito na ang isang account ay maaaring gamitin para sa parehong `PlayerState` na mga account sa pagtuturo.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.new_player.player = ctx.accounts.payer.key();
        ctx.accounts.new_player.choice = None;
        Ok(())
    }

    pub fn rock_paper_scissors_shoot_insecure(
        ctx: Context<RockPaperScissorsInsecure>,
        player_one_choice: RockPaperScissors,
        player_two_choice: RockPaperScissors,
    ) -> Result<()> {
        ctx.accounts.player_one.choice = Some(player_one_choice);

        ctx.accounts.player_two.choice = Some(player_two_choice);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 8
    )]
    pub new_player: Account<'info, PlayerState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RockPaperScissorsInsecure<'info> {
    #[account(mut)]
    pub player_one: Account<'info, PlayerState>,
    #[account(mut)]
    pub player_two: Account<'info, PlayerState>,
}

#[account]
pub struct PlayerState {
    player: Pubkey,
    choice: Option<RockPaperScissors>,
}

#[derive(Clone, Copy, BorshDeserialize, BorshSerialize)]
pub enum RockPaperScissors {
    Rock,
    Paper,
    Scissors,
}
```

### 2. Test `rock_paper_scissors_shoot_insecure` instruction

Kasama sa test file ang code para i-invoke ang `initialize` na pagtuturo nang dalawang beses para gumawa ng dalawang player account.

Magdagdag ng pagsubok para gamitin ang `rock_paper_scissors_shoot_insecure` na pagtuturo sa pamamagitan ng pagpasa sa `playerOne.publicKey` para sa parehong `playerOne` at `playerTwo`.

```typescript
describe("duplicate-mutable-accounts", () => {
	...
	it("Invoke insecure instruction", async () => {
        await program.methods
        .rockPaperScissorsShootInsecure({ rock: {} }, { scissors: {} })
        .accounts({
            playerOne: playerOne.publicKey,
            playerTwo: playerOne.publicKey,
        })
        .rpc()

        const p1 = await program.account.playerState.fetch(playerOne.publicKey)
        assert.equal(JSON.stringify(p1.choice), JSON.stringify({ scissors: {} }))
        assert.notEqual(JSON.stringify(p1.choice), JSON.stringify({ rock: {} }))
    })
})
```

Patakbuhin ang `anchor test` upang makita na matagumpay na nakumpleto ang mga transaksyon, kahit na ang parehong account ay ginagamit bilang dalawang account sa pagtuturo. Dahil ang `playerOne` account ay ginagamit bilang parehong manlalaro sa pagtuturo, tandaan na ang `choice` na nakaimbak sa `playerOne` account ay na-overridden din at hindi tama ang itinakda bilang `gunting`.

```bash
duplicate-mutable-accounts
  ✔ Initialized Player One (461ms)
  ✔ Initialized Player Two (404ms)
  ✔ Invoke insecure instruction (406ms)
```

Hindi lamang ang pagpayag sa mga duplicate na account ay hindi gumagawa ng buong kahulugan para sa laro, nagdudulot din ito ng hindi natukoy na gawi. Kung bubuuin pa natin ang program na ito, ang program ay mayroon lamang isang napiling opsyon at samakatuwid ay hindi maaaring ihambing sa pangalawang opsyon. Ang laro ay magtatapos sa isang draw sa bawat oras. Hindi rin malinaw sa isang tao kung bato o gunting ang pipiliin ni `playerOne`, kaya kakaiba ang gawi ng programa.

### 3. Add `rock_paper_scissors_shoot_secure` instruction

Susunod, bumalik sa `lib.rs` at magdagdag ng `rock_paper_scissors_shoot_secure` na pagtuturo na gumagamit ng `#[account(...)]` macro para magdagdag ng karagdagang `constraint` para masuri kung magkaiba ang `player_one` at `player_two` mga account.

```rust
#[program]
pub mod duplicate_mutable_accounts {
    use super::*;
		...
        pub fn rock_paper_scissors_shoot_secure(
            ctx: Context<RockPaperScissorsSecure>,
            player_one_choice: RockPaperScissors,
            player_two_choice: RockPaperScissors,
        ) -> Result<()> {
            ctx.accounts.player_one.choice = Some(player_one_choice);

            ctx.accounts.player_two.choice = Some(player_two_choice);
            Ok(())
        }
}

#[derive(Accounts)]
pub struct RockPaperScissorsSecure<'info> {
    #[account(
        mut,
        constraint = player_one.key() != player_two.key()
    )]
    pub player_one: Account<'info, PlayerState>,
    #[account(mut)]
    pub player_two: Account<'info, PlayerState>,
}
```

### 7. Test `rock_paper_scissors_shoot_secure` instruction

Upang subukan ang tagubiling `rock_paper_scissors_shoot_secure`, gagamitin namin ang tagubilin nang dalawang beses. Una, gagamitin namin ang pagtuturo gamit ang dalawang magkaibang player na account para tingnan kung gumagana ang pagtuturo ayon sa nilalayon. Pagkatapos, gagamitin namin ang pagtuturo gamit ang `playerOne.publicKey` bilang parehong player account, na inaasahan naming mabibigo.

```typescript
describe("duplicate-mutable-accounts", () => {
	...
    it("Invoke secure instruction", async () => {
        await program.methods
        .rockPaperScissorsShootSecure({ rock: {} }, { scissors: {} })
        .accounts({
            playerOne: playerOne.publicKey,
            playerTwo: playerTwo.publicKey,
        })
        .rpc()

        const p1 = await program.account.playerState.fetch(playerOne.publicKey)
        const p2 = await program.account.playerState.fetch(playerTwo.publicKey)
        assert.equal(JSON.stringify(p1.choice), JSON.stringify({ rock: {} }))
        assert.equal(JSON.stringify(p2.choice), JSON.stringify({ scissors: {} }))
    })

    it("Invoke secure instruction - expect error", async () => {
        try {
        await program.methods
            .rockPaperScissorsShootSecure({ rock: {} }, { scissors: {} })
            .accounts({
                playerOne: playerOne.publicKey,
                playerTwo: playerOne.publicKey,
            })
            .rpc()
        } catch (err) {
            expect(err)
            console.log(err)
        }
    })
})
```

Patakbuhin ang `anchor test` upang makita na gumagana ang pagtuturo ayon sa nilalayon at ang paggamit ng `playerOne` account ay dalawang beses na nagbabalik ng inaasahang error.

```bash
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS invoke [1]',
'Program log: Instruction: RockPaperScissorsShootSecure',
'Program log: AnchorError caused by account: player_one. Error Code: ConstraintRaw. Error Number: 2003. Error Message: A raw constraint was violated.',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS consumed 5104 of 200000 compute units',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS failed: custom program error: 0x7d3'
```

Ang simpleng pagpilit lang ang kailangan para isara ang butas na ito. Bagama't medyo gawa-gawa, ang halimbawang ito ay naglalarawan ng kakaibang gawi na maaaring mangyari kung isusulat mo ang iyong programa sa ilalim ng pagpapalagay na ang dalawang magkaparehong uri na account ay magiging magkaibang mga pagkakataon ng isang account ngunit hindi tahasang isulat ang hadlang na iyon sa iyong programa. Palaging isipin ang pag-uugali na iyong inaasahan mula sa programa at kung iyon ay tahasan.

Kung gusto mong tingnan ang code ng panghuling solusyon, mahahanap mo ito sa sangay ng `solusyon` ng [repository](https://github.com/Unboxed-Software/solana-duplicate-mutable-accounts/tree/solution).

# Challenge

Tulad ng iba pang mga aralin sa modyul na ito, ang iyong pagkakataon na magsanay sa pag-iwas sa pagsasamantala sa seguridad na ito ay nakasalalay sa pag-audit ng iyong sarili o iba pang mga programa.

Maglaan ng ilang oras upang suriin ang hindi bababa sa isang programa at tiyaking ang anumang mga tagubilin na may dalawang parehong-type na nababagong account ay maayos na napipigilan upang maiwasan ang mga duplicate.

Tandaan, kung makakita ka ng bug o pagsasamantala sa programa ng ibang tao, mangyaring alertuhan sila! Kung makakita ka ng isa sa iyong sariling programa, siguraduhing i-patch ito kaagad.
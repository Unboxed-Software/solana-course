---
title: Arbitrary CPI
objectives:
- Ipaliwanag ang mga panganib sa seguridad na nauugnay sa paggamit ng CPI sa isang hindi kilalang programa
- Ipakita kung paano pinipigilan ito ng CPI module ng Anchor na mangyari kapag gumagawa ng CPI mula sa isang Anchor program patungo sa isa pa
- Ligtas at ligtas na gumawa ng CPI mula sa isang Anchor program patungo sa isang arbitrary na hindi anchor na programa
---

# TL;DR

- Upang makabuo ng CPI, ang target na programa ay dapat na maipasa sa invoking instruction bilang isang account. Nangangahulugan ito na ang anumang target na programa ay maaaring maipasa sa pagtuturo. Dapat suriin ng iyong programa ang mga hindi tama o hindi inaasahang mga programa.
- Magsagawa ng mga pagsusuri ng programa sa mga katutubong programa sa pamamagitan lamang ng paghahambing ng pampublikong susi ng naipasa na programa sa programang iyong inaasahan.
- Kung ang isang programa ay nakasulat sa Anchor, maaaring mayroon itong pampublikong CPI module. Ginagawa nitong simple at secure ang pag-invoke sa program mula sa isa pang Anchor program. Awtomatikong sinusuri ng Anchor CPI module na ang address ng program na ipinasa ay tumutugma sa address ng program na nakaimbak sa module.

# Lesson

Ang cross program invocation (CPI) ay kapag ang isang programa ay humihiling ng pagtuturo sa isa pang programa. Ang "arbitraryong CPI" ay kapag ang isang programa ay nakabalangkas na mag-isyu ng isang CPI sa anumang programa na ipinasa sa pagtuturo sa halip na umasa na magsagawa ng isang CPI sa isang partikular na programa. Dahil ang mga tumatawag sa pagtuturo ng iyong programa ay maaaring magpasa ng anumang program na gusto nila sa listahan ng mga account ng pagtuturo, ang hindi pag-verify sa address ng isang naipasa na programa ay nagreresulta sa iyong programa na gumaganap ng mga CPI sa mga arbitrary na programa.

Ang kakulangan ng mga pagsusuri sa programa ay lumilikha ng pagkakataon para sa isang malisyosong user na makapasa sa isang programang iba kaysa sa inaasahan, na nagiging sanhi ng orihinal na programa na tumawag ng isang pagtuturo sa misteryosong programang ito. Walang sinasabi kung ano ang maaaring maging kahihinatnan ng CPI na ito. Depende ito sa logic ng program (parehong sa orihinal na programa at sa hindi inaasahang programa), pati na rin kung ano ang iba pang mga account na ipinasa sa orihinal na pagtuturo.

## Missing program checks

Kunin ang sumusunod na programa bilang isang halimbawa. Ang pagtuturo ng `cpi` ay nagpapatawag ng pagtuturo ng `transfer` sa `token_program`, ngunit walang code na nagsusuri kung ang `token_program` account na naipasa sa pagtuturo ay, sa katunayan, ang SPL Token Program.

```rust
use anchor_lang::prelude::*;
use anchor_lang::solana_program;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod arbitrary_cpi_insecure {
    use super::*;

    pub fn cpi(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
        solana_program::program::invoke(
            &spl_token::instruction::transfer(
                ctx.accounts.token_program.key,
                ctx.accounts.source.key,
                ctx.accounts.destination.key,
                ctx.accounts.authority.key,
                &[],
                amount,
            )?,
            &[
                ctx.accounts.source.clone(),
                ctx.accounts.destination.clone(),
                ctx.accounts.authority.clone(),
            ],
        )
    }
}

#[derive(Accounts)]
pub struct Cpi<'info> {
    source: UncheckedAccount<'info>,
    destination: UncheckedAccount<'info>,
    authority: UncheckedAccount<'info>,
    token_program: UncheckedAccount<'info>,
}
```

Madaling tawagan ng isang attacker ang tagubiling ito at ipasa ang isang duplicate na token program na kanilang nilikha at kinokontrol.

## Add program checks

Posibleng ayusin ang kahinaan na ito sa pamamagitan lamang ng pagdaragdag ng ilang linya sa `cpi` na pagtuturo upang suriin kung ang `token programs public key ay yaong sa SPL Token Program o hindi.

```rust
pub fn cpi_secure(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
    if &spl_token::ID != ctx.accounts.token_program.key {
        return Err(ProgramError::IncorrectProgramId);
    }
    solana_program::program::invoke(
        &spl_token::instruction::transfer(
            ctx.accounts.token_program.key,
            ctx.accounts.source.key,
            ctx.accounts.destination.key,
            ctx.accounts.authority.key,
            &[],
            amount,
        )?,
        &[
            ctx.accounts.source.clone(),
            ctx.accounts.destination.clone(),
            ctx.accounts.authority.clone(),
        ],
    )
}
```

Ngayon, kung pumasa ang isang attacker sa ibang token program, ibabalik ng pagtuturo ang error na `ProgramError::IncorrectProgramId`.

Depende sa program na ginagamit mo sa iyong CPI, maaari mong i-hard code ang address ng inaasahang program ID o gamitin ang Rust crate ng program para makuha ang address ng program, kung available. Sa halimbawa sa itaas, ang `spl_token` crate ay nagbibigay ng address ng SPL Token Program.

## Use an Anchor CPI module

Ang isang mas simpleng paraan upang pamahalaan ang mga pagsusuri ng programa ay ang paggamit ng mga module ng Anchor CPI. Natutunan namin sa isang [nakaraang aralin](https://github.com/Unboxed-Software/solana-course/blob/main/content/anchor-cpi.md) na ang Anchor ay maaaring awtomatikong bumuo ng mga CPI module upang gumawa ng mga CPI sa programa mas simple. Pinapahusay din ng mga module na ito ang seguridad sa pamamagitan ng pag-verify sa pampublikong key ng program na ipinasa sa isa sa mga pampublikong tagubilin nito.

Ang bawat Anchor program ay gumagamit ng `declare_id()` na macro upang tukuyin ang address ng program. Kapag nabuo ang isang CPI module para sa isang partikular na programa, ginagamit nito ang address na ipinasa sa macro na ito bilang "pinagmulan ng katotohanan" at awtomatikong ibe-verify na ang lahat ng CPI na ginawa gamit ang CPI module nito ay nagta-target sa program id na ito.

Bagama't sa pangunahing walang pinagkaiba sa mga manu-manong pagsusuri sa programa, ang paggamit ng mga module ng CPI ay nag-iwas sa posibilidad na makalimutang magsagawa ng pagsusuri ng programa o hindi sinasadyang mag-type ng maling program ID kapag ito ay na-hard-coding.

Ang programa sa ibaba ay nagpapakita ng isang halimbawa ng paggamit ng CPI module para sa SPL Token Program upang maisagawa ang paglilipat na ipinakita sa mga nakaraang halimbawa.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod arbitrary_cpi_recommended {
    use super::*;

    pub fn cpi(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
        token::transfer(ctx.accounts.transfer_ctx(), amount)
    }
}

#[derive(Accounts)]
pub struct Cpi<'info> {
    source: Account<'info, TokenAccount>,
    destination: Account<'info, TokenAccount>,
    authority: Signer<'info>,
    token_program: Program<'info, Token>,
}

impl<'info> Cpi<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.source.to_account_info(),
            to: self.destination.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}
```

Tandaan na, tulad ng halimbawa sa itaas, gumawa si Anchor ng ilang [wrappers para sa mga sikat na katutubong programa](https://github.com/coral-xyz/anchor/tree/master/spl/src) na nagbibigay-daan sa iyong mag-isyu ng mga CPI sa sila na parang mga programang Anchor.

Bukod pa rito at depende sa program kung saan ka gumagawa ng CPI, maaari mong gamitin ang [`Program` account type] ng Anchor(https://docs.rs/anchor-lang/latest/anchor_lang/accounts/program/struct .Program.html) upang i-validate ang naipasa na program sa iyong account validation struct. Sa pagitan ng [`anchor_lang`](https://docs.rs/anchor-lang/latest/anchor_lang) at [`anchor_spl`](https://docs.rs/anchor_spl/latest/) crates, ang sumusunod na `Programa ` mga uri ay ibinigay sa labas ng kahon:

- [`System`](https://docs.rs/anchor-lang/latest/anchor_lang/system_program/struct.System.html)
- [`AssociatedToken`](https://docs.rs/anchor-spl/latest/anchor_spl/associated_token/struct.AssociatedToken.html)
- [`Token`](https://docs.rs/anchor-spl/latest/anchor_spl/token/struct.Token.html)

Kung mayroon kang access sa isang CPI module ng Anchor program, karaniwan mong mai-import ang uri ng program nito gamit ang mga sumusunod, na pinapalitan ang pangalan ng program ng pangalan ng aktwal na program:

```rust
use other_program::program::OtherProgram;
```

# Demo

Upang ipakita ang kahalagahan ng pagsuri sa program na ginagamit mo para sa mga CPI, gagana kami sa isang pinasimple at medyo gawa-gawang laro. Ang larong ito ay kumakatawan sa mga character na may mga PDA account, at gumagamit ng hiwalay na "metadata" na programa upang pamahalaan ang metadata ng character at mga katangian tulad ng kalusugan at kapangyarihan.

Bagama't ang halimbawang ito ay medyo gawa-gawa, ito ay talagang halos magkaparehong arkitektura sa kung paano gumagana ang mga NFT sa Solana: ang SPL Token Program ay namamahala sa mga token mints, pamamahagi, at paglilipat, at isang hiwalay na metadata program ang ginagamit upang magtalaga ng metadata sa mga token. Kaya ang kahinaan na pinagdadaanan natin dito ay maaari ding mailapat sa mga tunay na token.

### 1. Setup

Magsisimula tayo sa `starter` na sangay ng [imbakang ito](https://github.com/Unboxed-Software/solana-arbitrary-cpi/tree/starter). I-clone ang repository at pagkatapos ay buksan ito sa `starter` branch.

Pansinin na mayroong tatlong mga programa:

1. `gameplay`
2. `character-metadata`
3. `pekeng-metadata`

Bukod pa rito, mayroon nang pagsubok sa direktoryo ng `mga pagsubok`.

Ang unang program, `gameplay`, ay ang isa na direktang ginagamit ng aming pagsubok. Tingnan ang programa. Mayroon itong dalawang tagubilin:

1. `create_character_insecure` - lumilikha ng bagong character at CPI sa metadata program para i-set up ang mga paunang katangian ng character
2. `battle_insecure` - pinaghahalo ang dalawang karakter laban sa isa't isa, na nagtatalaga ng "panalo" sa karakter na may pinakamataas na katangian

Ang pangalawang programa, ang `character-metadata`, ay nilalayong maging "naaprubahan" na programa para sa paghawak ng metadata ng character. Tingnan ang programang ito. Mayroon itong iisang tagubilin para sa `create_metadata` na gumagawa ng bagong PDA at nagtatalaga ng pseudo-random na value sa pagitan ng 0 at 20 para sa kalusugan at kapangyarihan ng character.

Ang huling program, ang `fake-metadata` ay isang "pekeng" metadata program na nilalayong ilarawan kung ano ang maaaring gawin ng isang attacker para pagsamantalahan ang aming `gameplay` program. Ang program na ito ay halos magkapareho sa `character-metadata` na program, ito lang ang nagtatalaga ng paunang kalusugan at kapangyarihan ng isang character na maging maximum na pinapayagan: 255.

### 2. Test `create_character_insecure` instruction

Mayroon nang pagsubok sa direktoryo ng `mga pagsubok` para dito. Mahaba ito, ngunit maglaan ng isang minuto upang tingnan ito bago natin ito pag-usapan nang magkasama:

```typescript
it("Insecure instructions allow attacker to win every time", async () => {
    // Initialize player one with real metadata program
    await gameplayProgram.methods
      .createCharacterInsecure()
      .accounts({
        metadataProgram: metadataProgram.programId,
        authority: playerOne.publicKey,
      })
      .signers([playerOne])
      .rpc()

    // Initialize attacker with fake metadata program
    await gameplayProgram.methods
      .createCharacterInsecure()
      .accounts({
        metadataProgram: fakeMetadataProgram.programId,
        authority: attacker.publicKey,
      })
      .signers([attacker])
      .rpc()

    // Fetch both player's metadata accounts
    const [playerOneMetadataKey] = getMetadataKey(
      playerOne.publicKey,
      gameplayProgram.programId,
      metadataProgram.programId
    )

    const [attackerMetadataKey] = getMetadataKey(
      attacker.publicKey,
      gameplayProgram.programId,
      fakeMetadataProgram.programId
    )

    const playerOneMetadata = await metadataProgram.account.metadata.fetch(
      playerOneMetadataKey
    )

    const attackerMetadata = await fakeMetadataProgram.account.metadata.fetch(
      attackerMetadataKey
    )

    // The regular player should have health and power between 0 and 20
    expect(playerOneMetadata.health).to.be.lessThan(20)
    expect(playerOneMetadata.power).to.be.lessThan(20)

    // The attacker will have health and power of 255
    expect(attackerMetadata.health).to.equal(255)
    expect(attackerMetadata.power).to.equal(255)
})
```

Ang pagsubok na ito ay dumaan sa senaryo kung saan ang isang regular na manlalaro at isang umaatake ay parehong gumagawa ng kanilang mga karakter. Ang umaatake lang ang pumasa sa program ID ng pekeng metadata program kaysa sa aktwal na metadata program. At dahil ang pagtuturo ng `create_character_insecure` ay walang mga pagsusuri sa programa, nagsasagawa pa rin ito.

Ang resulta ay ang regular na karakter ay may naaangkop na dami ng kalusugan at kapangyarihan: bawat isa ay may halaga sa pagitan ng 0 at 20. Ngunit ang kalusugan at kapangyarihan ng umaatake ay bawat isa ay 255, na ginagawang walang kapantay ang umaatake.

Kung hindi mo pa nagagawa, patakbuhin ang `anchor test` upang makita na ang pagsubok na ito sa katunayan ay kumikilos tulad ng inilarawan.

### 3. Create a `create_character_secure` instruction

Ayusin natin ito sa pamamagitan ng paggawa ng secure na pagtuturo para sa paggawa ng bagong character. Ang tagubiling ito ay dapat magpatupad ng mga wastong pagsusuri ng program at gamitin ang `cpi` crate ng program na `character-metadata` upang gawin ang CPI sa halip na gamitin lamang ang `invoke`.

Kung gusto mong subukan ang iyong mga kasanayan, subukan ito sa iyong sarili bago magpatuloy.

Magsisimula kami sa pamamagitan ng pag-update ng aming `use` statement sa tuktok ng `gameplay` programs `lib.rs` file. Binibigyan namin ang aming sarili ng access sa uri ng programa para sa pagpapatunay ng account, at ang helper function para sa pag-isyu ng `create_metadata` CPI.

```rust
use character_metadata::{
    cpi::accounts::CreateMetadata,
    cpi::create_metadata,
    program::CharacterMetadata,
};
```

Susunod, gumawa tayo ng bagong struct ng pagpapatunay ng account na tinatawag na `CreateCharacterSecure`. Sa pagkakataong ito, gagawin namin ang `metadata_program` na isang uri ng `Program`:

```rust
#[derive(Accounts)]
pub struct CreateCharacterSecure<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 64,
        seeds = [authority.key().as_ref()],
        bump
    )]
    pub character: Account<'info, Character>,
    #[account(
        mut,
        seeds = [character.key().as_ref()],
        seeds::program = metadata_program.key(),
        bump,
    )]
    /// CHECK: manual checks
    pub metadata_account: AccountInfo<'info>,
    pub metadata_program: Program<'info, CharacterMetadata>,
    pub system_program: Program<'info, System>,
}
```

Panghuli, idinaragdag namin ang tagubiling `create_character_secure`. Ito ay magiging katulad ng dati ngunit gagamitin ang buong pagpapagana ng Anchor CPI sa halip na direktang gamitin ang `invoke`:

```rust
pub fn create_character_secure(ctx: Context<CreateCharacterSecure>) -> Result<()> {
    let character = &mut ctx.accounts.character;
    character.metadata = ctx.accounts.metadata_account.key();
    character.auth = ctx.accounts.authority.key();
    character.wins = 0;

    let context = CpiContext::new(
        ctx.accounts.metadata_program.to_account_info(),
        CreateMetadata {
            character: ctx.accounts.character.to_account_info(),
            metadata: ctx.accounts.metadata_account.to_owned(),
            authority: ctx.accounts.authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
    );

    create_metadata(context)?;

    Ok(())
}
```

### 4. Test `create_character_secure`

Ngayong mayroon na tayong ligtas na paraan ng pagsisimula ng bagong karakter, gumawa tayo ng bagong pagsubok. Kailangan lang ng pagsubok na ito na subukang simulan ang karakter ng umaatake at asahan ang isang error na itatapon.

```typescript
it("Secure character creation doesn't allow fake program", async () => {
    try {
      await gameplayProgram.methods
        .createCharacterSecure()
        .accounts({
          metadataProgram: fakeMetadataProgram.programId,
          authority: attacker.publicKey,
        })
        .signers([attacker])
        .rpc()
    } catch (error) {
      expect(error)
      console.log(error)
    }
})
```

Patakbuhin ang `anchor test` kung hindi mo pa nagagawa. Pansinin na nagkaroon ng error gaya ng inaasahan, na nagdedetalye na ang program ID na ipinasa sa pagtuturo ay hindi ang inaasahang program ID:

```bash
'Program log: AnchorError caused by account: metadata_program. Error Code: InvalidProgramId. Error Number: 3008. Error Message: Program ID was not as expected.',
'Program log: Left:',
'Program log: FKBWhshzcQa29cCyaXc1vfkZ5U985gD5YsqfCzJYUBr',
'Program log: Right:',
'Program log: D4hPnYEsAx4u3EQMrKEXsY3MkfLndXbBKTEYTwwm25TE'
```

Iyon lang ang kailangan mong gawin para maprotektahan laban sa mga di-makatwirang CPI!

Maaaring may mga pagkakataon kung saan gusto mo ng higit na kakayahang umangkop sa mga CPI ng iyong programa. Tiyak na hindi ka namin pipigilan sa pag-arkitekto ng program na kailangan mo, ngunit mangyaring gawin ang lahat ng posibleng pag-iingat upang matiyak na walang mga kahinaan sa iyong programa.

Kung gusto mong tingnan ang code ng panghuling solusyon, mahahanap mo ito sa sangay ng `solusyon` ng [parehong repositoryo](https://github.com/Unboxed-Software/solana-arbitrary-cpi/tree/solution ).

# Challenge

Tulad ng iba pang mga aralin sa modyul na ito, ang iyong pagkakataon na magsanay sa pag-iwas sa pagsasamantala sa seguridad na ito ay nakasalalay sa pag-audit ng iyong sarili o iba pang mga programa.

Maglaan ng ilang oras upang suriin ang hindi bababa sa isang programa at tiyakin na ang mga pagsusuri sa programa ay nasa lugar para sa bawat programa na ipinasa sa mga tagubilin, lalo na ang mga na-invoke sa pamamagitan ng CPI.

Tandaan, kung makakita ka ng bug o pagsasamantala sa programa ng ibang tao, mangyaring alertuhan sila! Kung makakita ka ng isa sa iyong sariling programa, siguraduhing i-patch ito kaagad.

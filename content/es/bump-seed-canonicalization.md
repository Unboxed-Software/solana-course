---
título: Bump Seed Canonicalization objetivos
objectives:
- Explicar las vulnerabilidades asociadas con el uso de PDA derivados sin el bache canónico
- Inicializar un PDA usando Anchor 's `seeds` y `bump` restricciones para usar automáticamente el bache canónico
- Use Anchor 's `seeds` y `bump` restricciones para asegurarse de que la protuberancia canónica siempre se use en futuras instrucciones al derivar un PDA
---

# TL;DR

-   La función [** `create_program_address` **](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) deriva un PDA sin buscar el**protuberancia canónica**. Esto significa que hay múltiples baches válidos, todos los cuales producirán diferentes direcciones.
-   El uso de [** `find_program_address` **](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.find_program_address) garantiza que se use el bache válido más alto, o el bache canónico, para la derivación, creando así una forma determinista de encontrar una dirección dadas semillas específicas.
-   Tras la inicialización, puede usar la `bump` restricción `seeds` and de Anchor para asegurarse de que las derivaciones de PDA en la estructura de validación de cuenta siempre usen el bump canónico
-   Anchor le permite **especificar un bache** con la `bump = <some_bump>` restricción al verificar la dirección de un PDA
-   Debido a que `find_program_address` puede ser costoso, la mejor práctica es almacenar el bache derivado en el campo de datos de una cuenta para que se haga referencia más adelante al volver a derivar la dirección para su verificación.

    ```rust
    #[derive(Accounts)]
    pub struct VerifyAddress<'info> {
    	#[account(
        	seeds = [DATA_PDA_SEED.as_bytes()],
    	    bump = data.bump
    	)]
    	data: Account<'info, Data>,
    }
    ```

# Descripción general

Las semillas de bump son un número entre 0 y 255, inclusive, que se utiliza para garantizar que una dirección derivada mediante [ `create_program_address`](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) sea un PDA válido. El **protuberancia canónica** es el valor de protuberancia más alto que produce un PDA válido. El estándar en Solana es _siempre use el bump canónico_ cuando se derivan PDA, tanto por seguridad como por conveniencia.

## Derivación de PDA insegura usando `create_program_address`

Dado un conjunto de semillas, la `create_program_address` función producirá un PDA válido aproximadamente el 50% del tiempo. La semilla de bump es un byte adicional añadido como semilla para "bump" la dirección derivada en territorio válido. Dado que hay 256 semillas de protuberancias posibles y la función produce PDA válidas aproximadamente el 50% del tiempo, hay muchas protuberancias válidas para un conjunto dado de semillas de entrada.

Puede imaginar que esto podría causar confusión para localizar cuentas cuando se usan semillas como una forma de asignar entre piezas de información conocidas a las cuentas. El uso de la protuberancia canónica como estándar garantiza que siempre pueda encontrar la cuenta correcta. Más importante aún, evita las vulnerabilidades de seguridad causadas por la naturaleza abierta de permitir múltiples golpes.

En el siguiente ejemplo, la `set_value` instrucción usa un `bump` que se pasó como datos de instrucción para derivar un PDA. La instrucción entonces deriva el PDA usando la `create_program_address` función y comprueba que `address` coincida con la clave pública de la `data` cuenta.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bump_seed_canonicalization_insecure {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, key: u64, new_value: u64, bump: u8) -> Result<()> {
        let address =
            Pubkey::create_program_address(&[key.to_le_bytes().as_ref(), &[bump]], ctx.program_id).unwrap();
        if address != ctx.accounts.data.key() {
            return Err(ProgramError::InvalidArgument.into());
        }

        ctx.accounts.data.value = new_value;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct BumpSeed<'info> {
    data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
}
```

Mientras que la instrucción deriva el PDA y comprueba la cuenta pasada, lo cual es bueno, permite que la persona que llama pase en un bache arbitrario. Dependiendo del contexto de su programa, esto podría resultar en un comportamiento no deseado o un exploit potencial.

Si el mapeo de semilla estaba destinado a hacer cumplir una relación uno a uno entre PDA y el usuario, por ejemplo, este programa no lo haría cumplir adecuadamente. Un usuario podría llamar al programa varias veces con muchos baches válidos, cada uno produciendo un PDA diferente.

## Derivación recomendada usando `find_program_address`

Una forma simple de evitar este problema es hacer que el programa espere solo el bache canónico y el uso `find_program_address` para derivar el PDA.

El [ `find_program_address`](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.find_program_address)_siempre usa la protuberancia canónica_. Esta función itera a través de la llamada `create_program_address`, comenzando con un bache de 255 y disminuyendo el bache en uno con cada iteración. Tan pronto como se encuentra una dirección válida, la función devuelve tanto la PDA derivada como la protuberancia canónica utilizada para derivarla.

Esto garantiza un mapeo uno a uno entre sus semillas de entrada y la dirección que producen.

```rust
pub fn set_value_secure(
    ctx: Context<BumpSeed>,
    key: u64,
    new_value: u64,
    bump: u8,
) -> Result<()> {
    let (address, expected_bump) =
        Pubkey::find_program_address(&[key.to_le_bytes().as_ref()], ctx.program_id);

    if address != ctx.accounts.data.key() {
        return Err(ProgramError::InvalidArgument.into());
    }
    if expected_bump != bump {
        return Err(ProgramError::InvalidArgument.into());
    }

    ctx.accounts.data.value = new_value;
    Ok(())
}
```

## Utilice las `bump` restricciones `seeds` de Anchor

Anchor proporciona una forma conveniente de derivar PDA en la estructura de validación de cuenta utilizando las `bump` restricciones `seeds` and. Estos incluso se pueden combinar con la `init` restricción de inicializar la cuenta en la dirección prevista. Para proteger el programa de la vulnerabilidad que hemos estado discutiendo a lo largo de esta lección, Anchor ni siquiera le permite inicializar una cuenta en un PDA usando nada más que el bache canónico. En su lugar, utiliza `find_program_address` para derivar el PDA y posteriormente realiza la inicialización.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bump_seed_canonicalization_recommended {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, _key: u64, new_value: u64) -> Result<()> {
        ctx.accounts.data.value = new_value;
        Ok(())
    }
}

// initialize account at PDA
#[derive(Accounts)]
#[instruction(key: u64)]
pub struct BumpSeed<'info> {
  #[account(mut)]
  payer: Signer<'info>,
  #[account(
    init,
    seeds = [key.to_le_bytes().as_ref()],
    // derives the PDA using the canonical bump
    bump,
    payer = payer,
    space = 8 + 8
  )]
  data: Account<'info, Data>,
  system_program: Program<'info, System>
}

#[account]
pub struct Data {
    value: u64,
}
```

Si no está inicializando una cuenta, aún puede validar los PDA con las `bump` restricciones `seeds` y. Esto simplemente vuelve a derivar el PDA y compara la dirección derivada con la dirección de la cuenta pasada.

En este escenario, Anchor le _hace_ permite especificar el bache a utilizar para derivar el PDA con `bump = <some_bump>`. La intención aquí no es que usted use golpes arbitrarios, sino que le permita optimizar su programa. La naturaleza iterativa de lo `find_program_address` hace costoso, por lo que la mejor práctica es almacenar el bache canónico en los datos de la cuenta PDA al inicializar un PDA, lo que le permite hacer referencia al bache almacenado al validar el PDA en instrucciones posteriores.

Cuando especifique la protuberancia a utilizar, Anchor la utilizará `create_program_address` con la protuberancia proporcionada en lugar de `find_program_address`. Este patrón de almacenamiento de la protuberancia en los datos de la cuenta garantiza que su programa siempre utilice la protuberancia canónica sin degradar el rendimiento.

```rust
use anchor_lang::prelude::*;

declare_id!("CVwV9RoebTbmzsGg1uqU1s4a3LvTKseewZKmaNLSxTqc");

#[program]
pub mod bump_seed_canonicalization_recommended {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, _key: u64, new_value: u64) -> Result<()> {
        ctx.accounts.data.value = new_value;
        // store the bump on the account
        ctx.accounts.data.bump = *ctx.bumps.get("data").unwrap();
        Ok(())
    }

    pub fn verify_address(ctx: Context<VerifyAddress>, _key: u64) -> Result<()> {
        msg!("PDA confirmed to be derived with canonical bump: {}", ctx.accounts.data.key());
        Ok(())
    }
}

// initialize account at PDA
#[derive(Accounts)]
#[instruction(key: u64)]
pub struct BumpSeed<'info> {
  #[account(mut)]
  payer: Signer<'info>,
  #[account(
    init,
    seeds = [key.to_le_bytes().as_ref()],
    // derives the PDA using the canonical bump
    bump,
    payer = payer,
    space = 8 + 8 + 1
  )]
  data: Account<'info, Data>,
  system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(key: u64)]
pub struct VerifyAddress<'info> {
  #[account(
    seeds = [key.to_le_bytes().as_ref()],
    // guranteed to be the canonical bump every time
    bump = data.bump
  )]
  data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
    // bump field
    bump: u8
}
```

Si no especifica el bump en la `bump` restricción, Anchor seguirá usándolo `find_program_address` para derivar el PDA usando el bump canónico. Como consecuencia, su instrucción incurrirá en una cantidad variable de presupuesto de cómputo. Los programas que ya están en riesgo de exceder su presupuesto de cómputo deben usar esto con cuidado, ya que existe la posibilidad de que el presupuesto del programa pueda excederse de manera ocasional e impredecible.

Por otro lado, si solo necesita verificar la dirección de un PDA pasado sin inicializar una cuenta, se verá obligado a dejar que Anchor derive el bache canónico o exponga su programa a riesgos innecesarios. En ese caso, utilice la protuberancia canónica a pesar de la ligera marca en contra del rendimiento.

# Demostración

Para demostrar que los exploits de seguridad son posibles cuando no se verifica el bache canónico, trabajemos con un programa que permita que cada usuario del programa "reclame" las recompensas a tiempo.

### 1. Configuración

Comience por obtener el código en la `starter` rama de[este repositorio](https://github.com/Unboxed-Software/solana-bump-seed-canonicalization/tree/starter).

Observe que hay dos instrucciones en el programa y una sola prueba en el `tests` directorio.

Las instrucciones del programa son:

1.  `create_user_insecure`
2.  `claim_insecure`

La `create_user_insecure` instrucción simplemente crea una nueva cuenta en un PDA derivado utilizando la clave pública del firmante y un bache pasado.

La `claim_insecure` instrucción acuña 10 fichas para el usuario y luego marca las recompensas de la cuenta según lo reclamado para que no puedan reclamar nuevamente.

Sin embargo, el programa no verifica explícitamente que los PDA en cuestión estén usando el bache canónico.

Echa un vistazo al programa para entender lo que hace antes de continuar.

### 2. Instrucciones de prueba inseguras

Dado que las instrucciones no requieren explícitamente que la `user` PDA use el bache canónico, un atacante puede crear varias cuentas por billetera y reclamar más recompensas de las que se deberían permitir.

La prueba en el `tests` directorio crea un nuevo par de claves llamado `attacker` para representar a un atacante. Luego recorre todos los posibles golpes y llamadas `create_user_insecure` y `claim_insecure`. Al final, la prueba espera que el atacante haya podido reclamar recompensas varias veces y haya ganado más de los 10 tokens asignados por usuario.

```typescript
it("Attacker can claim more than reward limit with insecure instructions", async () => {
    const attacker = Keypair.generate();
    await safeAirdrop(attacker.publicKey, provider.connection);
    const ataKey = await getAssociatedTokenAddress(mint, attacker.publicKey);

    let numClaims = 0;

    for (let i = 0; i < 256; i++) {
        try {
            const pda = createProgramAddressSync(
                [attacker.publicKey.toBuffer(), Buffer.from([i])],
                program.programId,
            );
            await program.methods
                .createUserInsecure(i)
                .accounts({
                    user: pda,
                    payer: attacker.publicKey,
                })
                .signers([attacker])
                .rpc();
            await program.methods
                .claimInsecure(i)
                .accounts({
                    user: pda,
                    mint,
                    payer: attacker.publicKey,
                    userAta: ataKey,
                })
                .signers([attacker])
                .rpc();

            numClaims += 1;
        } catch (error) {
            if (
                error.message !==
                "Invalid seeds, address must fall off the curve"
            ) {
                console.log(error);
            }
        }
    }

    const ata = await getAccount(provider.connection, ataKey);

    console.log(
        `Attacker claimed ${numClaims} times and got ${Number(
            ata.amount,
        )} tokens`,
    );

    expect(numClaims).to.be.greaterThan(1);
    expect(Number(ata.amount)).to.be.greaterThan(10);
});
```

Ejecutar `anchor test` para ver que esta prueba pasa, lo que demuestra que el atacante tiene éxito. Dado que la prueba llama a las instrucciones para cada bache válido, se necesita un poco para ejecutar, así que ten paciencia.

```bash
  bump-seed-canonicalization
Attacker claimed 129 times and got 1290 tokens
    ✔ Attacker can claim more than reward limit with insecure instructions (133840ms)
```

### 3. Crear instrucciones seguras

Vamos a demostrar el parche de la vulnerabilidad mediante la creación de dos nuevas instrucciones:

1.  `create_user_secure`
2.  `claim_secure`

Antes de escribir la validación de la cuenta o la lógica de instrucciones, vamos a crear un nuevo tipo de usuario, `UserSecure`. Este nuevo tipo añadirá la protuberancia canónica como un campo en la estructura.

```rust
#[account]
pub struct UserSecure {
    auth: Pubkey,
    bump: u8,
    rewards_claimed: bool,
}
```

A continuación, vamos a crear estructuras de validación de cuenta para cada una de las nuevas instrucciones. Serán muy similares a las versiones inseguras, pero permitirán que Anchor maneje la derivación y deserialización de los PDA.

```rust
#[derive(Accounts)]
pub struct CreateUserSecure<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init,
        seeds = [payer.key().as_ref()],
        // derives the PDA using the canonical bump
        bump,
        payer = payer,
        space = 8 + 32 + 1 + 1
    )]
    user: Account<'info, UserSecure>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SecureClaim<'info> {
    #[account(
        seeds = [payer.key().as_ref()],
        bump = user.bump,
        constraint = !user.rewards_claimed @ ClaimError::AlreadyClaimed,
        constraint = user.auth == payer.key()
    )]
    user: Account<'info, UserSecure>,
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer
    )]
    user_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    mint: Account<'info, Mint>,
    /// CHECK: mint auth PDA
    #[account(seeds = ["mint".as_bytes().as_ref()], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}
```

Finalmente, vamos a implementar la lógica de instrucción para las dos nuevas instrucciones. La `create_user_secure` instrucción simplemente necesita establecer los `rewards_claimed` campos `auth` `bump` y en los datos de la `user` cuenta.

```rust
pub fn create_user_secure(ctx: Context<CreateUserSecure>) -> Result<()> {
    ctx.accounts.user.auth = ctx.accounts.payer.key();
    ctx.accounts.user.bump = *ctx.bumps.get("user").unwrap();
    ctx.accounts.user.rewards_claimed = false;
    Ok(())
}
```

La `claim_secure` instrucción necesita acuñar 10 fichas para el usuario y establecer el `rewards_claimed` campo de la `user` cuenta en `true`.

```rust
pub fn claim_secure(ctx: Context<SecureClaim>) -> Result<()> {
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.user_ata.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[&[
                    b"mint".as_ref(),
                &[*ctx.bumps.get("mint_authority").unwrap()],
            ]],
        ),
        10,
    )?;

    ctx.accounts.user.rewards_claimed = true;

    Ok(())
}
```

### 4. Probar instrucciones seguras

Vamos a escribir una prueba para demostrar que el atacante ya no puede reclamar más de una vez usando las nuevas instrucciones.

Tenga en cuenta que si comienza a pasar a través del uso de múltiples PDA como la prueba anterior, ni siquiera puede pasar el golpe no canónico a las instrucciones. Sin embargo, aún puede recorrer el uso de los diversos PDA y al final verificar que solo ocurrió 1 reclamo para un total de 10 tokens. Su prueba final se verá algo como esto:

```typescript
it.only("Attacker can only claim once with secure instructions", async () => {
    const attacker = Keypair.generate();
    await safeAirdrop(attacker.publicKey, provider.connection);
    const ataKey = await getAssociatedTokenAddress(mint, attacker.publicKey);
    const [userPDA] = findProgramAddressSync(
        [attacker.publicKey.toBuffer()],
        program.programId,
    );

    await program.methods
        .createUserSecure()
        .accounts({
            payer: attacker.publicKey,
        })
        .signers([attacker])
        .rpc();

    await program.methods
        .claimSecure()
        .accounts({
            payer: attacker.publicKey,
            userAta: ataKey,
            mint,
            user: userPDA,
        })
        .signers([attacker])
        .rpc();

    let numClaims = 1;

    for (let i = 0; i < 256; i++) {
        try {
            const pda = createProgramAddressSync(
                [attacker.publicKey.toBuffer(), Buffer.from([i])],
                program.programId,
            );
            await program.methods
                .createUserSecure()
                .accounts({
                    user: pda,
                    payer: attacker.publicKey,
                })
                .signers([attacker])
                .rpc();

            await program.methods
                .claimSecure()
                .accounts({
                    payer: attacker.publicKey,
                    userAta: ataKey,
                    mint,
                    user: pda,
                })
                .signers([attacker])
                .rpc();

            numClaims += 1;
        } catch {}
    }

    const ata = await getAccount(provider.connection, ataKey);

    expect(Number(ata.amount)).to.equal(10);
    expect(numClaims).to.equal(1);
});
```

```bash
  bump-seed-canonicalization
Attacker claimed 119 times and got 1190 tokens
    ✔ Attacker can claim more than reward limit with insecure instructions (128493ms)
    ✔ Attacker can only claim once with secure instructions (1448ms)
```

Si utiliza Anchor para todas las derivaciones de PDA, este exploit en particular es bastante fácil de evitar. Sin embargo, si terminas haciendo algo "no estándar", ¡ten cuidado de diseñar tu programa para usar explícitamente el bache canónico!

Si desea echar un vistazo al código de la solución final, puede encontrarlo en la `solution` rama de[el mismo repositorio](https://github.com/Unboxed-Software/solana-bump-seed-canonicalization/tree/solution).

# Desafío

Al igual que con otras lecciones de este módulo, su oportunidad de practicar evitando este exploit de seguridad radica en auditar sus propios programas u otros.

Tómese un tiempo para revisar al menos un programa y asegúrese de que todas las derivaciones y comprobaciones de PDA estén utilizando el bache canónico.

Recuerde, si encuentra un error o un exploit en el programa de otra persona, ¡avíselos! Si encuentra uno en su propio programa, asegúrese de parchearlo de inmediato.
